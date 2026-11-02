<?php
declare(strict_types=1);

final class NotificationService
{
    /** Create a notification. A dedupe key makes the call idempotent (no duplicate reminders). */
    public static function send(int $uid, string $type, string $title, ?string $body = null, ?string $link = null, ?string $dedupe = null): bool
    {
        $st = q('INSERT IGNORE INTO notifications (user_id, type, title, body, link, dedupe_key) VALUES (?,?,?,?,?,?)',
            [$uid, $type, mb_substr($title, 0, 160), $body, $link, $dedupe]);
        return $st->rowCount() > 0;
    }

    public static function toAdmins(string $type, string $title, ?string $body, ?string $link, ?string $dedupe = null): void
    {
        foreach (q_all("SELECT id FROM users WHERE role='super_admin' AND status='active' AND deleted_at IS NULL") as $a) {
            self::send((int)$a['id'], $type, $title, $body, $link, $dedupe ? $dedupe . ':' . $a['id'] : null);
        }
    }

    private static function pref(int $uid, string $col): bool
    {
        $v = q_val("SELECT $col FROM user_settings WHERE user_id = ?", [$uid]);
        return $v === null ? true : (bool)$v;
    }

    /** Cheap, idempotent checks run when a user opens the app (the cron job runs the same for everyone). */
    public static function runUserChecks(int $uid): void
    {
        $user = q_one('SELECT id, role, status, trial_ends_at, trial_started_at FROM users WHERE id = ?', [$uid]);
        if (!$user) return;
        self::publishDueAnnouncements();
        self::subscriptionReminders($user);
        if (self::pref($uid, 'notify_debt')) self::debtReminders($uid);
        if (self::pref($uid, 'notify_recurring')) self::recurringReminders($uid);
        if (self::pref($uid, 'notify_budget')) BudgetService::checkAlerts($uid);
    }

    public static function subscriptionReminders(array $user): void
    {
        if ($user['role'] === 'super_admin') return;
        $uid = (int)$user['id'];
        $st = SubscriptionService::status($user);
        $days = array_filter(array_map('intval', explode(',', (string)setting('reminder_days', '7,3,1'))));
        rsort($days);
        $left = $st['days_remaining'];
        if ($st['status'] === 'trial_active' || $st['status'] === 'expiring_soon' || $st['status'] === 'active') {
            $endKey = $st['ends_at'];
            $label = $st['in_trial'] ? 'free trial' : 'subscription';
            foreach ($days as $d) {
                if ($left !== null && $left <= $d) {
                    $smallest = true;
                    foreach ($days as $d2) if ($d2 < $d && $left <= $d2) $smallest = false;
                    if ($smallest) {
                        self::send($uid, $st['in_trial'] ? 'trial_reminder' : 'subscription_reminder',
                            ucfirst($label) . ' ends in ' . max(1, $left) . ' day' . ($left > 1 ? 's' : ''),
                            "Your $label ends on " . substr((string)$endKey, 0, 10) . '. Renew to keep full access.',
                            'subscription.html', "rem:$label:$endKey:$d");
                    }
                }
            }
        } elseif ($st['status'] === 'expired') {
            $endKey = $st['ends_at'] ?? 'none';
            self::send($uid, 'subscription_expired', $st['in_trial'] ?? true ? 'Your free trial has ended' : 'Your subscription has expired',
                (string)setting('msg_expired'), 'subscription.html', "expired:$endKey");
        }
    }

    public static function debtReminders(int $uid): void
    {
        $today = today();
        $soon = (new DateTimeImmutable('today'))->modify('+3 days')->format('Y-m-d');
        $rows = q_all("SELECT d.id, d.party_name, d.direction, d.due_date, d.principal - COALESCE(p.paid,0) AS remaining
                       FROM debts d LEFT JOIN (SELECT debt_id, SUM(principal_amount) paid FROM debt_payments WHERE status='posted' GROUP BY debt_id) p ON p.debt_id = d.id
                       WHERE d.user_id = ? AND d.cancelled_at IS NULL AND d.due_date IS NOT NULL AND d.due_date <= ?
                       HAVING remaining > 0", [$uid, $soon]);
        foreach ($rows as $d) {
            $who = $d['direction'] === 'owed_by_me' ? 'You owe ' . $d['party_name'] : $d['party_name'] . ' owes you';
            if ($d['due_date'] < $today) {
                self::send($uid, 'debt_overdue', 'Overdue debt', "$who " . money_fmt($d['remaining']) . ' - due ' . $d['due_date'] . '.', 'debts.html', 'debt-over:' . $d['id']);
            } else {
                self::send($uid, 'debt_due', 'Debt due soon', "$who " . money_fmt($d['remaining']) . ' - due ' . $d['due_date'] . '.', 'debts.html', 'debt-due:' . $d['id'] . ':' . $d['due_date']);
            }
        }
    }

    public static function recurringReminders(int $uid): void
    {
        foreach (q_all('SELECT id, title, next_due, type FROM recurring_transactions WHERE user_id = ? AND is_active = 1 AND next_due <= ?', [$uid, today()]) as $r) {
            self::send($uid, 'recurring_due', 'Recurring ' . $r['type'] . ' due: ' . $r['title'], 'Scheduled for ' . $r['next_due'] . '. Open Recurring to confirm it.', 'recurring.html', 'rec:' . $r['id'] . ':' . $r['next_due']);
        }
    }

    /** Publish announcements whose scheduled time has arrived (or that were published immediately). */
    public static function publishDueAnnouncements(): void
    {
        $rows = q_all("SELECT * FROM announcements WHERE published_at IS NULL AND scheduled_at IS NOT NULL AND scheduled_at <= ?", [now_utc()]);
        foreach ($rows as $a) self::publishAnnouncement($a, (int)$a['created_by']);
    }

    public static function publishAnnouncement(array $a, int $byId): int
    {
        $users = self::audienceUsers($a['audience'], $a['target_user_ids']);
        $n = 0;
        foreach ($users as $u) {
            if (self::send((int)$u, 'announcement', $a['title'], $a['body'], null, 'ann:' . $a['id'])) $n++;
        }
        q('UPDATE announcements SET published_at = ?, published_by = ? WHERE id = ? AND published_at IS NULL', [now_utc(), $byId, $a['id']]);
        return $n;
    }

    public static function audienceUsers(string $audience, ?string $targets): array
    {
        $users = q_all("SELECT id, role, trial_ends_at, trial_started_at FROM users WHERE status='active' AND deleted_at IS NULL");
        $ids = [];
        $sel = $audience === 'selected' ? array_map('intval', json_decode((string)$targets, true) ?: []) : [];
        foreach ($users as $u) {
            $st = $u['role'] === 'super_admin' ? ['status' => 'active'] : SubscriptionService::status($u);
            $ok = match ($audience) {
                'all' => true,
                'trial' => $st['status'] === 'trial_active',
                'active' => in_array($st['status'], ['active', 'expiring_soon'], true),
                'expired' => $st['status'] === 'expired',
                'selected' => in_array((int)$u['id'], $sel, true),
                default => false,
            };
            if ($ok) $ids[] = (int)$u['id'];
        }
        return $ids;
    }
}
