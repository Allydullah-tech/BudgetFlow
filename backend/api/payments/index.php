<?php
declare(strict_types=1);

/** User side of manual subscription payments: submit details (status Pending), list own history, view own receipt. */
return function (string $method, array $p): void {
    $user = require_auth();
    require_feature('subscription', $user);
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) {
        json_ok(['items' => q_all("SELECT sp.id, sp.amount, sp.reference, sp.pay_date, sp.status, sp.reject_reason, sp.created_at, sp.reviewed_at, sp.receipt_file IS NOT NULL AS has_receipt, pl.name AS plan_name, pm.name AS method_name
                                   FROM subscription_payments sp JOIN subscription_plans pl ON pl.id = sp.plan_id JOIN payment_methods pm ON pm.id = sp.method_id WHERE sp.user_id = ? ORDER BY sp.id DESC", [$uid])]);
    }
    if ($method === 'POST' && $a === null) {
        $id = PaymentService::submit($user, input(), $_FILES['receipt'] ?? null);
        json_ok(['id' => $id, 'status' => 'pending'], 'Payment details submitted. We will review them and notify you.', 201);
    }
    if ($method === 'GET' && $a === 'receipt' && isset($p[1])) {
        $row = owned('subscription_payments', (int)$p[1], $uid);
        if (!$row['receipt_file']) throw new ApiException('No receipt attached.', 404);
        serve_private_file('receipts', $row['receipt_file']);
    }
};
