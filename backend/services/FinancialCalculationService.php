<?php
declare(strict_types=1);

/**
 * Single source of truth for all financial figures. Rules (also in README "Accounting rules"):
 *  - Income = ledger rows of type 'income'; Expenses = type 'expense'. Nothing else counts.
 *  - Transfers, debt principal, and savings moves change balances but are NOT income or expenses.
 *  - Reversed rows (status='reversed') are excluded everywhere.
 *  - Net cash flow = income - expenses.
 *  - Remaining debt = principal - SUM(posted principal repayments). Interest is recorded separately
 *    (interest paid = expense "Debt interest", interest received = income "Interest").
 *  - Dates are local calendar dates, inclusive on both ends.
 */
final class FinancialCalculationService
{
    public const IN_TYPES = ['income', 'transfer_in', 'debt_borrowed', 'debt_collected', 'savings_withdrawal'];
    public const OUT_TYPES = ['expense', 'transfer_out', 'debt_lent', 'debt_repaid', 'savings_contribution'];

    public static function signedSql(string $alias = 't'): string
    {
        $in = "'" . implode("','", self::IN_TYPES) . "'";
        $out = "'" . implode("','", self::OUT_TYPES) . "'";
        return "CASE WHEN $alias.type IN ($in) THEN $alias.amount WHEN $alias.type IN ($out) THEN -$alias.amount ELSE 0 END";
    }

    public static function accountBalances(int $uid, bool $activeOnly = false, ?string $asOfDate = null): array
    {
        $sql = 'SELECT a.id, a.name, a.type, a.currency, a.opening_balance, a.is_active,
                  a.opening_balance + COALESCE(SUM(' . self::signedSql('t') . '),0) AS balance
                FROM financial_accounts a
                LEFT JOIN transactions t ON t.account_id = a.id AND t.status = \'posted\'' . ($asOfDate ? ' AND t.txn_date <= ?' : '') . '
                WHERE a.user_id = ?' . ($activeOnly ? ' AND a.is_active = 1' : '') . ' GROUP BY a.id ORDER BY a.is_active DESC, a.id';
        return q_all($sql, $asOfDate ? [$asOfDate, $uid] : [$uid]);
    }

    public static function totalBalance(int $uid, ?string $asOf = null): string
    {
        $c = 0;
        foreach (self::accountBalances($uid, true, $asOf) as $a) $c += to_cents($a['balance']);
        return from_cents($c);
    }

