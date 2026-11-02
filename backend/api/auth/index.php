<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $a = $p[0] ?? '';

    if ($method === 'GET' && $a === 'csrf') json_ok(['csrf' => csrf_token()]);

    if ($method === 'GET' && $a === 'me') {
        define('ET_SESSION_WRITE', true); // this call updates the session (checks timestamp), so keep it open
        $u = auth_user();
        if (!$u) json_ok(['authenticated' => false, 'csrf' => csrf_token()]);
        $uid = (int)$u['id'];
        if (empty($_SESSION['checks_at']) || time() - $_SESSION['checks_at'] > 600) {
            NotificationService::runUserChecks($uid);
            $_SESSION['checks_at'] = time();
        }
        $sub = SubscriptionService::fullStatusPayload($u);
        $allowed = json_decode((string)setting('expired_allowed_features', '[]'), true) ?: [];
        $settings = q_one('SELECT timezone, date_format, theme, notify_budget, notify_debt, notify_recurring, notify_savings FROM user_settings WHERE user_id = ?', [$uid]) ?: [];
        json_ok([
            'authenticated' => true,
            'csrf' => csrf_token(),
            'user' => ['id' => $uid, 'name' => $u['full_name'], 'email' => $u['email'], 'phone' => $u['phone'], 'role' => $u['role'], 'has_avatar' => (bool)$u['profile_image']],
            'settings' => $settings,
            'subscription' => $sub,
            'features' => ($u['role'] === 'super_admin' || $sub['full_access']) ? ['*'] : $allowed,
            'unread' => (int)q_val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0 AND dismissed_at IS NULL', [$uid]),
        ]);
    }

    if ($method !== 'POST') return;

    if ($a === 'register') { $r = AuthenticationService::register(input()); json_ok($r, 'Account created.', 201); }
    if ($a === 'login') { $r = AuthenticationService::login(input()); json_ok($r, 'Welcome back!'); }
    if ($a === 'logout') { AuthenticationService::logout(); json_ok(null, 'Logged out.'); }
    if ($a === 'forgot') {
        AuthenticationService::forgotPassword((string)(input()['email'] ?? ''));
        json_ok(null, 'If an account exists for that email, a reset link has been sent.');
    }
    if ($a === 'reset') {
        $in = input();
        AuthenticationService::resetPassword((string)($in['token'] ?? ''), (string)($in['password'] ?? ''), (string)($in['confirm_password'] ?? ''));
        json_ok(null, 'Password updated. You can now log in.');
    }
    if ($a === 'verify') { AuthenticationService::verifyEmail((string)(input()['token'] ?? '')); json_ok(null, 'Email verified. You can now log in.'); }
};
