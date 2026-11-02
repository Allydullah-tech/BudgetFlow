<?php
declare(strict_types=1);

return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];
    $id = $p[0] ?? null;

    if ($method === 'GET' && $id === null) {
        $status = in_array($_GET['status'] ?? '', ['pending', 'approved', 'rejected'], true) ? $_GET['status'] : null;
        $sql = 'SELECT sp.id, sp.user_id, u.full_name, u.email, sp.amount, sp.reference, sp.pay_date, sp.status, sp.reject_reason, sp.created_at, sp.reviewed_at, sp.notes,
                sp.receipt_file IS NOT NULL AS has_receipt, pl.name AS plan_name, pl.price AS plan_price, pm.name AS method_name, rv.full_name AS reviewer
                FROM subscription_payments sp JOIN users u ON u.id = sp.user_id JOIN subscription_plans pl ON pl.id = sp.plan_id JOIN payment_methods pm ON pm.id = sp.method_id
                LEFT JOIN users rv ON rv.id = sp.reviewed_by' . ($status ? ' WHERE sp.status = ?' : '') . ' ORDER BY (sp.status = \'pending\') DESC, sp.id DESC LIMIT 500';
        json_ok(['items' => q_all($sql, $status ? [$status] : [])]);
    }
    if ($id === null || !ctype_digit($id)) return;
    $pid = (int)$id;
    $sub = $p[1] ?? null;

    if ($method === 'GET' && $sub === 'receipt') {
        $row = q_one('SELECT receipt_file FROM subscription_payments WHERE id = ?', [$pid]);
        if (!$row || !$row['receipt_file']) throw new ApiException('No receipt attached.', 404);
        audit($aid, 'receipt_viewed', 'subscription_payment', $pid);
        serve_private_file('receipts', $row['receipt_file']);
    }
    if ($method !== 'POST') return;
    if ($sub === 'approve') {
        $periods = isset(input()['periods']) && input()['periods'] !== '' ? (int)input()['periods'] : null;
        $r = PaymentService::approve($aid, $pid, $periods);
        json_ok($r, 'Payment approved and subscription activated.');
    }
    if ($sub === 'reject') {
        $reason = trim((string)(input()['reason'] ?? ''));
        PaymentService::reject($aid, $pid, $reason !== '' ? mb_substr($reason, 0, 255) : null);
        json_ok(null, 'Payment rejected.');
    }
};
