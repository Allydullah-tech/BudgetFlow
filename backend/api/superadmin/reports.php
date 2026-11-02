<?php
declare(strict_types=1);

/** Report 17: Subscription and Payment History (platform data only - no customer financial records). */
return function (array $admin, string $method, array $p): void {
    if ($method !== 'GET') return;
    [$from, $to, $label] = resolve_range((string)($_GET['range'] ?? 'month'), $_GET['from'] ?? null, $_GET['to'] ?? null);
    $rows = q_all("SELECT DATE(COALESCE(sp.reviewed_at, sp.created_at)) AS d, u.full_name, u.email, pl.name AS plan, pm.name AS method, sp.reference, sp.amount, sp.status
                   FROM subscription_payments sp JOIN users u ON u.id = sp.user_id JOIN subscription_plans pl ON pl.id = sp.plan_id JOIN payment_methods pm ON pm.id = sp.method_id
                   WHERE DATE(sp.created_at) BETWEEN ? AND ? ORDER BY sp.id DESC", [$from, $to]);
    $appr = 0; $cnt = ['approved' => 0, 'pending' => 0, 'rejected' => 0];
    foreach ($rows as $r) { $cnt[$r['status']]++; if ($r['status'] === 'approved') $appr += to_cents($r['amount']); }
    $report = [
        'type' => 'subscription_payments', 'title' => 'Subscription and Payment History', 'range' => ['from' => $from, 'to' => $to, 'label' => $label], 'generated_at' => gmdate('Y-m-d H:i') . ' UTC',
        'summary' => [['label' => 'Approved revenue', 'value' => from_cents($appr), 'kind' => 'money'], ['label' => 'Approved payments', 'value' => $cnt['approved'], 'kind' => 'number'],
                      ['label' => 'Pending payments', 'value' => $cnt['pending'], 'kind' => 'number'], ['label' => 'Rejected payments', 'value' => $cnt['rejected'], 'kind' => 'number']],
        'notes' => ['Only payments submitted in the selected period are listed. Revenue counts approved payments only.'], 'charts' => [],
        'tables' => [['title' => 'Payments', 'columns' => [['key' => 'd', 'label' => 'Date', 'kind' => 'text'], ['key' => 'full_name', 'label' => 'Customer', 'kind' => 'text'], ['key' => 'plan', 'label' => 'Plan', 'kind' => 'text'], ['key' => 'method', 'label' => 'Method', 'kind' => 'text'], ['key' => 'reference', 'label' => 'Reference', 'kind' => 'text'], ['key' => 'amount', 'label' => 'Amount', 'kind' => 'money'], ['key' => 'status', 'label' => 'Status', 'kind' => 'text']], 'rows' => $rows]],
    ];
    $fmt = $_GET['format'] ?? 'json';
    if ($fmt === 'csv') { header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="subscription-payments.csv"'); echo ReportingService::toCsv($report); exit; }
    if ($fmt === 'pdf') { $pdf = PdfReportService::render($report, $admin['full_name'], (string)setting('app_name', 'BudgetFlow')); header('Content-Type: application/pdf'); header('Content-Disposition: attachment; filename="subscription-payments.pdf"'); echo $pdf; exit; }
    json_ok($report);
};
