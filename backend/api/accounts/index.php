<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('accounts');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;
    $types = ['cash', 'bank', 'mobile_money', 'savings', 'other'];

    if ($method === 'GET' && $a === null) {
        $rows = FinancialCalculationService::accountBalances($uid, ($_GET['active'] ?? '') === '1');
        $total = 0; foreach ($rows as $r) if ($r['is_active']) $total += to_cents($r['balance']);
        json_ok(['items' => $rows, 'total_balance' => from_cents($total)]);
    }

    if ($method === 'POST' && $a === 'transfer') {
        $v = new V(input());
        $from = $v->id('from_account_id', 'From account'); $to = $v->id('to_account_id', 'To account');
        $amount = $v->amount('amount', 'Amount'); $date = $v->date('txn_date', 'Date');
        $note = $v->str('description', 'Note', false, 255);
        $uuid = $v->str('client_uuid', 'Transaction id', false, 36);
        if ($from && $from === $to) $v->fail('to_account_id', 'Choose two different accounts.');
        if ($uuid !== null && !valid_uuid($uuid)) $v->fail('client_uuid', 'Invalid transaction id.');
        $v->done();
        if ($uuid && q_val('SELECT id FROM transactions WHERE user_id = ? AND client_uuid = ?', [$uid, $uuid])) json_ok(['duplicate' => true], 'Already saved.');
        $fa = TransactionService::accountOwned($uid, $from); $ta = TransactionService::accountOwned($uid, $to);
        $group = uuid_v4();
        in_tx(function () use ($uid, $from, $to, $amount, $date, $note, $uuid, $group, $fa, $ta) {
            TransactionService::assertFunds($uid, $from, $amount, 'from_account_id');
            TransactionService::insert(['user_id' => $uid, 'account_id' => $from, 'type' => 'transfer_out', 'amount' => $amount, 'title' => 'Transfer to ' . $ta['name'], 'txn_date' => $date, 'description' => $note, 'client_uuid' => $uuid, 'transfer_group' => $group]);
            TransactionService::insert(['user_id' => $uid, 'account_id' => $to, 'type' => 'transfer_in', 'amount' => $amount, 'title' => 'Transfer from ' . $fa['name'], 'txn_date' => $date, 'description' => $note, 'transfer_group' => $group]);
        });
        audit($uid, 'transfer_created', 'transfer', $group);
        json_ok(['duplicate' => false], 'Transfer saved.', 201);
    }

    if ($method === 'POST' && $a === null) {
        $v = new V(input());
        $name = $v->str('name', 'Account name', true, 80);
        $type = $v->enum('type', 'Account type', $types);
        $open = $v->amount('opening_balance', 'Opening balance', false, true) ?? '0.00';
        $v->done();
        if (q_val('SELECT id FROM financial_accounts WHERE user_id = ? AND name = ?', [$uid, $name])) throw new ApiException('Please correct the highlighted fields.', 422, ['name' => 'You already have an account with this name.']);
        q('INSERT INTO financial_accounts (user_id, name, type, currency, opening_balance) VALUES (?,?,?,?,?)', [$uid, $name, $type, (string)setting('default_currency', 'TZS'), $open]);
        audit($uid, 'account_created', 'account', db()->lastInsertId());
        json_ok(['id' => (int)db()->lastInsertId()], 'Account created.', 201);
    }

    if ($a !== null && ctype_digit($a)) {
        $id = (int)$a;
        $row = owned('financial_accounts', $id, $uid);
        if ($method === 'PUT') {
            $v = new V(input());
            $name = $v->str('name', 'Account name', true, 80);
            $type = $v->enum('type', 'Account type', $types);
            $open = $v->amount('opening_balance', 'Opening balance', false, true) ?? $row['opening_balance'];
            $v->done();
            if (q_val('SELECT id FROM financial_accounts WHERE user_id = ? AND name = ? AND id <> ?', [$uid, $name, $id])) throw new ApiException('Please correct the highlighted fields.', 422, ['name' => 'You already have an account with this name.']);
            q('UPDATE financial_accounts SET name=?, type=?, opening_balance=? WHERE id=? AND user_id=?', [$name, $type, $open, $id, $uid]);
            audit($uid, 'account_updated', 'account', $id);
            json_ok(null, 'Account saved.');
        }
        if ($method === 'POST' && ($p[1] ?? '') === 'toggle') {
            if ($row['is_active'] && (int)q_val('SELECT COUNT(*) FROM financial_accounts WHERE user_id = ? AND is_active = 1', [$uid]) <= 1) throw new ApiException('You need at least one active account.', 422);
            q('UPDATE financial_accounts SET is_active = 1 - is_active WHERE id = ? AND user_id = ?', [$id, $uid]);
            json_ok(null, $row['is_active'] ? 'Account archived.' : 'Account reactivated.');
        }
        if ($method === 'DELETE') {
            if ((int)q_val('SELECT COUNT(*) FROM transactions WHERE account_id = ?', [$id]) || (int)q_val('SELECT COUNT(*) FROM debt_payments WHERE account_id = ?', [$id])) {
                throw new ApiException('This account has history, so it cannot be deleted. Archive it instead.', 409);
            }
            q('DELETE FROM financial_accounts WHERE id = ? AND user_id = ?', [$id, $uid]);
            json_ok(null, 'Account deleted.');
        }
    }
};
