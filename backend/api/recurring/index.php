<?php
declare(strict_types=1);

/**
 * Recurring (scheduled) income/expenses. A scheduled item is NOT a transaction: nothing is recorded until the user
 * confirms it. Confirming is idempotent per (recurring_id, occurrence_date).
 */
function recurring_next(array $r): ?string
{
    $d = new DateTimeImmutable($r['next_due']);
    $start = new DateTimeImmutable($r['start_date']);
    switch ($r['frequency']) {
        case 'daily': $n = $d->modify('+1 day'); break;
        case 'weekly': $n = $d->modify('+7 days'); break;
        case 'monthly': case 'yearly':
            $months = $r['frequency'] === 'monthly' ? 1 : 12;
            $t = $d->modify('first day of this month')->modify("+$months month");
            $n = $t->setDate((int)$t->format('Y'), (int)$t->format('n'), min((int)$start->format('j'), (int)$t->format('t')));
            break;
        default: $n = $d->modify('+' . max(1, (int)$r['interval_days']) . ' days');
    }
    $n = $n->format('Y-m-d');
    return ($r['end_date'] && $n > $r['end_date']) ? null : $n;
}

return function (string $method, array $p): void {
    $user = require_feature('recurring');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) {
        json_ok(['items' => q_all('SELECT r.*, c.name AS category_name, a.name AS account_name, (r.next_due <= ? AND r.is_active = 1) AS is_due FROM recurring_transactions r
                                   LEFT JOIN categories c ON c.id = r.category_id JOIN financial_accounts a ON a.id = r.account_id WHERE r.user_id = ? ORDER BY r.is_active DESC, r.next_due', [today(), $uid])]);
    }

    $validate = function (array $in) use ($uid): array {
        $v = new V($in);
        $d = [
            'type' => $v->enum('type', 'Type', ['income', 'expense']), 'title' => $v->str('title', 'Title', true, 120), 'amount' => $v->amount('amount', 'Amount'),
            'category_id' => $v->id('category_id', 'Category'), 'account_id' => $v->id('account_id', 'Account'),
            'frequency' => $v->enum('frequency', 'Frequency', ['daily', 'weekly', 'monthly', 'yearly', 'custom']),
            'interval_days' => null, 'start_date' => $v->date('start_date', 'Start date'), 'end_date' => $v->date('end_date', 'End date', false),
        ];
        if ($d['frequency'] === 'custom') {
            $d['interval_days'] = $v->id('interval_days', 'Repeat every (days)');
            if ($d['interval_days'] && $d['interval_days'] > 3650) $v->fail('interval_days', 'Interval is too large.');
        }
        if ($d['start_date'] && $d['end_date'] && $d['end_date'] < $d['start_date']) $v->fail('end_date', 'End date cannot be before the start date.');
        $v->done();
        TransactionService::accountOwned($uid, $d['account_id']);
        TransactionService::categoryOwned($uid, $d['category_id'], $d['type']);
        return $d;
    };

    if ($method === 'POST' && $a === null) {
        $d = $validate(input());
        q('INSERT INTO recurring_transactions (user_id, type, title, amount, category_id, account_id, frequency, interval_days, start_date, end_date, next_due) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [$uid, $d['type'], $d['title'], $d['amount'], $d['category_id'], $d['account_id'], $d['frequency'], $d['interval_days'], $d['start_date'], $d['end_date'], $d['start_date']]);
        json_ok(['id' => (int)db()->lastInsertId()], 'Recurring item saved.', 201);
    }
    if ($a === null || !ctype_digit($a)) return;
    $id = (int)$a;
    $row = owned('recurring_transactions', $id, $uid);
    $sub = $p[1] ?? null;

    if ($method === 'PUT') {
        $in = input();
        if (array_keys($in) === ['is_active']) { q('UPDATE recurring_transactions SET is_active = ? WHERE id = ? AND user_id = ?', [(new V($in))->bool('is_active'), $id, $uid]); json_ok(null, 'Updated.'); }
        $d = $validate($in);
        $next = $d['start_date'] !== $row['start_date'] ? $d['start_date'] : $row['next_due'];
        q('UPDATE recurring_transactions SET type=?, title=?, amount=?, category_id=?, account_id=?, frequency=?, interval_days=?, start_date=?, end_date=?, next_due=? WHERE id=? AND user_id=?',
            [$d['type'], $d['title'], $d['amount'], $d['category_id'], $d['account_id'], $d['frequency'], $d['interval_days'], $d['start_date'], $d['end_date'], $next, $id, $uid]);
        json_ok(null, 'Saved.');
    }
    if ($method === 'DELETE') { q('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [$id, $uid]); json_ok(null, 'Recurring item deleted. Past records were kept.'); }

    if ($method === 'POST' && in_array($sub, ['confirm', 'skip'], true)) {
        if (!$row['is_active']) throw new ApiException('This item is paused.', 409);
        $out = in_tx(function () use ($row, $uid, $sub) {
            $r = q_one('SELECT * FROM recurring_transactions WHERE id = ? FOR UPDATE', [$row['id']]);
            $occ = $r['next_due'];
            if ($sub === 'confirm') {
                $in = input();
                $v = new V($in);
                $date = $v->date('txn_date', 'Date', false) ?? $occ;
                $amount = $v->amount('amount', 'Amount', false) ?? $r['amount'];
                $v->done();
                if ($r['type'] === 'expense') TransactionService::assertFunds($uid, (int)$r['account_id'], $amount);
                if (q_val('SELECT id FROM transactions WHERE recurring_id = ? AND occurrence_date = ?', [$r['id'], $occ])) throw new ApiException('This occurrence was already recorded.', 409);
                TransactionService::insert(['user_id' => $uid, 'account_id' => $r['account_id'], 'type' => $r['type'], 'amount' => $amount, 'category_id' => $r['category_id'], 'title' => $r['title'],
                    'txn_date' => $date, 'recurring_id' => $r['id'], 'occurrence_date' => $occ]);
            }
            $next = recurring_next($r);
            q('UPDATE recurring_transactions SET next_due = ?, is_active = ? WHERE id = ?', [$next ?? $occ, $next ? 1 : 0, $r['id']]);
            return $next;
        });
        if ($sub === 'confirm' && $row['type'] === 'expense') BudgetService::checkAlerts($uid);
        json_ok(['next_due' => $out], $sub === 'confirm' ? 'Recorded.' : 'Skipped.');
    }
};
