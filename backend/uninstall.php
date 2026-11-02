<?php
declare(strict_types=1);

/**
 * DANGEROUS: removes every Expense Tracker table and the install lock.
 * Disabled unless backend/.env contains ALLOW_UNINSTALL=true. Requires a logged-in Super Admin, their password,
 * and the typed phrase. Take a backup first (Admin -> Backups).
 */
require_once __DIR__ . '/bootstrap.php';
header('Content-Type: text/html; charset=utf-8'); header('X-Frame-Options: DENY');
function out(string $m, int $c = 200): never { http_response_code($c); echo '<!doctype html><meta charset="utf-8"><title>Uninstall</title><body style="font-family:system-ui;max-width:560px;margin:40px auto;padding:0 16px">' . $m . '</body>'; exit; }

if (env('ALLOW_UNINSTALL', 'false') !== 'true') out('<h2>Uninstall is disabled</h2><p>To enable it, set <code>ALLOW_UNINSTALL=true</code> in <code>backend/.env</code>, reload this page, and remove the line afterwards.</p>', 403);
start_session();
$u = auth_user();
if (!$u || $u['role'] !== 'super_admin') out('<h2>Forbidden</h2><p>Log in as the Super Admin in this browser first, then reload this page.</p>', 403);

if (http_method() === 'POST') {
    if (!hash_equals(csrf_token(), (string)($_POST['csrf'] ?? ''))) out('Security check failed.', 419);
    $hash = q_val('SELECT password_hash FROM users WHERE id = ?', [$u['id']]);
    if (!password_verify((string)($_POST['password'] ?? ''), (string)$hash) || ($_POST['phrase'] ?? '') !== 'DELETE ALL DATA') out('<h2>Wrong password or phrase.</h2><p><a href="">Back</a></p>', 422);
    $pdo = db();
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM) as [$t]) $pdo->exec("DROP TABLE IF EXISTS `$t`");
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    foreach (['installed.lock'] as $f) @unlink(STORAGE_PATH . '/' . $f);
    @unlink(ET_ROOT . '/.env');
    AuthenticationService::logout();
    out('<h2>Uninstalled</h2><p>All tables were removed. Files in <code>backend/storage</code> (receipts, QR codes, backups) were left for you to delete manually.</p>');
}
out('<h2 style="color:#b3261e">Uninstall Expense Tracker</h2><p>This permanently deletes <b>all users and all financial data</b>. Make a backup first.</p><form method="post"><input type="hidden" name="csrf" value="' . htmlspecialchars(csrf_token()) . '">
<p><label>Your password<br><input type="password" name="password" required style="width:100%;padding:8px"></label></p><p><label>Type <b>DELETE ALL DATA</b><br><input name="phrase" required style="width:100%;padding:8px"></label></p><button style="padding:10px 18px;background:#b3261e;color:#fff;border:0;border-radius:8px">Delete everything</button></form>');
