<?php
declare(strict_types=1);

/**
 * Builds report structures used by the JSON API, CSV export and PDF export (one source, same numbers everywhere).
 * Report = {type,title,range,generated_at,summary:[{label,value,kind}],notes:[],charts:[],tables:[]}
 * summary kind: money | number | percent | text
 */
final class ReportingService
{
    public const TYPES = [
        'income' => 'Income Report', 'expense' => 'Expense Report', 'income_vs_expense' => 'Income vs Expenses Report',
        'cash_flow' => 'Cash Flow Report', 'debt' => 'Debt Report', 'debt_repayment' => 'Debt Repayment Report',
        'budget' => 'Budget Report', 'savings' => 'Savings Report', 'account_balance' => 'Account Balance Report',
        'category_spending' => 'Category Spending Report', 'daily' => 'Daily Financial Summary', 'weekly' => 'Weekly Financial Summary',
        'monthly' => 'Monthly Financial Summary', 'annual' => 'Annual Financial Summary', 'trends' => 'Financial Trends Report',
        'outstanding_debt' => 'Outstanding Debt Report',
    ];

    private static function m(string $label, $value, string $kind = 'money'): array { return ['label' => $label, 'value' => $value, 'kind' => $kind]; }

    private static function col(string $key, string $label, string $kind = 'text'): array { return ['key' => $key, 'label' => $label, 'kind' => $kind]; }

    private static function changeText($cur, $prev): string
    {
        $pct = FinancialCalculationService::pctChange($cur, $prev);
        $diff = from_cents(to_cents($cur) - to_cents($prev));
        return ($diff >= 0 ? '+' : '-') . money_fmt(abs((float)$diff)) . ($pct === null ? ' (N/A - no previous data)' : ' (' . ($pct >= 0 ? '+' : '') . $pct . '%)');
    }

    private static function avgMonthly(string $total, int $days): string
    {
        return from_cents((int)round(to_cents($total) / max(1, $days / 30.4375)));
    }

