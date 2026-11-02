<?php
declare(strict_types=1);

/**
 * Debt payments.
 *  owed_by_me : principal -> ledger 'debt_repaid' (cash out, NOT an expense); interest -> expense "Debt interest"
 *  owed_to_me : principal -> ledger 'debt_collected' (cash in, NOT income);  interest -> income "Interest"
 * Remaining debt = principal - SUM(posted principal payments).
 */
function debt_interest_category(int $uid, string $type): int
{
    $name = $type === 'expense' ? 'Debt interest' : 'Interest';
    $id = q_val('SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ?', [$uid, $type, $name]);
    if (!$id) { q('INSERT INTO categories (user_id, type, name) VALUES (?,?,?)', [$uid, $type, $name]); $id = db()->lastInsertId(); }
    else q('UPDATE categories SET is_active = 1 WHERE id = ?', [$id]);
    return (int)$id;
}

return function (string $method, array $p): void {
    $user = require_feature('debts');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) {
        $sql = "SELECT p.*, d.party_name, d.direction, a.name AS account_name FROM debt_payments p JOIN debts d ON d.id = p.debt_id JOIN financial_accounts a ON a.id = p.account_id WHERE p.user_id = ?";
        $params = [$uid];
        if (!empty($_GET['debt_id'])) { $sql .= ' AND p.debt_id = ?'; $params[] = (int)$_GET['debt_id']; }
        if (!empty($_GET['from'])) { $sql .= ' AND p.pay_date >= ?'; $params[] = $_GET['from']; }
        if (!empty($_GET['to'])) { $sql .= ' AND p.pay_date <= ?'; $params[] = $_GET['to']; }
        json_ok(['items' => q_all($sql . ' ORDER BY p.pay_date DESC, p.id DESC LIMIT 500', $params)]);
    }

    if ($method === 'POST' && $a === null) {
        $v = new V(input());
        $debtId = $v->id('debt_id', 'Debt'); $accId = $v->id('account_id', 'Account');
        $principal = $v->amount('principal_amount', 'Amount paid');
        $interest = $v->amount('interest_amount', 'Interest included', false, true) ?? '0.00';
        $date = $v->date('pay_date', 'Payment date');
        $meth = $v->str('method', 'Payment method', false, 40); $ref = $v->str('reference', 'Reference', false, 80); $notes = $v->str('notes', 'Notes', false, 255);
        $uuid = $v->str('client_uuid', 'Transaction id', false, 36);
        if ($uuid !== null && !valid_uuid($uuid)) $v->fail('client_uuid', 'Invalid transaction id.');
        if ($date && $date > (new DateTimeImmutable('today'))->modify('+1 day')->format('Y-m-d')) $v->fail('pay_date', 'Payment date cannot be in the future.');
        $v->done();
        if ($uuid && ($dup = q_one('SELECT id FROM debt_payments WHERE user_id = ? AND client_uuid = ?', [$uid, $uuid]))) json_ok(['id' => (int)$dup['id'], 'duplicate' => true], 'Already saved.');
        TransactionService::accountOwned($uid, $accId);

        $result = in_tx(function () use ($uid, $debtId, $accId, $principal, $interest, $date, $meth, $ref, $notes, $uuid) {
            $debt = q_one('SELECT * FROM debts WHERE id = ? AND user_id = ? FOR UPDATE', [$debtId, $uid]);
            if (!$debt) throw new ApiException('Debt not found.', 404);
            if ($debt['cancelled_at']) throw new ApiException('This debt was cancelled.', 409);
            $paid = to_cents((string)q_val("SELECT COALESCE(SUM(principal_amount),0) FROM debt_payments WHERE debt_id = ? AND status = 'posted'", [$debtId]));
            $remaining = to_cents($debt['principal']) - $paid;
            if ($remaining <= 0) throw new ApiException('This debt is already fully paid.', 409);
            if (to_cents($principal) > $remaining) throw new ApiException('That is more than the remaining balance (' . money_fmt(from_cents($remaining)) . ').', 422, ['principal_amount' => 'Amount is more than the remaining balance of ' . money_fmt(from_cents($remaining)) . '.']);
            $byMe = $debt['direction'] === 'owed_by_me';
            if ($byMe) TransactionService::assertFunds($uid, $accId, from_cents(to_cents($principal) + to_cents($interest)));

            q('INSERT INTO debt_payments (user_id, debt_id, account_id, principal_amount, interest_amount, pay_date, method, reference, notes, client_uuid) VALUES (?,?,?,?,?,?,?,?,?,?)',
                [$uid, $debtId, $accId, $principal, $interest, $date, $meth, $ref, $notes, $uuid]);
            $pid = (int)db()->lastInsertId();
            TransactionService::insert(['user_id' => $uid, 'account_id' => $accId, 'type' => $byMe ? 'debt_repaid' : 'debt_collected', 'amount' => $principal,
                'title' => ($byMe ? 'Repayment to ' : 'Repayment from ') . $debt['party_name'], 'party' => $debt['party_name'], 'payment_method' => $meth, 'txn_date' => $date, 'reference' => $ref, 'debt_id' => $debtId, 'debt_payment_id' => $pid]);
            if (to_cents($interest) > 0) {
                $t = $byMe ? 'expense' : 'income';
                TransactionService::insert(['user_id' => $uid, 'account_id' => $accId, 'type' => $t, 'amount' => $interest, 'category_id' => debt_interest_category($uid, $t),
                    'title' => 'Interest ' . ($byMe ? 'paid to ' : 'received from ') . $debt['party_name'], 'party' => $debt['party_name'], 'payment_method' => $meth, 'txn_date' => $date, 'reference' => $ref, 'debt_id' => $debtId, 'debt_payment_id' => $pid]);
            }
            return [$pid, $debt, $remaining - to_cents($principal)];
        });
        [$pid, $debt, $left] = $result;
        audit($uid, 'debt_payment_created', 'debt_payment', $pid);
        if ($left === 0) NotificationService::send($uid, 'debt_paid', 'Debt fully paid', $debt['party_name'] . ': this debt is now fully settled.', 'debts.html', 'debt-paid:' . $debt['id'] . ':' . $pid);
        if (to_cents($interest) > 0 && $debt['direction'] === 'owed_by_me') BudgetService::checkAlerts($uid);
        json_ok(['id' => $pid, 'remaining' => from_cents($left), 'duplicate' => false], $left === 0 ? 'Debt fully paid. Well done!' : 'Payment recorded.', 201);
    }

    if ($a !== null && ctype_digit($a)) {
        $id = (int)$a;
        $row = owned('debt_payments', $id, $uid);
        if ($method === 'PUT') { // Only non-financial details are editable; to change an amount, reverse and re-enter.
            if ($row['status'] !== 'posted') throw new ApiException('Reversed payments cannot be edited.', 409);
            $v = new V(input());
            $date = $v->date('pay_date', 'Payment date'); $meth = $v->str('method', 'Payment method', false, 40);
            $ref = $v->str('reference', 'Reference', false, 80); $notes = $v->str('notes', 'Notes', false, 255);
            $v->done();
            in_tx(function () use ($date, $meth, $ref, $notes, $id, $uid) {
                q('UPDATE debt_payments SET pay_date=?, method=?, reference=?, notes=? WHERE id=? AND user_id=?', [$date, $meth, $ref, $notes, $id, $uid]);
                q('UPDATE transactions SET txn_date=?, payment_method=?, reference=? WHERE debt_payment_id=? AND user_id=?', [$date, $meth, $ref, $id, $uid]);
            });
            audit($uid, 'debt_payment_updated', 'debt_payment', $id);
            json_ok(null, 'Payment details updated.');
        }
        if ($method === 'DELETE') {
            if ($row['status'] === 'reversed') json_ok(null, 'Already reversed.');
            in_tx(function () use ($id, $uid) {
                q("UPDATE debt_payments SET status='reversed' WHERE id=? AND user_id=?", [$id, $uid]);
                q("UPDATE transactions SET status='reversed', reversed_at=? WHERE debt_payment_id=? AND user_id=? AND status='posted'", [now_utc(), $id, $uid]);
            });
            audit($uid, 'debt_payment_reversed', 'debt_payment', $id);
            json_ok(null, 'Payment reversed. The debt balance was restored.');
        }
    }
};
