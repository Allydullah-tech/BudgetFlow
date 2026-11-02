<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_auth();
    require_feature('subscription', $user);
    $uid = (int)$user['id'];
    $a = $p[0] ?? 'status';

    if ($method === 'GET' && $a === 'status') {
        $methods = q_all('SELECT id, name, kind, provider, recipient_name, account_number, instructions, qr_file IS NOT NULL AS has_qr FROM payment_methods WHERE is_active = 1 ORDER BY sort_order, id');
        $plans = q_all('SELECT id, name, price, period_months, is_default FROM subscription_plans WHERE is_active = 1 ORDER BY is_default DESC, price');
        $history = q_all("SELECT s.id, s.starts_at, s.ends_at, s.source, s.note, p.name AS plan_name FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id WHERE s.user_id = ? ORDER BY s.id DESC", [$uid]);
        json_ok(['subscription' => SubscriptionService::fullStatusPayload($user), 'plans' => $plans, 'methods' => $methods, 'history' => $history,
                 'expired_message' => setting('msg_expired', ''), 'billing_rule' => setting('billing_rule', 'calendar_month')]);
    }
    // Payment QR codes: served only to logged-in users, for active methods.
    if ($method === 'GET' && $a === 'qr' && isset($p[1])) {
        $m = q_one('SELECT qr_file FROM payment_methods WHERE id = ? AND is_active = 1 AND qr_file IS NOT NULL', [(int)$p[1]]);
        if (!$m) throw new ApiException('QR code not found.', 404);
        serve_private_file('qr', $m['qr_file']);
    }
};