    public static function build(string $type, int $uid, string $from, string $to, string $label = 'Custom range'): array
    {
        if (!isset(self::TYPES[$type])) throw new ApiException('Unknown report type.', 422);
        $r = [
            'type' => $type, 'title' => self::TYPES[$type],
            'range' => ['from' => $from, 'to' => $to, 'label' => $label],
            'generated_at' => gmdate('Y-m-d H:i') . ' UTC', 'summary' => [], 'notes' => [], 'charts' => [], 'tables' => [],
        ];
        $days = (int)((new DateTime($from))->diff(new DateTime($to))->days) + 1;
        $r['notes'][] = "Period covers $days day(s), inclusive. Daily averages divide by all calendar days (including days with no transactions); monthly averages divide by days / 30.44 (minimum 1 month).";

        switch ($type) {
            case 'income': case 'expense':
                self::txnReport($r, $uid, $type, $from, $to, $days); break;
            case 'income_vs_expense': case 'cash_flow': case 'trends':
                self::flowReport($r, $uid, $type, $from, $to, $days); break;
            case 'category_spending':
                $cats = FinancialCalculationService::categoryBreakdown($uid, 'expense', $from, $to);
                $tot = FinancialCalculationService::totals($uid, $from, $to);
                $r['summary'] = [self::m('Total expenses', $tot['expenses']), self::m('Categories used', count($cats), 'number'), self::m('Most expensive category', $cats ? $cats[0]['name'] . ' (' . $cats[0]['percent'] . '%)' : 'N/A', 'text')];
                $r['charts'][] = ['title' => 'Spending by category', 'type' => 'donut', 'labels' => array_column($cats, 'name'), 'datasets' => [['name' => 'Expenses', 'values' => array_map('floatval', array_column($cats, 'total'))]]];
                $r['tables'][] = ['title' => 'Spending by category', 'columns' => [self::col('name', 'Category'), self::col('cnt', 'Transactions', 'number'), self::col('total', 'Total', 'money'), self::col('percent', 'Share', 'percent')], 'rows' => $cats];
                break;
            case 'daily': case 'weekly': case 'monthly': case 'annual':
                self::periodicReport($r, $uid, $type, $from, $to);
                break;
            case 'debt': case 'outstanding_debt':
                self::debtReport($r, $uid, $type === 'outstanding_debt'); break;
            case 'debt_repayment':
                $rows = q_all("SELECT p.pay_date, d.party_name, d.direction, p.principal_amount, p.interest_amount, p.method, p.reference, a.name AS account
                               FROM debt_payments p JOIN debts d ON d.id = p.debt_id JOIN financial_accounts a ON a.id = p.account_id
                               WHERE p.user_id = ? AND p.status='posted' AND p.pay_date BETWEEN ? AND ? ORDER BY p.pay_date DESC, p.id DESC", [$uid, $from, $to]);
                $paid = 0; $recv = 0; $int = 0;
                foreach ($rows as &$x) { $x['direction_label'] = $x['direction'] === 'owed_by_me' ? 'I repaid' : 'I received'; if ($x['direction'] === 'owed_by_me') $paid += to_cents($x['principal_amount']); else $recv += to_cents($x['principal_amount']); $int += to_cents($x['interest_amount']); }
                $r['summary'] = [self::m('Principal I repaid', from_cents($paid)), self::m('Principal I recovered', from_cents($recv)), self::m('Interest recorded', from_cents($int)), self::m('Payments', count($rows), 'number')];
                $r['tables'][] = ['title' => 'Debt payments', 'columns' => [self::col('pay_date', 'Date'), self::col('party_name', 'Person'), self::col('direction_label', 'Type'), self::col('principal_amount', 'Principal', 'money'), self::col('interest_amount', 'Interest', 'money'), self::col('account', 'Account')], 'rows' => $rows];
                break;
            case 'budget':
                $bs = BudgetService::list($uid);
                $r['summary'] = [self::m('Budgets', count($bs), 'number'), self::m('Exceeded', count(array_filter($bs, fn($b) => $b['status'] === 'exceeded')), 'number')];
                $r['notes'][] = 'Budget figures use each budget\'s current period, not the date range selected above.';
                $r['charts'][] = ['title' => 'Budget vs actual', 'type' => 'bar', 'labels' => array_column($bs, 'name'), 'datasets' => [['name' => 'Budget', 'values' => array_map('floatval', array_column($bs, 'amount'))], ['name' => 'Spent', 'values' => array_map('floatval', array_column($bs, 'spent'))]]];
                $r['tables'][] = ['title' => 'Budgets', 'columns' => [self::col('name', 'Budget'), self::col('period', 'Period'), self::col('amount', 'Budget', 'money'), self::col('spent', 'Spent', 'money'), self::col('remaining', 'Remaining', 'money'), self::col('percent_used', 'Used', 'percent')], 'rows' => $bs];
                break;
            case 'savings':
                $gs = FinancialCalculationService::savingsGoals($uid);
                $mv = q_all("SELECT t.txn_date, g.name AS goal, t.type, t.amount, a.name AS account FROM transactions t JOIN savings_goals g ON g.id = t.goal_id JOIN financial_accounts a ON a.id = t.account_id
                             WHERE t.user_id = ? AND t.status='posted' AND t.type IN ('savings_contribution','savings_withdrawal') AND t.txn_date BETWEEN ? AND ? ORDER BY t.txn_date DESC, t.id DESC", [$uid, $from, $to]);
                foreach ($mv as &$x) $x['type_label'] = $x['type'] === 'savings_contribution' ? 'Contribution' : 'Withdrawal';
                $contrib = 0; $withd = 0; foreach ($mv as $x) { if ($x['type'] === 'savings_contribution') $contrib += to_cents($x['amount']); else $withd += to_cents($x['amount']); }
                $r['summary'] = [self::m('Total saved (all goals)', FinancialCalculationService::totalSavings($uid)), self::m('Contributions in period', from_cents($contrib)), self::m('Withdrawals in period', from_cents($withd)), self::m('Active goals', count(array_filter($gs, fn($g) => $g['is_active'])), 'number')];
                $r['notes'][] = 'Savings contributions are transfers into goals - they are not counted as expenses.';
                $r['charts'][] = ['title' => 'Goal progress (%)', 'type' => 'bar', 'labels' => array_column($gs, 'name'), 'datasets' => [['name' => 'Progress %', 'values' => array_map('floatval', array_column($gs, 'percent'))]]];
                $r['tables'][] = ['title' => 'Savings goals', 'columns' => [self::col('name', 'Goal'), self::col('target_amount', 'Target', 'money'), self::col('balance', 'Saved', 'money'), self::col('remaining', 'Remaining', 'money'), self::col('percent', 'Progress', 'percent')], 'rows' => $gs];
                $r['tables'][] = ['title' => 'Savings activity', 'columns' => [self::col('txn_date', 'Date'), self::col('goal', 'Goal'), self::col('type_label', 'Type'), self::col('amount', 'Amount', 'money'), self::col('account', 'Account')], 'rows' => $mv];
                break;
            case 'account_balance':
                $acc = FinancialCalculationService::accountBalances($uid, false, $to);
                $tot = 0; foreach ($acc as $a) if ($a['is_active']) $tot += to_cents($a['balance']);
                $r['summary'] = [self::m("Total balance on $to", from_cents($tot)), self::m('Accounts', count($acc), 'number')];
                $r['charts'][] = ['title' => 'Balance by account', 'type' => 'bar', 'labels' => array_column($acc, 'name'), 'datasets' => [['name' => 'Balance', 'values' => array_map('floatval', array_column($acc, 'balance'))]]];
                $r['tables'][] = ['title' => 'Accounts', 'columns' => [self::col('name', 'Account'), self::col('type', 'Type'), self::col('opening_balance', 'Opening balance', 'money'), self::col('balance', 'Balance', 'money')], 'rows' => $acc];
                break;
        }
        return $r;
    }

    private static function txnReport(array &$r, int $uid, string $type, string $from, string $to, int $days): void
    {
        $cur = FinancialCalculationService::totals($uid, $from, $to);
        [$pf, $pt] = FinancialCalculationService::previousRange($from, $to);
        $prev = FinancialCalculationService::totals($uid, $pf, $pt);
        $total = $type === 'income' ? $cur['income'] : $cur['expenses'];
        $ptotal = $type === 'income' ? $prev['income'] : $prev['expenses'];
        $cnt = $type === 'income' ? $cur['income_count'] : $cur['expense_count'];
        $cats = FinancialCalculationService::categoryBreakdown($uid, $type, $from, $to);
        $word = $type === 'income' ? 'income' : 'expenses';
        $r['summary'] = [
            self::m("Total $word", $total),
            self::m('Transactions', (int)$cnt, 'number'),
            self::m("Average daily $word", from_cents((int)round(to_cents($total) / $days))),
            self::m("Average monthly $word", self::avgMonthly($total, $days)),
            self::m('Highest ' . ($type === 'income' ? 'income' : 'expense'), $type === 'income' ? ($cur['max_income'] ?? '0.00') : ($cur['max_expense'] ?? '0.00')),
        ];
        if ($type === 'expense') $r['summary'][] = self::m('Lowest expense', $cur['min_expense'] ?? '0.00');
        $r['summary'][] = self::m(($type === 'income' ? 'Top source category' : 'Most expensive category'), $cats ? $cats[0]['name'] . ' (' . $cats[0]['percent'] . '%)' : 'N/A', 'text');
        $r['summary'][] = self::m("Change vs previous period ($pf to $pt)", self::changeText($total, $ptotal), 'text');
        $s = FinancialCalculationService::series($uid, $from, $to, $days > 92 ? 'month' : 'day');
        $r['charts'][] = ['title' => ucfirst($word) . ' over time', 'type' => 'line', 'labels' => array_column($s, 'key'), 'datasets' => [['name' => ucfirst($word), 'values' => array_map('floatval', array_column($s, $type === 'income' ? 'income' : 'expenses'))]]];
        $r['charts'][] = ['title' => ucfirst($word) . ' by category', 'type' => 'donut', 'labels' => array_column($cats, 'name'), 'datasets' => [['name' => ucfirst($word), 'values' => array_map('floatval', array_column($cats, 'total'))]]];
        $rows = q_all("SELECT t.txn_date, t.title, COALESCE(c.name,'Uncategorized') AS category, a.name AS account, t.payment_method, t.reference, t.amount
                       FROM transactions t LEFT JOIN categories c ON c.id=t.category_id JOIN financial_accounts a ON a.id=t.account_id
                       WHERE t.user_id=? AND t.type=? AND t.status='posted' AND t.txn_date BETWEEN ? AND ? ORDER BY t.txn_date DESC, t.id DESC LIMIT 2000", [$uid, $type, $from, $to]);
        $r['tables'][] = ['title' => 'By category', 'columns' => [self::col('name', 'Category'), self::col('cnt', 'Count', 'number'), self::col('total', 'Total', 'money'), self::col('percent', 'Share', 'percent')], 'rows' => $cats];
        $r['tables'][] = ['title' => 'Transactions', 'columns' => [self::col('txn_date', 'Date'), self::col('title', 'Title'), self::col('category', 'Category'), self::col('account', 'Account'), self::col('amount', 'Amount', 'money')], 'rows' => $rows];
        if (count($rows) >= 2000) $r['notes'][] = 'Only the latest 2,000 transactions are listed; totals include all.';
    }

    private static function flowReport(array &$r, int $uid, string $type, string $from, string $to, int $days): void
    {
        $cur = FinancialCalculationService::totals($uid, $from, $to);
        $gran = $type === 'trends' ? 'month' : ($days > 92 ? 'month' : 'day');
        if ($type === 'trends') { $from = (new DateTimeImmutable($to))->modify('first day of -11 months')->format('Y-m-d'); $r['range']['from'] = $from; $r['range']['label'] = 'Last 12 months'; $cur = FinancialCalculationService::totals($uid, $from, $to); $days = (int)((new DateTime($from))->diff(new DateTime($to))->days) + 1; }
        $s = FinancialCalculationService::series($uid, $from, $to, $gran);
        $r['summary'] = [self::m('Total income', $cur['income']), self::m('Total expenses', $cur['expenses']), self::m('Net cash flow', $cur['net'])];
        if ($type === 'cash_flow') {
            $open = FinancialCalculationService::totalBalance($uid, (new DateTimeImmutable($from))->modify('-1 day')->format('Y-m-d'));
            $close = FinancialCalculationService::totalBalance($uid, $to);
            $other = from_cents(to_cents($close) - to_cents($open) - to_cents($cur['net']));
            array_unshift($r['summary'], self::m('Opening balance', $open));
            $r['summary'][] = self::m('Transfers, debt and savings movements', $other);
            $r['summary'][] = self::m('Closing balance', $close);
            $r['notes'][] = 'Opening/closing balances include the opening balance of every active account; transfers between your own accounts cancel out.';
        } else {
            [$pf, $pt] = FinancialCalculationService::previousRange($from, $to);
            $prev = FinancialCalculationService::totals($uid, $pf, $pt);
            $r['summary'][] = self::m('Average daily income', $cur['avg_daily_income']);
            $r['summary'][] = self::m('Average daily expenses', $cur['avg_daily_expense']);
            $r['summary'][] = self::m('Income vs previous period', self::changeText($cur['income'], $prev['income']), 'text');
            $r['summary'][] = self::m('Expenses vs previous period', self::changeText($cur['expenses'], $prev['expenses']), 'text');
        }
        $r['charts'][] = ['title' => 'Income vs expenses', 'type' => 'bar', 'labels' => array_column($s, 'key'), 'datasets' => [['name' => 'Income', 'values' => array_map('floatval', array_column($s, 'income'))], ['name' => 'Expenses', 'values' => array_map('floatval', array_column($s, 'expenses'))]]];
        $r['tables'][] = ['title' => $gran === 'month' ? 'By month' : 'By day', 'columns' => [self::col('key', 'Period'), self::col('income', 'Income', 'money'), self::col('expenses', 'Expenses', 'money'), self::col('net', 'Net', 'money')], 'rows' => $s];
    }

    private static function periodicReport(array &$r, int $uid, string $type, string $from, string $to): void
    {
        $gran = ['daily' => 'day', 'weekly' => 'week', 'monthly' => 'month', 'annual' => 'year'][$type];
        $s = FinancialCalculationService::series($uid, $from, $to, $gran);
        $cur = FinancialCalculationService::totals($uid, $from, $to);
        $r['summary'] = [self::m('Total income', $cur['income']), self::m('Total expenses', $cur['expenses']), self::m('Net cash flow', $cur['net']), self::m('Periods listed', count($s), 'number')];
        $r['notes'][] = $gran === 'week' ? 'Weeks start on Monday; the first and last week may be partial.' : ($gran === 'month' ? 'The first and last month may be partial for the selected range.' : 'Each row is one ' . $gran . '.');
        $r['charts'][] = ['title' => 'Income vs expenses', 'type' => 'bar', 'labels' => array_column($s, 'key'), 'datasets' => [['name' => 'Income', 'values' => array_map('floatval', array_column($s, 'income'))], ['name' => 'Expenses', 'values' => array_map('floatval', array_column($s, 'expenses'))]]];
        $r['tables'][] = ['title' => ucfirst($type) . ' summary', 'columns' => [self::col('key', 'Period'), self::col('income', 'Income', 'money'), self::col('expenses', 'Expenses', 'money'), self::col('net', 'Net', 'money')], 'rows' => array_reverse($s)];
    }

    private static function debtReport(array &$r, int $uid, bool $outstandingOnly): void
    {
        $ds = FinancialCalculationService::debts($uid);
        if ($outstandingOnly) $ds = array_values(array_filter($ds, fn($d) => !in_array($d['status'], ['paid', 'cancelled'], true)));
        $sum = FinancialCalculationService::debtSummary($uid);
        foreach ($ds as &$d) $d['direction_label'] = $d['direction'] === 'owed_by_me' ? 'I owe' : 'Owed to me';
        $r['summary'] = [self::m('Total I owe (remaining)', $sum['owed_by_me']), self::m('Total owed to me (remaining)', $sum['owed_to_me']), self::m('Overdue debts', $sum['overdue_count'], 'number'), self::m('Debts listed', count($ds), 'number')];
        $r['notes'][] = 'Remaining = original amount - confirmed principal repayments. Debt figures show the current position and ignore the date range.';
        $r['tables'][] = ['title' => $outstandingOnly ? 'Outstanding debts' : 'All debts', 'columns' => [self::col('party_name', 'Person'), self::col('direction_label', 'Direction'), self::col('principal', 'Original', 'money'), self::col('paid', 'Paid', 'money'), self::col('remaining', 'Remaining', 'money'), self::col('due_date', 'Due'), self::col('status', 'Status')], 'rows' => $ds];
    }

    public static function toCsv(array $r): string
    {
        $h = fopen('php://temp', 'r+');
        fputcsv($h, [$r['title']]); fputcsv($h, ['Period', $r['range']['from'] . ' to ' . $r['range']['to']]); fputcsv($h, []);
        foreach ($r['summary'] as $s) fputcsv($h, [$s['label'], $s['value']]);
        foreach ($r['tables'] as $t) {
            fputcsv($h, []); fputcsv($h, [$t['title']]);
            fputcsv($h, array_column($t['columns'], 'label'));
            foreach ($t['rows'] as $row) fputcsv($h, array_map(fn($c) => self::csvSafe((string)($row[$c['key']] ?? '')), $t['columns']));
        }
        rewind($h);
        return "\xEF\xBB\xBF" . stream_get_contents($h);
    }

    /** Neutralise spreadsheet formula injection. */
    private static function csvSafe(string $v): string { return ($v !== '' && strpbrk($v[0], '=+-@') !== false && !is_numeric($v)) ? "'" . $v : $v; }
}
