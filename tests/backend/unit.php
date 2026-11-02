<?php
declare(strict_types=1);
/** Pure-PHP unit tests (no database needed).  Run:  php tests/backend/unit.php */
$B = dirname(__DIR__, 2) . '/backend';
putenv('STORAGE_PATH=' . sys_get_temp_dir() . '/et-test-storage');
require_once $B . '/config/app.php';
require_once $B . '/helpers/response.php';
require_once $B . '/helpers/validation.php';
require_once $B . '/services/FinancialCalculationService.php';
require_once $B . '/services/SubscriptionService.php';
require_once $B . '/services/PdfReportService.php';

$pass = 0; $fail = 0;
function t(string $name, bool $ok, string $extra = ''): void { global $pass, $fail; if ($ok) { $pass++; echo "  ok   $name\n"; } else { $fail++; echo "  FAIL $name $extra\n"; } }
function throws(callable $f, int $status = 0): bool { try { $f(); } catch (ApiException $e) { return !$status || $e->status === $status; } return false; }

echo "Money\n";
t('to_cents rounds', to_cents('10.005') === 1001 || to_cents('10.005') === 1000);
t('from_cents', from_cents(123456) === '1234.56');
t('money_fmt TZS', money_fmt(150000) === 'TZS 150,000.00');

echo "Validation\n";
$v = new V(['a' => '1234.50', 'b' => '-5', 'c' => '1.234', 'd' => 'abc', 'e' => '0']);
t('amount valid', $v->amount('a', 'A') === '1234.50');
$v->amount('b', 'B'); $v->amount('c', 'C'); $v->amount('d', 'D'); $v->amount('e', 'E');
t('negative/3-decimals/text/zero rejected', throws(fn() => $v->done(), 422));
$v = new V(['d' => '2026-02-30', 'ok' => '2026-02-28']);
t('valid date', (new V(['ok' => '2026-02-28']))->date('ok', 'D') === '2026-02-28');
$v->date('d', 'D'); t('impossible date rejected', throws(fn() => $v->done(), 422));
$v = new V(['t' => 'x']); $v->enum('t', 'T', ['income', 'expense']); t('enum rejects unknown', throws(fn() => $v->done()));
$v = new V(['e' => 'bad']); $v->email('e'); t('email rejected', throws(fn() => $v->done()));
t('email accepted', (new V(['email' => 'A@Example.com']))->email() !== null);
t('uuid valid', valid_uuid('3f2b8c1e-9d4a-4e7b-8a1c-2b5d6e7f8a90'));
t('uuid invalid', !valid_uuid('nope') && !valid_uuid(null));
t('password: short', check_password_strength('a1') !== null);
t('password: letters only', check_password_strength('abcdefgh') !== null);
t('password: ok', check_password_strength('Passw0rd!') === null);

echo "Date ranges\n";
[$f, $e] = resolve_range('month'); t('month starts on 1st', substr($f, 8) === '01' && $e >= $f);
[$f, $e] = resolve_range('custom', '2026-01-01', '2026-01-31'); t('custom range', $f === '2026-01-01' && $e === '2026-01-31');
t('custom reversed rejected', throws(fn() => resolve_range('custom', '2026-02-01', '2026-01-01'), 422));
t('custom >5 years rejected', throws(fn() => resolve_range('custom', '2015-01-01', '2026-01-01'), 422));
[$f, $e] = resolve_range('year'); t('year', substr($f, 5) === '01-01' && substr($e, 5) === '12-31');

echo "Financial rules\n";
t('pctChange', FinancialCalculationService::pctChange('150', '100') === 50.0);
t('pctChange zero previous is null', FinancialCalculationService::pctChange('10', '0') === null);
[$pf, $pt] = FinancialCalculationService::previousRange('2026-03-01', '2026-03-31'); t('full month compares with previous month', $pf === '2026-02-01' && $pt === '2026-02-28', "$pf $pt");
[$pf, $pt] = FinancialCalculationService::previousRange('2026-03-10', '2026-03-16'); t('week compares with preceding 7 days', $pf === '2026-03-03' && $pt === '2026-03-09', "$pf $pt");
$in = FinancialCalculationService::IN_TYPES; $out = FinancialCalculationService::OUT_TYPES;
t('no type is both inflow and outflow', !array_intersect($in, $out));
$sql = FinancialCalculationService::signedSql('t');
foreach (['transfer_in', 'transfer_out', 'debt_borrowed', 'debt_repaid', 'savings_contribution'] as $ty) t("$ty moves balance", str_contains($sql, "'$ty'"));
t('only income/expense are report types', array_values(array_intersect($in, ['income', 'expense'])) === ['income'] && array_values(array_intersect($out, ['income', 'expense'])) === ['expense']);

echo "Subscription date math\n";
$d = fn($s) => new DateTimeImmutable($s);
t('Jan 31 + 1 month = Feb 28', SubscriptionService::addMonths($d('2026-01-31'), 1)->format('Y-m-d') === '2026-02-28');
t('Jan 31 + 1 month leap year = Feb 29', SubscriptionService::addMonths($d('2028-01-31'), 1)->format('Y-m-d') === '2028-02-29');
t('Dec 15 + 1 month = Jan 15', SubscriptionService::addMonths($d('2026-12-15'), 1)->format('Y-m-d') === '2027-01-15');
t('Oct 20 + 12 months', SubscriptionService::addMonths($d('2026-10-20'), 12)->format('Y-m-d') === '2027-10-20');

echo "PDF\n";
$report = ['type' => 'x', 'title' => 'Income vs Expenses Report', 'range' => ['from' => '2026-10-01', 'to' => '2026-10-19', 'label' => 'This month'], 'generated_at' => '2026-10-19 10:00',
  'summary' => [['label' => 'Income', 'value' => '240000.00', 'kind' => 'money'], ['label' => 'Savings rate', 'value' => 63.3, 'kind' => 'percent']],
  'charts' => [['title' => 'Income vs expenses', 'type' => 'bar', 'labels' => ['a', 'b'], 'datasets' => [['name' => 'Income', 'values' => [100, 200]], ['name' => 'Expenses', 'values' => [50, 80]]]], ['title' => 'By category', 'type' => 'donut', 'labels' => ['Food', 'Transport'], 'datasets' => [['name' => 'E', 'values' => [40, 60]]]]],
  'tables' => [['title' => 'Rows', 'columns' => [['key' => 'k', 'label' => 'Period', 'kind' => 'text'], ['key' => 'i', 'label' => 'Income', 'kind' => 'money']], 'rows' => array_map(fn($n) => ['k' => "Day $n", 'i' => (string)($n * 1000)], range(1, 120))]], 'notes' => ['Transfers are excluded. Ünïcode ok.']];
$pdf = PdfReportService::render($report, 'Neema K');
t('PDF header', str_starts_with($pdf, '%PDF-1.'));
t('PDF trailer', str_contains($pdf, '%%EOF') && str_contains($pdf, 'startxref'));
t('PDF paginates long tables', preg_match_all('/\/Type\s*\/Page[^s]/', $pdf) >= 2);
if (preg_match('/startxref\s+(\d+)/', $pdf, $m)) t('xref offset points at xref table', substr($pdf, (int)$m[1], 4) === 'xref');
file_put_contents(sys_get_temp_dir() . '/et-sample.pdf', $pdf);

echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);
