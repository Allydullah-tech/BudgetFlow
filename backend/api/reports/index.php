<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('reports');
    $uid = (int)$user['id'];
    $a = $p[0] ?? 'types';
    if ($method !== 'GET') return;

    if ($a === 'types') json_ok(['types' => ReportingService::TYPES, 'presets' => ['today', 'yesterday', 'week', 'last_week', 'month', 'last_month', 'year', 'last_year', 'custom']]);

    $build = function () use ($uid, $p): array {
        if (($p[0] ?? '') === 'debt-statement') {
            $id = (int)($_GET['id'] ?? 0);
            $d = FinancialCalculationService::debts($uid, $id)[0] ?? throw new ApiException('Debt not found.', 404);
            $pay = q_all("SELECT p.pay_date, p.principal_amount, p.interest_amount, p.method, p.reference, a.name AS account FROM debt_payments p JOIN financial_accounts a ON a.id = p.account_id WHERE p.debt_id = ? AND p.user_id = ? AND p.status = 'posted' ORDER BY p.pay_date, p.id", [$id, $uid]);
            return [
                'type' => 'debt_statement', 'title' => 'Debt Statement - ' . $d['party_name'],
                'range' => ['from' => $d['start_date'], 'to' => today(), 'label' => 'Since ' . $d['start_date']], 'generated_at' => gmdate('Y-m-d H:i') . ' UTC',
                'summary' => [
                    ['label' => 'Direction', 'value' => $d['direction'] === 'owed_by_me' ? 'I owe this person' : 'This person owes me', 'kind' => 'text'],
                    ['label' => 'Original amount', 'value' => $d['principal'], 'kind' => 'money'], ['label' => 'Total paid (principal)', 'value' => $d['paid'], 'kind' => 'money'],
                    ['label' => 'Remaining balance', 'value' => $d['remaining'], 'kind' => 'money'], ['label' => 'Interest recorded', 'value' => $d['interest_paid'], 'kind' => 'money'],
                    ['label' => 'Due date', 'value' => $d['due_date'] ?: 'Not set', 'kind' => 'text'], ['label' => 'Status', 'value' => ucfirst($d['status']), 'kind' => 'text'], ['label' => 'Paid so far', 'value' => $d['percent_paid'], 'kind' => 'percent'],
                ],
                'notes' => ['Remaining balance = original amount - confirmed principal repayments. Interest is recorded separately.'], 'charts' => [],
                'tables' => [['title' => 'Payments', 'columns' => [['key' => 'pay_date', 'label' => 'Date', 'kind' => 'text'], ['key' => 'principal_amount', 'label' => 'Principal', 'kind' => 'money'], ['key' => 'interest_amount', 'label' => 'Interest', 'kind' => 'money'], ['key' => 'method', 'label' => 'Method', 'kind' => 'text'], ['key' => 'reference', 'label' => 'Reference', 'kind' => 'text'], ['key' => 'account', 'label' => 'Account', 'kind' => 'text']], 'rows' => $pay]],
            ];
        }
        $type = (string)($_GET['type'] ?? 'income_vs_expense');
        [$from, $to, $label] = resolve_range((string)($_GET['range'] ?? 'month'), $_GET['from'] ?? null, $_GET['to'] ?? null);
        return ReportingService::build($type, $uid, $from, $to, $label);
    };

    if ($a === 'run') json_ok($build());

    if ($a === 'csv') {
        require_feature('export', $user);
        $r = $build();
        audit($uid, 'report_exported', 'report', $r['type'], 'success', ['format' => 'csv']);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $r['type'] . '-' . $r['range']['from'] . '_' . $r['range']['to'] . '.csv"');
        echo ReportingService::toCsv($r); exit;
    }

    if ($a === 'pdf' || $a === 'debt-statement') {
        require_feature('pdf', $user);
        $r = $build();
        try { $pdf = PdfReportService::render($r, $user['full_name'], (string)setting('app_name', 'BudgetFlow')); }
        catch (Throwable $e) { log_error($e); throw new ApiException('Could not generate the PDF. Please try again.', 500); }
        audit($uid, 'report_exported', 'report', $r['type'], 'success', ['format' => 'pdf']);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9_-]+/i', '-', $r['type']) . '-' . $r['range']['from'] . '_' . $r['range']['to'] . '.pdf"');
        header('Content-Length: ' . strlen($pdf));
        echo $pdf; exit;
    }
};
