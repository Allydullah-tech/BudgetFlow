<?php
declare(strict_types=1);

return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];
    $id = $p[0] ?? null;

    if ($method === 'GET' && $id === null) {
        $where = ["u.role = 'user'", 'u.deleted_at IS NULL']; $params = [];
        if (!empty($_GET['q'])) {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim((string)$_GET['q'])) . '%';
            $where[] = '(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR u.id = ?)'; array_push($params, $like, $like, $like, (int)$_GET['q']);
        }
        if (!empty($_GET['account_status']) && in_array($_GET['account_status'], ['active', 'suspended', 'pending_verification'], true)) { $where[] = 'u.status = ?'; $params[] = $_GET['account_status']; }
        $rows = q_all("SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, u.trial_started_at, u.trial_ends_at, u.last_login_at,
                       (SELECT MIN(starts_at) FROM subscriptions WHERE user_id = u.id) AS sub_start, (SELECT MAX(ends_at) FROM subscriptions WHERE user_id = u.id) AS sub_end,
                       (SELECT COALESCE(SUM(amount),0) FROM subscription_payments WHERE user_id = u.id AND status='approved') AS total_paid,
                       (SELECT MAX(reviewed_at) FROM subscription_payments WHERE user_id = u.id AND status='approved') AS last_payment,
                       (SELECT COUNT(*) FROM subscription_payments WHERE user_id = u.id AND status='pending') AS pending_count
                       FROM users u WHERE " . implode(' AND ', $where) . ' ORDER BY u.id DESC LIMIT 1000', $params);
        $want = $_GET['sub_status'] ?? '';
        $out = [];
        foreach ($rows as $r) {
            $st = SubscriptionService::status($r);
            $r['subscription_status'] = $st['status']; $r['subscription_label'] = $st['label']; $r['days_remaining'] = $st['days_remaining']; $r['trial_status'] = $st['in_trial'] ? ($st['status'] === 'expired' ? 'Trial ended' : 'On trial') : 'Converted';
            if ($want !== '' && $want !== $r['subscription_status']) continue;
            $out[] = $r;
        }
        [$page, $per, $off] = paginate_params(25);
        json_ok(['items' => array_slice($out, $off, $per), 'total' => count($out), 'pages' => (int)ceil(count($out) / $per), 'page' => $page]);
    }

    if ($id === null || !ctype_digit($id)) return;
    $uid = (int)$id;
    $u = q_one("SELECT id, full_name, email, phone, status, email_verified_at, created_at, last_login_at, trial_started_at, trial_ends_at FROM users WHERE id = ? AND role = 'user' AND deleted_at IS NULL", [$uid]);
    if (!$u) throw new ApiException('Customer not found.', 404);
    $sub = $p[1] ?? null;

    if ($method === 'GET' && $sub === null) {
        $u['subscription'] = SubscriptionService::status($u);
        $u['subscriptions'] = q_all('SELECT s.*, pl.name AS plan_name FROM subscriptions s LEFT JOIN subscription_plans pl ON pl.id = s.plan_id WHERE s.user_id = ? ORDER BY s.id DESC', [$uid]);
        $u['payments'] = q_all('SELECT sp.id, sp.amount, sp.reference, sp.pay_date, sp.status, sp.reject_reason, sp.created_at, sp.reviewed_at, pm.name AS method_name FROM subscription_payments sp JOIN payment_methods pm ON pm.id = sp.method_id WHERE sp.user_id = ? ORDER BY sp.id DESC', [$uid]);
        $u['activity'] = q_all("SELECT action, result, created_at FROM audit_logs WHERE actor_id = ? AND action IN ('login','login_failed','logout','password_changed','payment_submitted','register') ORDER BY id DESC LIMIT 15", [$uid]);
        json_ok($u);
    }
    if ($method !== 'POST') return;
    $in = input();

    if ($sub === 'suspend' || $sub === 'activate') {
        $new = $sub === 'suspend' ? 'suspended' : 'active';
        q('UPDATE users SET status = ? WHERE id = ?', [$new, $uid]);
        audit($aid, 'account_' . $new, 'user', $uid, 'success', ['reason' => mb_substr((string)($in['reason'] ?? ''), 0, 200)]);
        NotificationService::send($uid, 'security', $sub === 'suspend' ? 'Account suspended' : 'Account re-activated', $sub === 'suspend' ? 'Your account was suspended. Please contact support.' : 'Your account is active again.', null);
        json_ok(null, $sub === 'suspend' ? 'Account suspended.' : 'Account activated.');
    }
    if ($sub === 'extend') { // documented complimentary extension / free subscription
        $v = new V($in);
        $days = $v->id('days', 'Days'); $note = $v->str('note', 'Reason', true, 200);
        if ($days && $days > 1095) $v->fail('days', 'Maximum is 1095 days.');
        $v->done();
        $r = SubscriptionService::grant($uid, null, 0, 'complimentary', (int)$admin['id'], $note, $days);
        audit($aid, 'subscription_extended', 'user', $uid, 'success', ['days' => $days, 'note' => $note, 'ends_at' => $r['ends_at']]);
        NotificationService::send($uid, 'subscription', 'Subscription extended', "Your access was extended by $days day(s), until " . substr($r['ends_at'], 0, 10) . '.', 'subscription.html');
        json_ok($r, 'Subscription extended.');
    }
    if ($sub === 'notify') {
        $v = new V($in); $title = $v->str('title', 'Title', true, 160); $body = $v->str('body', 'Message', true, 2000); $v->done();
        NotificationService::send($uid, 'admin_message', $title, $body, null);
        audit($aid, 'customer_notified', 'user', $uid);
        json_ok(null, 'Message sent.');
    }
};
