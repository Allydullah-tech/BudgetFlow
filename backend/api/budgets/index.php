<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('budgets');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) json_ok(['items' => BudgetService::list($uid)]);

    $validate = function (array $in) use ($uid): array {
        $v = new V($in);
        $d = [
            'name' => $v->str('name', 'Budget name', true, 100),
            'period' => $v->enum('period', 'Period', ['weekly', 'monthly', 'custom']),
            'category_id' => $v->id('category_id', 'Category', false),
            'amount' => $v->amount('amount', 'Budget amount'),
            'start_date' => null, 'end_date' => null,
        ];
        if ($d['period'] === 'custom') {
            $d['start_date'] = $v->date('start_date', 'Start date'); $d['end_date'] = $v->date('end_date', 'End date');
            if ($d['start_date'] && $d['end_date'] && $d['end_date'] < $d['start_date']) $v->fail('end_date', 'End date cannot be before the start date.');
        }
        $th = $v->has('alert_thresholds') ? (is_array($v->raw('alert_thresholds')) ? $v->raw('alert_thresholds') : explode(',', (string)$v->raw('alert_thresholds'))) : [50, 75, 90, 100];
        $th = array_values(array_unique(array_filter(array_map('intval', $th), fn($x) => $x >= 1 && $x <= 200)));
        sort($th);
        if (!$th) $v->fail('alert_thresholds', 'Enter at least one alert percentage between 1 and 200.');
        $d['alert_thresholds'] = implode(',', $th);
        $v->done();
        if ($d['category_id']) TransactionService::categoryOwned($uid, $d['category_id'], 'expense');
        return $d;
    };

    if ($method === 'POST' && $a === null) {
        $d = $validate(input());
        q('INSERT INTO budgets (user_id, name, period, category_id, amount, start_date, end_date, alert_thresholds) VALUES (?,?,?,?,?,?,?,?)',
            [$uid, $d['name'], $d['period'], $d['category_id'], $d['amount'], $d['start_date'], $d['end_date'], $d['alert_thresholds']]);
        $id = (int)db()->lastInsertId();
        audit($uid, 'budget_created', 'budget', $id);
        BudgetService::checkAlerts($uid);
        json_ok(['id' => $id], 'Budget created.', 201);
    }
    if ($a !== null && ctype_digit($a)) {
        $id = (int)$a; owned('budgets', $id, $uid);
        if ($method === 'PUT') {
            $in = input();
            if (array_keys($in) === ['is_active']) { q('UPDATE budgets SET is_active = ? WHERE id = ? AND user_id = ?', [(new V($in))->bool('is_active'), $id, $uid]); json_ok(null, 'Budget updated.'); }
            $d = $validate($in);
            q('UPDATE budgets SET name=?, period=?, category_id=?, amount=?, start_date=?, end_date=?, alert_thresholds=? WHERE id=? AND user_id=?',
                [$d['name'], $d['period'], $d['category_id'], $d['amount'], $d['start_date'], $d['end_date'], $d['alert_thresholds'], $id, $uid]);
            json_ok(null, 'Budget saved.');
        }
        if ($method === 'DELETE') { q('DELETE FROM budgets WHERE id = ? AND user_id = ?', [$id, $uid]); json_ok(null, 'Budget deleted.'); }
    }
};
