<?php
declare(strict_types=1);

final class SubscriptionService
{
    private static array $cache = [];
    public static function flush(): void { self::$cache = []; }

    /**
     * Subscription state for one user.
     * status: trial_active | active | expiring_soon | expired   (+ payment_pending flag; suspended accounts cannot log in)
     * Rule: paid periods are stacked end-to-start and start after any remaining free trial.
     */
    public static function status(array $user): array
    {
        $uid = (int)$user['id'];
        if (isset(self::$cache[$uid])) return self::$cache[$uid];
        $now = now_utc();
        $subEnd = q_val('SELECT MAX(ends_at) FROM subscriptions WHERE user_id = ?', [$uid]);
        $subStart = q_val('SELECT MIN(starts_at) FROM subscriptions WHERE user_id = ?', [$uid]);
        $trialEnd = $user['trial_ends_at'] ?? null;
        $pending = (int)q_val("SELECT COUNT(*) FROM subscription_payments WHERE user_id = ? AND status = 'pending'", [$uid]) > 0;

        $inTrial = false; $endsAt = null;
        if ($subEnd && $subEnd > $now) {
            $status = 'active'; $endsAt = $subEnd;
            // The trial may still be running underneath a pre-paid period; the paid plan is what is shown.
        } elseif ($trialEnd && $trialEnd > $now && !$subEnd) {
            $status = 'trial_active'; $inTrial = true; $endsAt = $trialEnd;
        } elseif ($trialEnd && $trialEnd > $now) {
            $status = 'trial_active'; $inTrial = true; $endsAt = $trialEnd; // paid period (if any) already ended before trial end
        } else {
            $status = 'expired'; $endsAt = $subEnd ?: $trialEnd; $inTrial = !$subEnd;
        }
        $days = null;
        if ($status !== 'expired' && $endsAt) {
            $days = (int)ceil((strtotime($endsAt . ' UTC') - time()) / 86400);
            if ($status === 'active' && $days <= 7) $status = 'expiring_soon';
        }
        $display = ($pending && in_array($status, ['expired', 'expiring_soon'], true)) ? 'payment_pending' : $status;
        $labels = ['trial_active' => 'Trial Active', 'active' => 'Active', 'expiring_soon' => 'Expiring Soon', 'expired' => 'Expired', 'payment_pending' => 'Payment Pending'];

        return self::$cache[$uid] = [
            'status' => $status,
            'display_status' => $display,
            'label' => $labels[$display],
            'in_trial' => $inTrial,
            'full_access' => $status !== 'expired',
            'payment_pending' => $pending,
            'trial_started_at' => $user['trial_started_at'] ?? null,
            'trial_ends_at' => $trialEnd,
            'subscription_started_at' => $subStart,
            'subscription_ends_at' => $subEnd,
            'ends_at' => $endsAt,
            'days_remaining' => $days,
        ];
    }

    public static function defaultPlan(): ?array
    {
        return q_one('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY is_default DESC, id ASC LIMIT 1');
    }

    public static function addMonths(DateTimeImmutable $d, int $months): DateTimeImmutable
    {
        $target = $d->modify('first day of this month')->modify("+$months month");
        $day = min((int)$d->format('j'), (int)$target->format('t'));
        return $target->setDate((int)$target->format('Y'), (int)$target->format('n'), $day);
    }

    /**
     * Create one subscription period. Starts when the current coverage ends (or now if already expired).
     * $months uses the billing rule (calendar month, or fixed 30 days); $days is used for admin extensions.
     */
    public static function grant(int $uid, ?int $planId, int $months, string $source, ?int $by, ?string $note = null, ?int $days = null): array
    {
        $user = q_one('SELECT id, trial_ends_at FROM users WHERE id = ?', [$uid]);
        $utc = new DateTimeZone('UTC');
        $now = new DateTimeImmutable('now', $utc);
        $cover = q_val('SELECT MAX(ends_at) FROM subscriptions WHERE user_id = ?', [$uid]);
        $start = $now;
        foreach ([$cover, $user['trial_ends_at'] ?? null] as $c) {
            if ($c) { $c = new DateTimeImmutable($c, $utc); if ($c > $start) $start = $c; }
        }
        if ($days !== null) $end = $start->modify("+$days days");
        elseif (setting('billing_rule', 'calendar_month') === 'fixed_30') $end = $start->modify('+' . (30 * $months) . ' days');
        else $end = self::addMonths($start, $months);

        q('INSERT INTO subscriptions (user_id, plan_id, starts_at, ends_at, source, note, created_by) VALUES (?,?,?,?,?,?,?)',
            [$uid, $planId, $start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s'), $source, $note, $by]);
        $id = (int)db()->lastInsertId();
        self::flush();
        return ['id' => $id, 'starts_at' => $start->format('Y-m-d H:i:s'), 'ends_at' => $end->format('Y-m-d H:i:s')];
    }

    public static function fullStatusPayload(array $user): array
    {
        $st = self::status($user);
        $plan = self::defaultPlan();
        $st['plan'] = $plan ? ['id' => (int)$plan['id'], 'name' => $plan['name'], 'price' => $plan['price'], 'period_months' => (int)$plan['period_months']] : null;
        return $st;
    }
}
