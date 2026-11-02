<?php
declare(strict_types=1);

final class BudgetService
{
    public static function period(array $b): array
    {
        $t = new DateTimeImmutable('today');
        if ($b['period'] === 'weekly') { $s = $t->modify('monday this week'); return [$s->format('Y-m-d'), $s->modify('+6 days')->format('Y-m-d')]; }
        if ($b['period'] === 'custom') return [$b['start_date'], $b['end_date']];
        return [$t->format('Y-m-01'), $t->modify('last day of this month')->format('Y-m-d')];
    }

    /** All budgets for a user with spent / remaining / percent / status. Only posted expenses count. */
    public static function list(int $uid, bool $activeOnly = false): array
    {
        $rows = q_all('SELECT b.*, c.name AS category_name FROM budgets b LEFT JOIN categories c ON c.id = b.category_id WHERE b.user_id = ?' . ($activeOnly ? ' AND b.is_active = 1' : '') . ' ORDER BY b.is_active DESC, b.id DESC', [$uid]);
        foreach ($rows as &$b) {
            [$from, $to] = self::period($b);
            $sql = "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE user_id = ? AND type = 'expense' AND status = 'posted' AND txn_date BETWEEN ? AND ?";
            $p = [$uid, $from, $to];
            if ($b['category_id']) { $sql .= ' AND category_id = ?'; $p[] = $b['category_id']; }
            $spent = (string)q_val($sql, $p);
            $remaining = to_cents($b['amount']) - to_cents($spent);
            $pct = to_cents($b['amount']) > 0 ? round(to_cents($spent) / to_cents($b['amount']) * 100, 1) : null;
            $b['period_from'] = $from; $b['period_to'] = $to;
            $b['spent'] = $spent; $b['remaining'] = from_cents($remaining); $b['percent_used'] = $pct;
            $b['status'] = $pct === null ? 'n/a' : ($pct >= 100 ? 'exceeded' : ($pct >= 75 ? 'warning' : 'on_track'));
        }
        return $rows;
    }

    /** Notify at the highest reached threshold (50/75/90/100 by default); each (budget, period, threshold) fires once. */
    public static function checkAlerts(int $uid): void
    {
        foreach (self::list($uid, true) as $b) {
            if ($b['percent_used'] === null) continue;
            $thr = array_filter(array_map('intval', explode(',', (string)$b['alert_thresholds'])));
            sort($thr);
            $hit = null;
            foreach ($thr as $t) if ($b['percent_used'] >= $t) $hit = $t;
            if ($hit === null) continue;
            $per = ['weekly' => 'weekly', 'monthly' => 'monthly', 'custom' => ''][$b['period']];
            $what = $b['category_name'] ? strtolower($b['category_name']) : 'overall spending';
            if ($hit >= 100) {
                $title = 'Budget exceeded';
                $body = trim("Warning: You have exceeded your $per $what budget (" . $b['name'] . '). Spent ' . money_fmt($b['spent']) . ' of ' . money_fmt($b['amount']) . '.');
            } else {
                $title = "Budget {$hit}% used";
                $body = "You have spent {$b['percent_used']}% of your " . trim("$per $what") . ' budget (' . $b['name'] . ').';
            }
            NotificationService::send($uid, $hit >= 100 ? 'budget_exceeded' : 'budget_warning', $title, $body, 'budgets.html', 'bud:' . $b['id'] . ':' . $b['period_from'] . ':' . $hit);
        }
    }
}
