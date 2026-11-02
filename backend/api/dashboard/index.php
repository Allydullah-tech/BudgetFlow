<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('dashboard_basic');
    $uid = (int)$user['id'];
    $a = $p[0] ?? 'summary';
    if ($method !== 'GET') return;

    if ($a === 'summary') {
        NotificationService::runUserChecks($uid);
        $data = FinancialCalculationService::summaryCards($uid);
        $data['subscription'] = SubscriptionService::fullStatusPayload($user);
        $data['recent'] = q_all("SELECT t.id, t.type, t.title, t.amount, t.txn_date, COALESCE(c.name,'') AS category_name FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
                                 WHERE t.user_id = ? AND t.status='posted' ORDER BY t.txn_date DESC, t.id DESC LIMIT 6", [$uid]);
        $data['upcoming_debts'] = q_all("SELECT d.id, d.party_name, d.direction, d.due_date, d.principal - COALESCE(p.paid,0) AS remaining FROM debts d
                                         LEFT JOIN (SELECT debt_id, SUM(principal_amount) paid FROM debt_payments WHERE status='posted' GROUP BY debt_id) p ON p.debt_id = d.id
                                         WHERE d.user_id = ? AND d.cancelled_at IS NULL AND d.due_date IS NOT NULL HAVING remaining > 0 ORDER BY d.due_date LIMIT 4", [$uid]);
        $data['analytics_available'] = feature_allowed('analytics', $user);
        json_ok($data);
    }

    if ($a === 'insights') { require_feature('insights', $user); json_ok(FinancialCalculationService::insights($uid)); }

    if ($a === 'charts') {
        require_feature('analytics', $user);
        $period = in_array($_GET['period'] ?? '', ['week', 'month', 'year', 'years'], true) ? $_GET['period'] : 'month';
        $t = new DateTimeImmutable('today');
        [$from, $to, $gran] = match ($period) {
            'week' => [$t->modify('-6 days')->format('Y-m-d'), $t->format('Y-m-d'), 'day'],
            'year' => [$t->format('Y-01-01'), $t->format('Y-12-31'), 'month'],
            'years' => [$t->modify('-4 years')->format('Y-01-01'), $t->format('Y-12-31'), 'year'],
            default => [$t->format('Y-m-01'), $t->modify('last day of this month')->format('Y-m-d'), 'day'],
        };
        $spend = in_array($_GET['spend'] ?? '', ['day', 'week', 'month', 'year'], true) ? $_GET['spend'] : 'day';
        [$sf, $st] = match ($spend) {
            'week' => [$t->modify('monday this week')->modify('-11 weeks')->format('Y-m-d'), $t->format('Y-m-d')],
            'month' => [$t->modify('first day of -11 months')->format('Y-m-d'), $t->format('Y-m-d')],
            'year' => [$t->modify('-4 years')->format('Y-01-01'), $t->format('Y-m-d')],
            default => [$t->modify('-29 days')->format('Y-m-d'), $t->format('Y-m-d')],
        };
        $debts = array_values(array_filter(FinancialCalculationService::debts($uid), fn($d) => !in_array($d['status'], ['cancelled'], true)));
        json_ok([
            'period' => $period, 'range' => ['from' => $from, 'to' => $to],
            'flow' => FinancialCalculationService::series($uid, $from, $to, $gran),
            'spending' => ['granularity' => $spend, 'series' => FinancialCalculationService::series($uid, $sf, $st, $spend)],
            'expense_categories' => FinancialCalculationService::categoryBreakdown($uid, 'expense', $from, $to),
            'income_sources' => FinancialCalculationService::categoryBreakdown($uid, 'income', $from, $to),
            'budgets' => array_map(fn($b) => ['name' => $b['name'], 'budget' => $b['amount'], 'spent' => $b['spent'], 'percent' => $b['percent_used']], BudgetService::list($uid, true)),
            'debts' => array_map(fn($d) => ['party' => $d['party_name'], 'direction' => $d['direction'], 'principal' => $d['principal'], 'paid' => $d['paid'], 'percent' => $d['percent_paid'], 'status' => $d['status']], $debts),
            'savings' => array_map(fn($g) => ['name' => $g['name'], 'saved' => $g['balance'], 'target' => $g['target_amount'], 'percent' => $g['percent']], array_values(array_filter(FinancialCalculationService::savingsGoals($uid), fn($g) => $g['is_active']))),
        ]);
    }
};
