<?php
declare(strict_types=1);

return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];
    $id = $p[0] ?? null;
    if ($method === 'GET') json_ok(['items' => q_all('SELECT * FROM subscription_plans ORDER BY is_default DESC, id')]);

    $validate = function (array $in): array {
        $v = new V($in);
        $d = ['name' => $v->str('name', 'Plan name', true, 80), 'price' => $v->amount('price', 'Price', true, true), 'period_months' => $v->id('period_months', 'Months'), 'is_active' => $v->bool('is_active'), 'is_default' => $v->bool('is_default')];
        if ($d['period_months'] && $d['period_months'] > 36) $v->fail('period_months', 'Maximum is 36 months.');
        $v->done();
        return $d;
    };
    if ($method === 'POST' && $id === null) {
        $d = $validate(input() + ['is_active' => 1]);
        in_tx(function () use ($d) {
            if ($d['is_default']) q('UPDATE subscription_plans SET is_default = 0');
            q('INSERT INTO subscription_plans (name, price, period_months, is_active, is_default) VALUES (?,?,?,?,?)', [$d['name'], $d['price'], $d['period_months'], $d['is_active'], $d['is_default']]);
        });
        audit($aid, 'plan_created', 'plan', db()->lastInsertId(), 'success', ['price' => $d['price']]);
        json_ok(null, 'Plan created.', 201);
    }
    if ($method === 'PUT' && $id !== null && ctype_digit($id)) {
        $d = $validate(input());
        in_tx(function () use ($d, $id) {
            if ($d['is_default']) q('UPDATE subscription_plans SET is_default = 0');
            q('UPDATE subscription_plans SET name=?, price=?, period_months=?, is_active=?, is_default=? WHERE id=?', [$d['name'], $d['price'], $d['period_months'], $d['is_active'], $d['is_default'], (int)$id]);
        });
        audit($aid, 'plan_updated', 'plan', $id, 'success', ['price' => $d['price']]);
        json_ok(null, 'Plan saved. New price applies to future payments.');
    }
};