    public static function totals(int $uid, string $from, string $to): array
    {
        $r = q_one("SELECT
              COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expenses,
              COUNT(CASE WHEN type='income' THEN 1 END) AS income_count,
              COUNT(CASE WHEN type='expense' THEN 1 END) AS expense_count,
              MAX(CASE WHEN type='income' THEN amount END) AS max_income,
              MAX(CASE WHEN type='expense' THEN amount END) AS max_expense,
              MIN(CASE WHEN type='expense' THEN amount END) AS min_expense
            FROM transactions WHERE user_id = ? AND status='posted' AND txn_date BETWEEN ? AND ?", [$uid, $from, $to]);
        $r['net'] = from_cents(to_cents($r['income']) - to_cents($r['expenses']));
        $days = (int)((new DateTime($from))->diff(new DateTime($to))->days) + 1;
        $r['days'] = $days;
        $r['avg_daily_income'] = from_cents((int)round(to_cents($r['income']) / $days));
        $r['avg_daily_expense'] = from_cents((int)round(to_cents($r['expenses']) / $days));
        return $r;
    }

    public static function pctChange($current, $previous): ?float
    {
        $p = to_cents($previous);
        if ($p === 0) return null;
        return round((to_cents($current) - $p) / $p * 100, 1);
    }

    public static function previousRange(string $from, string $to): array
    {
        $f = new DateTimeImmutable($from); $t = new DateTimeImmutable($to);
        $days = $f->diff($t)->days + 1;
        // Whole calendar months compare with the previous calendar month; everything else with the same-length window before.
        if ($f->format('j') === '1' && $t->format('Y-m-d') === $f->modify('last day of this month')->format('Y-m-d')) {
            $pf = $f->modify('first day of last month');
            return [$pf->format('Y-m-d'), $pf->modify('last day of this month')->format('Y-m-d')];
        }
        return [$f->modify("-$days days")->format('Y-m-d'), $f->modify('-1 day')->format('Y-m-d')];
    }

    public static function categoryBreakdown(int $uid, string $type, string $from, string $to): array
    {
        $rows = q_all("SELECT COALESCE(c.name,'Uncategorized') AS name, SUM(t.amount) AS total, COUNT(*) AS cnt
                       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
                       WHERE t.user_id = ? AND t.type = ? AND t.status='posted' AND t.txn_date BETWEEN ? AND ?
                       GROUP BY name ORDER BY total DESC", [$uid, $type, $from, $to]);
        $sum = 0; foreach ($rows as $r) $sum += to_cents($r['total']);
        foreach ($rows as &$r) $r['percent'] = $sum ? round(to_cents($r['total']) / $sum * 100, 1) : 0;
        return $rows;
    }

    /** Income vs expenses grouped by day | week | month | year. */
    public static function series(int $uid, string $from, string $to, string $gran = 'day'): array
    {
        $key = match ($gran) {
            'week' => "DATE_FORMAT(DATE_SUB(txn_date, INTERVAL WEEKDAY(txn_date) DAY), '%Y-%m-%d')",
            'month' => "DATE_FORMAT(txn_date, '%Y-%m')",
            'year' => "DATE_FORMAT(txn_date, '%Y')",
            default => "DATE_FORMAT(txn_date, '%Y-%m-%d')",
        };
        $rows = q_all("SELECT $key AS k,
              COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expenses
            FROM transactions WHERE user_id = ? AND status='posted' AND type IN ('income','expense') AND txn_date BETWEEN ? AND ?
            GROUP BY k ORDER BY k", [$uid, $from, $to]);
        $by = []; foreach ($rows as $r) $by[$r['k']] = $r;
        // Fill gaps so charts and averages include zero days.
        $out = [];
        $cur = new DateTimeImmutable($from); $end = new DateTimeImmutable($to);
        if ($gran === 'week') $cur = $cur->modify('monday this week');
        if ($gran === 'month') $cur = $cur->modify('first day of this month');
        if ($gran === 'year') $cur = $cur->setDate((int)$cur->format('Y'), 1, 1);
        $step = ['day' => '+1 day', 'week' => '+1 week', 'month' => '+1 month', 'year' => '+1 year'][$gran] ?? '+1 day';
        $fmt = ['day' => 'Y-m-d', 'week' => 'Y-m-d', 'month' => 'Y-m', 'year' => 'Y'][$gran] ?? 'Y-m-d';
        $guard = 0;
        while ($cur <= $end && $guard++ < 2000) {
            $k = $cur->format($fmt);
            $inc = $by[$k]['income'] ?? '0.00'; $exp = $by[$k]['expenses'] ?? '0.00';
            $out[] = ['key' => $k, 'income' => $inc, 'expenses' => $exp, 'net' => from_cents(to_cents($inc) - to_cents($exp))];
            $cur = $cur->modify($step);
        }
        return $out;
    }

    public static function debtSummary(int $uid): array
    {
        $rows = self::debts($uid);
        $by = 0; $to = 0; $over = 0;
        foreach ($rows as $d) {
            if (in_array($d['status'], ['paid', 'cancelled'], true)) continue;
            if ($d['direction'] === 'owed_by_me') $by += to_cents($d['remaining']); else $to += to_cents($d['remaining']);
            if ($d['status'] === 'overdue') $over++;
        }
        return ['owed_by_me' => from_cents($by), 'owed_to_me' => from_cents($to), 'overdue_count' => $over];
    }

    public static function debts(int $uid, ?int $id = null): array
    {
        $sql = "SELECT d.*, COALESCE(p.paid,0) AS paid, COALESCE(p.interest,0) AS interest_paid, d.principal - COALESCE(p.paid,0) AS remaining
                FROM debts d LEFT JOIN (SELECT debt_id, SUM(principal_amount) paid, SUM(interest_amount) interest FROM debt_payments WHERE status='posted' GROUP BY debt_id) p ON p.debt_id = d.id
                WHERE d.user_id = ?" . ($id ? ' AND d.id = ?' : '') . ' ORDER BY d.cancelled_at IS NOT NULL, d.due_date IS NULL, d.due_date, d.id DESC';
        $rows = q_all($sql, $id ? [$uid, $id] : [$uid]);
        $today = today();
        foreach ($rows as &$d) {
            $rem = to_cents($d['remaining']);
            $d['percent_paid'] = round(to_cents($d['paid']) / to_cents($d['principal']) * 100, 1);
            if ($d['cancelled_at']) $d['status'] = 'cancelled';
            elseif ($rem <= 0) $d['status'] = 'paid';
            elseif ($d['due_date'] && $d['due_date'] < $today) $d['status'] = 'overdue';
            elseif (to_cents($d['paid']) > 0) $d['status'] = 'partial';
            else $d['status'] = 'unpaid';
        }
        return $rows;
    }

    public static function savingsGoals(int $uid): array
    {
        $rows = q_all("SELECT g.*, COALESCE(SUM(CASE WHEN t.type='savings_contribution' THEN t.amount WHEN t.type='savings_withdrawal' THEN -t.amount END),0) AS balance
                       FROM savings_goals g LEFT JOIN transactions t ON t.goal_id = g.id AND t.status='posted'
                       WHERE g.user_id = ? GROUP BY g.id ORDER BY g.is_active DESC, g.id DESC", [$uid]);
        foreach ($rows as &$g) {
            $g['percent'] = round(max(0, to_cents($g['balance'])) / to_cents($g['target_amount']) * 100, 1);
            $g['remaining'] = from_cents(max(0, to_cents($g['target_amount']) - to_cents($g['balance'])));
        }
        return $rows;
    }

    public static function totalSavings(int $uid): string
    {
        $c = 0; foreach (self::savingsGoals($uid) as $g) $c += to_cents($g['balance']);
        return from_cents($c);
    }

    /** Dashboard cards. $month = current calendar month. */
    public static function summaryCards(int $uid): array
    {
        $from = (new DateTimeImmutable('today'))->format('Y-m-01');
        $to = (new DateTimeImmutable('today'))->modify('last day of this month')->format('Y-m-d');
        $t = self::totals($uid, $from, $to);
        $debt = self::debtSummary($uid);
        $budgets = array_values(array_filter(BudgetService::list($uid, true), fn($b) => $b['period'] === 'monthly' && !$b['category_id']));
        return [
            'range' => ['from' => $from, 'to' => $to, 'label' => 'This month'],
            'total_income' => $t['income'],
            'total_expenses' => $t['expenses'],
            'net_cash_flow' => $t['net'],
            'current_balance' => self::totalBalance($uid),
            'outstanding_debts' => $debt['owed_by_me'],
            'debts_owed_to_me' => $debt['owed_to_me'],
            'savings_balance' => self::totalSavings($uid),
            'remaining_budget' => $budgets ? $budgets[0]['remaining'] : null,
        ];
    }

    /** Insights computed only from real records; returns plain-language sentences plus raw numbers. */
    public static function insights(int $uid): array
    {
        $t0 = new DateTimeImmutable('today');
        $from = $t0->format('Y-m-01'); $to = $t0->format('Y-m-d');
        $cur = self::totals($uid, $from, $t0->modify('last day of this month')->format('Y-m-d'));
        $pf = $t0->modify('first day of last month');
        $prev = self::totals($uid, $pf->format('Y-m-d'), $pf->modify('last day of this month')->format('Y-m-d'));
        $sentences = []; $m = [];

        $m['spending_this_month'] = $cur['expenses'];
        $m['spending_last_month'] = $prev['expenses'];
        $change = self::pctChange($cur['expenses'], $prev['expenses']);
        $m['spending_change_percent'] = $change;
        if ($change !== null) {
            $sentences[] = $change >= 0
                ? "Your expenses increased by " . abs($change) . "% compared with last month."
                : "Your expenses decreased by " . abs($change) . "% compared with last month.";
        } elseif (to_cents($cur['expenses']) > 0) {
            $sentences[] = 'There is no spending recorded last month yet, so a comparison is not possible.';
        }

        $elapsed = (int)$t0->format('j');
        $m['avg_daily_expense_month_to_date'] = from_cents((int)round(to_cents($cur['expenses']) / max(1, $elapsed)));
        $m['avg_daily_income_month_to_date'] = from_cents((int)round(to_cents($cur['income']) / max(1, $elapsed)));
        $m['average_note'] = "Daily averages use the $elapsed day(s) elapsed this month, including days without transactions.";

        $cats = self::categoryBreakdown($uid, 'expense', $from, $to);
        $m['top_categories'] = array_slice($cats, 0, 3);
        if ($cats) $sentences[] = 'You spend the most on ' . $cats[0]['name'] . ' (' . $cats[0]['percent'] . '% of this month\'s spending).';

        $days = q_all("SELECT txn_date d, SUM(amount) s FROM transactions WHERE user_id = ? AND type='expense' AND status='posted' AND txn_date BETWEEN ? AND ? GROUP BY d ORDER BY s DESC", [$uid, $from, $to]);
        if ($days) {
            $m['highest_spending_day'] = ['date' => $days[0]['d'], 'amount' => $days[0]['s']];
            $m['lowest_spending_day'] = ['date' => end($days)['d'], 'amount' => end($days)['s']];
        }
        $m['largest_expense'] = q_one("SELECT title, amount, txn_date FROM transactions WHERE user_id=? AND type='expense' AND status='posted' AND txn_date BETWEEN ? AND ? ORDER BY amount DESC LIMIT 1", [$uid, $from, $to]);
        $m['largest_income'] = q_one("SELECT title, amount, txn_date FROM transactions WHERE user_id=? AND type='income' AND status='posted' AND txn_date BETWEEN ? AND ? ORDER BY amount DESC LIMIT 1", [$uid, $from, $to]);

        $deficit = to_cents($cur['expenses']) - to_cents($cur['income']);
        if ($deficit > 0) $sentences[] = 'Your expenses exceeded your income by ' . money_fmt(from_cents($deficit)) . ' this month.';
        $m['days_expenses_exceeded_income'] = (int)q_val("SELECT COUNT(*) FROM (SELECT txn_date FROM transactions WHERE user_id=? AND status='posted' AND type IN ('income','expense') AND txn_date BETWEEN ? AND ?
            GROUP BY txn_date HAVING SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) > SUM(CASE WHEN type='income' THEN amount ELSE 0 END)) x", [$uid, $from, $to]);

        foreach (BudgetService::list($uid, true) as $b) {
            if ($b['percent_used'] !== null && $b['percent_used'] >= 50) {
                $sentences[] = 'You have spent ' . (int)$b['percent_used'] . '% of your ' . ($b['category_name'] ? strtolower($b['category_name']) . ' ' : '') . $b['period'] . ' budget.';
            }
        }
        $m['budgets'] = array_map(fn($b) => ['name' => $b['name'], 'percent' => $b['percent_used'], 'remaining' => $b['remaining']], BudgetService::list($uid, true));

        $debt = q_all("SELECT d.party_name, d.due_date, d.direction FROM debts d LEFT JOIN (SELECT debt_id, SUM(principal_amount) paid FROM debt_payments WHERE status='posted' GROUP BY debt_id) p ON p.debt_id=d.id
                       WHERE d.user_id=? AND d.cancelled_at IS NULL AND d.due_date BETWEEN ? AND ? AND d.principal - COALESCE(p.paid,0) > 0 ORDER BY d.due_date LIMIT 5", [$uid, today(), $t0->modify('+14 days')->format('Y-m-d')]);
        $m['upcoming_debt_deadlines'] = $debt;
        if ($debt) $sentences[] = count($debt) . ' debt deadline' . (count($debt) > 1 ? 's are' : ' is') . ' coming up in the next 14 days.';
        $m['debt_summary'] = self::debtSummary($uid);

        $sav = self::savingsGoals($uid);
        $m['savings_total'] = self::totalSavings($uid);
        $m['savings_goal_progress'] = array_map(fn($g) => ['name' => $g['name'], 'percent' => $g['percent']], $sav);
        $monthSavings = (string)q_val("SELECT COALESCE(SUM(CASE WHEN type='savings_contribution' THEN amount ELSE -amount END),0) FROM transactions WHERE user_id=? AND status='posted' AND type IN ('savings_contribution','savings_withdrawal') AND txn_date BETWEEN ? AND ?", [$uid, $from, $to]);
        $m['savings_growth_this_month'] = $monthSavings;

        $hasHistory = (int)q_val("SELECT COUNT(DISTINCT txn_date) FROM transactions WHERE user_id=? AND status='posted' AND type IN ('income','expense')", [$uid]);
        if ($hasHistory < 3) array_unshift($sentences, 'Add a few more records to unlock detailed insights. More history gives more accurate averages and comparisons.');
        return ['sentences' => $sentences, 'metrics' => $m, 'has_enough_data' => $hasHistory >= 3];
    }
}
