<?php
declare(strict_types=1);

return function (array $admin, string $method, array $p): void {
    if ($method !== 'GET') return;
    NotificationService::publishDueAnnouncements();
    [$from, $to, $label] = resolve_range((string)($_GET['range'] ?? 'year'), $_GET['from'] ?? null, $_GET['to'] ?? null);
    $fromTs = $from . ' 00:00:00'; $toTs = $to . ' 23:59:59';

    $users = q_all("SELECT id, role, status, trial_started_at, trial_ends_at, created_at FROM users WHERE role = 'user' AND deleted_at IS NULL");
    $counts = ['trial_active' => 0, 'active' => 0, 'expiring_soon' => 0, 'expired' => 0];
    foreach ($users as $u) { $st = SubscriptionService::status($u); $counts[$st['status']]++; }
    $ever = (int)q_val("SELECT COUNT(DISTINCT user_id) FROM subscription_payments WHERE status='approved'");
    $totalUsers = count($users);
    $newInRange = (int)q_val("SELECT COUNT(*) FROM users WHERE role='user' AND deleted_at IS NULL AND created_at BETWEEN ? AND ?", [$fromTs, $toTs]);
    $pay = q_one("SELECT SUM(status='pending') AS pending, SUM(status='approved') AS approved, SUM(status='rejected') AS rejected,
                  COALESCE(SUM(CASE WHEN status='approved' THEN amount END),0) AS revenue,
                  COALESCE(SUM(CASE WHEN status='approved' AND reviewed_at BETWEEN ? AND ? THEN amount END),0) AS revenue_range
                  FROM subscription_payments", [$fromTs, $toTs]);
    $monthRev = (string)q_val("SELECT COALESCE(SUM(amount),0) FROM subscription_payments WHERE status='approved' AND reviewed_at >= ?", [gmdate('Y-m-01 00:00:00')]);
    $renewals = (int)q_val("SELECT COUNT(*) FROM (SELECT user_id FROM subscription_payments WHERE status='approved' GROUP BY user_id HAVING COUNT(*) > 1) x");
    $decided = (int)$pay['approved'] + (int)$pay['rejected'];

    $gran = ((new DateTime($from))->diff(new DateTime($to))->days > 92) ? '%Y-%m' : '%Y-%m-%d';
    $regs = q_all("SELECT DATE_FORMAT(created_at, '$gran') AS k, COUNT(*) AS n FROM users WHERE role='user' AND deleted_at IS NULL AND created_at BETWEEN ? AND ? GROUP BY k ORDER BY k", [$fromTs, $toTs]);
    $rev = q_all("SELECT DATE_FORMAT(reviewed_at, '$gran') AS k, SUM(amount) AS total, COUNT(*) AS n FROM subscription_payments WHERE status='approved' AND reviewed_at BETWEEN ? AND ? GROUP BY k ORDER BY k", [$fromTs, $toTs]);
    $monthly = q_all("SELECT DATE_FORMAT(reviewed_at, '%Y-%m') AS k, SUM(amount) AS total FROM subscription_payments WHERE status='approved' AND reviewed_at >= ? GROUP BY k ORDER BY k", [gmdate('Y-m-01 00:00:00', strtotime('-11 months'))]);

    json_ok([
        'range' => ['from' => $from, 'to' => $to, 'label' => $label],
        'cards' => [
            'total_users' => $totalUsers, 'active_users' => count(array_filter($users, fn($u) => $u['status'] === 'active')), 'new_registrations' => $newInRange,
            'on_trial' => $counts['trial_active'], 'active_subscriptions' => $counts['active'] + $counts['expiring_soon'], 'expired' => $counts['expired'],
            'pending_payments' => (int)$pay['pending'], 'approved_payments' => (int)$pay['approved'], 'rejected_payments' => (int)$pay['rejected'],
            'revenue_total' => $pay['revenue'], 'revenue_range' => $pay['revenue_range'], 'revenue_this_month' => $monthRev,
            'trial_conversion_percent' => $totalUsers ? round($ever / $totalUsers * 100, 1) : null,
            'renewal_rate_percent' => $ever ? round($renewals / $ever * 100, 1) : null,
            'approval_rate_percent' => $decided ? round((int)$pay['approved'] / $decided * 100, 1) : null,
        ],
        'charts' => ['registrations' => $regs, 'subscription_status' => $counts, 'revenue' => $rev, 'monthly_revenue' => $monthly,
                     'approval' => ['approved' => (int)$pay['approved'], 'rejected' => (int)$pay['rejected'], 'pending' => (int)$pay['pending']],
                     'conversion' => ['paid' => $ever, 'never_paid' => max(0, $totalUsers - $ever)]],
    ]);
};
