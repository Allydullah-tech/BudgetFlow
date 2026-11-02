<?php
declare(strict_types=1);

/** Savings goals. Contributions/withdrawals are ledger moves between an account and a goal - never income or expenses. */
return function (string $method, array $p): void {
    $user = require_feature('savings');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) {
        json_ok(['items' => FinancialCalculationService::savingsGoals($uid), 'total' => FinancialCalculationService::totalSavings($uid)]);
    }
    if ($method === 'POST' && $a === null) {
        $v = new V(input());
        $name = $v->str('name', 'Goal name', true, 100); $target = $v->amount('target_amount', 'Target amount');
        $date = $v->date('target_date', 'Target date', false); $notes = $v->str('notes', 'Notes', false, 255);
        if ($date && $date < today()) $v->fail('target_date', 'Target date should be today or later.');
        $v->done();
        q('INSERT INTO savings_goals (user_id, name, target_amount, target_date, notes) VALUES (?,?,?,?,?)', [$uid, $name, $target, $date, $notes]);
        json_ok(['id' => (int)db()->lastInsertId()], 'Savings goal created.', 201);
    }
    if ($a === null || !ctype_digit($a)) return;
    $id = (int)$a;
    $goal = owned('savings_goals', $id, $uid);
    $sub = $p[1] ?? null;

    if ($method === 'GET' && $sub === 'history') {
        json_ok(['items' => q_all("SELECT t.id, t.type, t.amount, t.txn_date, t.description, t.status, a.name AS account_name FROM transactions t JOIN financial_accounts a ON a.id = t.account_id
                                   WHERE t.goal_id = ? AND t.user_id = ? ORDER BY t.txn_date DESC, t.id DESC", [$id, $uid])]);
    }
    if ($method === 'PUT') {
        $v = new V(input());
        $name = $v->str('name', 'Goal name', true, 100); $target = $v->amount('target_amount', 'Target amount');
        $date = $v->date('target_date', 'Target date', false); $notes = $v->str('notes', 'Notes', false, 255);
        $v->done();
        q('UPDATE savings_goals SET name=?, target_amount=?, target_date=?, notes=?, is_active=? WHERE id=? AND user_id=?', [$name, $target, $date, $notes, isset(input()['is_active']) ? $v->bool('is_active') : $goal['is_active'], $id, $uid]);
        json_ok(null, 'Goal saved.');
    }
    if ($method === 'DELETE' && $sub === 'history' && isset($p[2]) && ctype_digit($p[2])) {
        $t = q_one("SELECT id FROM transactions WHERE id = ? AND goal_id = ? AND user_id = ? AND status = 'posted'", [(int)$p[2], $id, $uid]);
        if (!$t) throw new ApiException('Record not found.', 404);
        q("UPDATE transactions SET status='reversed', reversed_at=? WHERE id = ?", [now_utc(), $t['id']]);
        audit($uid, 'savings_reversed', 'transaction', $t['id']);
        json_ok(null, 'Savings entry reversed.');
    }
    if ($method === 'DELETE' && $sub === null) {
        if ((int)q_val("SELECT COUNT(*) FROM transactions WHERE goal_id = ? AND status = 'posted'", [$id])) {
            throw new ApiException('This goal has savings in it. Withdraw the money first, or archive the goal.', 409);
        }
        q('DELETE FROM transactions WHERE goal_id = ? AND user_id = ?', [$id, $uid]);
        q('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [$id, $uid]);
        json_ok(null, 'Goal deleted.');
    }

    if ($method === 'POST' && in_array($sub, ['contribute', 'withdraw'], true)) {
        $v = new V(input());
        $accId = $v->id('account_id', 'Account'); $amount = $v->amount('amount', 'Amount'); $date = $v->date('txn_date', 'Date');
        $note = $v->str('description', 'Note', false, 255); $uuid = $v->str('client_uuid', 'Transaction id', false, 36);
        if ($uuid !== null && !valid_uuid($uuid)) $v->fail('client_uuid', 'Invalid transaction id.');
        $v->done();
        if ($uuid && q_val('SELECT id FROM transactions WHERE user_id = ? AND client_uuid = ?', [$uid, $uuid])) json_ok(['duplicate' => true], 'Already saved.');
        TransactionService::accountOwned($uid, $accId);
        $contribute = $sub === 'contribute';
        in_tx(function () use ($uid, $id, $accId, $amount, $date, $note, $uuid, $contribute, $goal) {
            q('SELECT id FROM savings_goals WHERE id = ? FOR UPDATE', [$id]);
            if ($contribute) TransactionService::assertFunds($uid, $accId, $amount);
            else {
                $bal = (string)q_val("SELECT COALESCE(SUM(CASE WHEN type='savings_contribution' THEN amount ELSE -amount END),0) FROM transactions WHERE goal_id = ? AND status='posted'", [$id]);
                if (to_cents($amount) > to_cents($bal)) throw new ApiException('You only have ' . money_fmt($bal) . ' saved in this goal.', 422, ['amount' => 'You only have ' . money_fmt($bal) . ' saved in this goal.']);
            }
            TransactionService::insert(['user_id' => $uid, 'account_id' => $accId, 'type' => $contribute ? 'savings_contribution' : 'savings_withdrawal', 'amount' => $amount,
                'title' => ($contribute ? 'Saved to ' : 'Withdrawn from ') . $goal['name'], 'txn_date' => $date, 'description' => $note, 'client_uuid' => $uuid, 'goal_id' => $id]);
        });
        // Milestones at 25/50/75/100%
        $g = array_values(array_filter(FinancialCalculationService::savingsGoals($uid), fn($x) => (int)$x['id'] === $id))[0];
        $reached = 0; foreach ([25, 50, 75, 100] as $m) if ($g['percent'] >= $m) $reached = $m;
        if ($contribute && $reached > (int)$goal['milestone_notified']) {
            $pref = q_val('SELECT notify_savings FROM user_settings WHERE user_id = ?', [$uid]);
            if ($pref === null || $pref) NotificationService::send($uid, 'savings_milestone', $reached >= 100 ? 'Savings goal reached!' : "Savings milestone: $reached%", '"' . $goal['name'] . '" is now ' . $g['percent'] . '% funded.', 'savings.html', "sav:$id:$reached");
        }
        q('UPDATE savings_goals SET milestone_notified = ? WHERE id = ?', [$reached, $id]);
        audit($uid, $contribute ? 'savings_contribution' : 'savings_withdrawal', 'savings_goal', $id);
        json_ok(['percent' => $g['percent']], $contribute ? 'Savings added.' : 'Withdrawal recorded.', 201);
    }
};
