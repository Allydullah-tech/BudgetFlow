<?php
declare(strict_types=1);
/**
 * Database integration tests. They need a real MySQL database with database/schema.sql already applied
 * and backend/.env configured. Use a TEST database, not production data (a scratch user is created and deleted).
 *   php tests/backend/integration.php
 */
require_once dirname(__DIR__, 2) . '/backend/bootstrap.php';
$pass = 0; $fail = 0;
function t(string $n, bool $ok, string $x = ''): void { global $pass, $fail; if ($ok) { $pass++; echo "  ok   $n\n"; } else { $fail++; echo "  FAIL $n $x\n"; } }
function thrown(callable $f): ?ApiException { try { $f(); } catch (ApiException $e) { return $e; } return null; }

$email = 'it-' . bin2hex(random_bytes(4)) . '@test.invalid';
q("INSERT INTO users (full_name,email,password_hash,role,status,trial_started_at,trial_ends_at) VALUES ('IT User',?,?, 'user','active',UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))", [$email, password_hash('x', PASSWORD_DEFAULT)]);
$uid = (int)db()->lastInsertId();
$user = q_one('SELECT * FROM users WHERE id=?', [$uid]);
try {
    q("INSERT INTO financial_accounts (user_id,name,type,opening_balance) VALUES (?, 'Cash','cash',100000.00)", [$uid]); $cash = (int)db()->lastInsertId();
    q("INSERT INTO financial_accounts (user_id,name,type,opening_balance) VALUES (?, 'M-Pesa','mobile_money',0)", [$uid]); $mpesa = (int)db()->lastInsertId();
    q("INSERT INTO categories (user_id,type,name) VALUES (?, 'income','Salary')", [$uid]); $inc = (int)db()->lastInsertId();
    q("INSERT INTO categories (user_id,type,name) VALUES (?, 'expense','Food')", [$uid]); $exp = (int)db()->lastInsertId();
    $today = today(); $m1 = date('Y-m-01'); $m2 = date('Y-m-t');
    $base = fn($o = []) => $o + ['title' => 'T', 'amount' => '1000', 'category_id' => $inc, 'account_id' => $cash, 'txn_date' => $today];

    echo "Ledger\n";
    $r = TransactionService::create($user, 'income', $base(['amount' => '200000', 'title' => 'Salary']));
    $r2 = TransactionService::create($user, 'expense', $base(['amount' => '30000', 'category_id' => $exp, 'title' => 'Lunch']));
    $totals = fn() => FinancialCalculationService::totals($uid, $m1, $m2);
    t('income and expense totals', $totals()['income'] == '200000.00' && $totals()['expenses'] == '30000.00', json_encode($totals()));

    // Transfer 50,000 Cash -> M-Pesa (same pair of rows the API writes)
    $g = uuid_v4();
    TransactionService::insert(['user_id' => $uid, 'account_id' => $cash, 'type' => 'transfer_out', 'amount' => '50000', 'title' => 'Transfer', 'txn_date' => $today, 'transfer_group' => $g]);
    TransactionService::insert(['user_id' => $uid, 'account_id' => $mpesa, 'type' => 'transfer_in', 'amount' => '50000', 'title' => 'Transfer', 'txn_date' => $today, 'transfer_group' => $g]);
    t('transfer is NOT income or expense', $totals()['income'] == '200000.00' && $totals()['expenses'] == '30000.00');
    $bal = []; foreach (FinancialCalculationService::accountBalances($uid) as $a) $bal[$a['name']] = $a['balance'] ?? $a['current_balance'] ?? null;
    t('transfer moves balances', (float)$bal['Cash'] === 220000.0 && (float)$bal['M-Pesa'] === 50000.0, json_encode($bal));
    t('total balance unchanged by transfer', (float)FinancialCalculationService::totalBalance($uid) === 270000.0);

    echo "Idempotency (offline sync)\n";
    $u = uuid_v4();
    $a = TransactionService::create($user, 'expense', $base(['category_id' => $exp, 'client_uuid' => $u, 'amount' => '5000']));
    $b = TransactionService::create($user, 'expense', $base(['category_id' => $exp, 'client_uuid' => $u, 'amount' => '5000']));
    t('same client_uuid creates one row', $a['id'] === $b['id'] && $b['duplicate'] === true && (int)q_val('SELECT COUNT(*) FROM transactions WHERE user_id=? AND client_uuid=?', [$uid, $u]) === 1);

    echo "Reversal\n";
    TransactionService::reverse($user, $r2['id']);
    t('reversed expense excluded from totals', $totals()['expenses'] == '5000.00', json_encode($totals()));
    TransactionService::reverse($user, $r2['id']); t('reversing twice is harmless', true);
    $e = thrown(fn() => TransactionService::update($user, $r2['id'], 'expense', $base(['category_id' => $exp])));
    t('reversed record cannot be edited', $e && $e->status === 409);
    $c = thrown(fn() => TransactionService::reverse($user, (int)q_val("SELECT id FROM transactions WHERE transfer_group=? AND type='transfer_in'", [$g])));
    t('reversing a transfer reverses both legs', (int)q_val("SELECT COUNT(*) FROM transactions WHERE transfer_group=? AND status='reversed'", [$g]) === 2);

    echo "Validation + ownership\n";
    $e = thrown(fn() => TransactionService::create($user, 'expense', $base(['amount' => '-5', 'category_id' => $exp]))); t('negative amount rejected', $e && $e->status === 422);
    $e = thrown(fn() => TransactionService::create($user, 'expense', $base(['txn_date' => date('Y-m-d', strtotime('+10 days')), 'category_id' => $exp]))); t('future date rejected', $e && $e->status === 422);
    $e = thrown(fn() => TransactionService::create($user, 'expense', $base(['account_id' => 99999999, 'category_id' => $exp]))); t("another user's account rejected", $e !== null);

    echo "Spending needs real money\n";
    $bal = function (int $id) use ($uid) { foreach (FinancialCalculationService::accountBalances($uid) as $a) if ((int)$a['id'] === $id) return to_cents($a['balance']); return null; };
    $e = thrown(fn() => TransactionService::create($user, 'expense', $base(['amount' => '99999999', 'category_id' => $exp]))); t('expense above the account balance is rejected', $e && $e->errorCode === 'insufficient_funds');
    $before = $bal($mpesa);
    $e = thrown(fn() => TransactionService::create($user, 'expense', $base(['amount' => (string)(($before / 100) + 10000), 'category_id' => $exp, 'account_id' => $mpesa]))); t('short account rejects the expense', $e && $e->errorCode === 'insufficient_funds' && $bal($mpesa) === $before);
    TransactionService::create($user, 'expense', $base(['amount' => (string)(($before / 100) + 10000), 'category_id' => $exp, 'account_id' => $mpesa, 'borrow_party' => 'Juma', 'borrow_phone' => '0712 345 678', 'borrow_due_date' => date('Y-m-d', strtotime('+30 days')), 'borrow_interest_rate' => '5', 'borrow_notes' => 'Pay back next month']));
    t('borrowing covers only the missing part, account ends at 0', $bal($mpesa) === 0, (string)$bal($mpesa));
    t('the borrowed part is recorded as a debt I owe', (string)q_val("SELECT principal FROM debts WHERE user_id=? AND party_name='Juma' AND direction='owed_by_me'", [$uid]) === '10000.00');
    $d = q_one("SELECT phone, due_date, interest_rate, notes FROM debts WHERE user_id=? AND party_name='Juma'", [$uid]);
    t('the borrowed debt keeps phone, due date, interest and notes', $d && $d['phone'] === '0712 345 678' && $d['due_date'] !== null && $d['interest_rate'] === '5.00' && $d['notes'] === 'Pay back next month', json_encode($d));
    $e = thrown(fn() => TransactionService::create($user, 'expense', $base(['amount' => '99999999', 'category_id' => $exp, 'borrow_party' => 'X', 'borrow_due_date' => date('Y-m-d', strtotime('-5 days'))]))); t('due date before the debt date is rejected', $e && $e->status === 422);
    $e = thrown(fn() => TransactionService::update($user, $r2['id'], 'expense', $base(['amount' => '99999999', 'category_id' => $exp]))); t('editing an expense above the balance is rejected', $e && $e->errorCode === 'insufficient_funds');

    echo "Subscription\n";
    $st = SubscriptionService::status($user); t('new user is on trial', in_array($st['state'] ?? $st['status'] ?? '', ['trial_active', 'trial'], true), json_encode($st));
    q('UPDATE users SET trial_ends_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE id=?', [$uid]); SubscriptionService::flush();
    $user = q_one('SELECT * FROM users WHERE id=?', [$uid]); $st = SubscriptionService::status($user);
    t('expired trial reports expired', ($st['state'] ?? $st['status'] ?? '') === 'expired', json_encode($st));
    t('expired user data is still there', (int)q_val("SELECT COUNT(*) FROM transactions WHERE user_id=?", [$uid]) > 0);
} finally {
    q('DELETE FROM users WHERE id=?', [$uid]); // cascades to the scratch data
}
echo "\n$pass passed, $fail failed\n"; exit($fail ? 1 : 0);
