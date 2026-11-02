<?php
declare(strict_types=1);

/**
 * Debts. Accounting rules:
 *  - Borrowing money adds cash to an account (ledger 'debt_borrowed') but is NOT income.
 *  - Lending money removes cash ('debt_lent') but is NOT an expense.
 *  - Repayments are handled in debt-payments (principal never touches income/expenses; interest does).
 */
return function (string $method, array $p): void {
    $user = require_feature('debts');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) {
        $rows = FinancialCalculationService::debts($uid);
        if (!empty($_GET['direction'])) $rows = array_values(array_filter($rows, fn($d) => $d['direction'] === $_GET['direction']));
        if (!empty($_GET['status'])) $rows = array_values(array_filter($rows, fn($d) => $d['status'] === $_GET['status']));
        if (!empty($_GET['q'])) { $s = mb_strtolower((string)$_GET['q']); $rows = array_values(array_filter($rows, fn($d) => str_contains(mb_strtolower($d['party_name'] . ' ' . $d['description']), $s))); }
        json_ok(['items' => $rows, 'summary' => FinancialCalculationService::debtSummary($uid)]);
    }

    $validate = function (array $in, bool $creating): array {
        $v = new V($in);
        $d = [
            'direction' => $creating ? $v->enum('direction', 'Debt type', ['owed_by_me', 'owed_to_me']) : null,
            'party_name' => $v->str('party_name', 'Name', true, 120),
            'phone' => $v->phone('phone', 'Phone number', false),
            'description' => $v->str('description', 'Description', false, 255),
            'principal' => $v->amount('principal', 'Amount'),
            'interest_rate' => null,
            'start_date' => $v->date('start_date', 'Debt date'),
            'due_date' => $v->date('due_date', 'Due date', false),
            'notes' => $v->str('notes', 'Notes', false, 2000),
            'account_id' => $creating ? $v->id('account_id', 'Account', false) : null,
        ];
        if ($v->has('interest_rate')) {
            $ir = str_replace(',', '.', (string)$v->raw('interest_rate'));
            if (!is_numeric($ir) || $ir < 0 || $ir > 1000) $v->fail('interest_rate', 'Interest rate must be between 0 and 1000.'); else $d['interest_rate'] = number_format((float)$ir, 2, '.', '');
        }
        if ($d['start_date'] && $d['due_date'] && $d['due_date'] < $d['start_date']) $v->fail('due_date', 'Due date cannot be before the debt date.');
        $v->done();
        return $d;
    };

    if ($method === 'POST' && $a === null) {
        $in = input();
        $d = $validate($in, true);
        if ($d['account_id']) TransactionService::accountOwned($uid, $d['account_id']);
        $id = (int)in_tx(function () use ($uid, $d) {
            q('INSERT INTO debts (user_id, direction, party_name, phone, description, principal, interest_rate, start_date, due_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
                [$uid, $d['direction'], $d['party_name'], $d['phone'], $d['description'], $d['principal'], $d['interest_rate'], $d['start_date'], $d['due_date'], $d['notes']]);
            $id = (int)db()->lastInsertId();
            if ($d['account_id']) {
                $lent = $d['direction'] === 'owed_to_me';
                if ($lent) TransactionService::assertFunds($uid, $d['account_id'], $d['principal']);
                TransactionService::insert(['user_id' => $uid, 'account_id' => $d['account_id'], 'type' => $lent ? 'debt_lent' : 'debt_borrowed', 'amount' => $d['principal'],
                    'title' => ($lent ? 'Loan given to ' : 'Loan received from ') . $d['party_name'], 'party' => $d['party_name'], 'txn_date' => $d['start_date'], 'debt_id' => $id]);
            }
            return $id;
        });
        audit($uid, 'debt_created', 'debt', $id);
        json_ok(['id' => $id], 'Debt recorded.', 201);
    }

    if ($a !== null && ctype_digit($a)) {
        $id = (int)$a;
        $row = owned('debts', $id, $uid);
        if ($method === 'GET') {
            $d = FinancialCalculationService::debts($uid, $id)[0];
            $d['payments'] = q_all("SELECT p.*, a.name AS account_name FROM debt_payments p JOIN financial_accounts a ON a.id = p.account_id WHERE p.debt_id = ? AND p.user_id = ? ORDER BY p.pay_date DESC, p.id DESC", [$id, $uid]);
            json_ok($d);
        }
        if ($method === 'PUT') {
            if ($row['cancelled_at']) throw new ApiException('Cancelled debts cannot be edited.', 409);
            $d = $validate(input() + ['account_id' => null], false);
            $paid = (int)q_val("SELECT COUNT(*) FROM debt_payments WHERE debt_id = ? AND status = 'posted'", [$id]);
            if ($paid && to_cents($d['principal']) !== to_cents($row['principal'])) throw new ApiException('The amount cannot be changed after payments were recorded. Reverse the payments first.', 422, ['principal' => 'Amount is locked once payments exist.']);
            in_tx(function () use ($d, $id, $uid, $row) {
                q('UPDATE debts SET party_name=?, phone=?, description=?, principal=?, interest_rate=?, start_date=?, due_date=?, notes=? WHERE id=? AND user_id=?',
                    [$d['party_name'], $d['phone'], $d['description'], $d['principal'], $d['interest_rate'], $d['start_date'], $d['due_date'], $d['notes'], $id, $uid]);
                q("UPDATE transactions SET amount=?, txn_date=?, party=? WHERE debt_id=? AND debt_payment_id IS NULL AND status='posted' AND user_id=?", [$d['principal'], $d['start_date'], $d['party_name'], $id, $uid]);
            });
            audit($uid, 'debt_updated', 'debt', $id);
            json_ok(null, 'Debt updated.');
        }
        if ($method === 'DELETE') {
            if ((int)q_val("SELECT COUNT(*) FROM debt_payments WHERE debt_id = ? AND status = 'posted'", [$id])) throw new ApiException('This debt has payments. Reverse them first, or leave the debt as it is.', 409);
            in_tx(function () use ($id, $uid) {
                q("UPDATE debts SET cancelled_at = ? WHERE id = ? AND user_id = ?", [now_utc(), $id, $uid]);
                q("UPDATE transactions SET status='reversed', reversed_at=? WHERE debt_id = ? AND user_id = ? AND status='posted'", [now_utc(), $id, $uid]);
            });
            audit($uid, 'debt_cancelled', 'debt', $id);
            json_ok(null, 'Debt cancelled. Any cash movement from it was reversed.');
        }
    }
};
