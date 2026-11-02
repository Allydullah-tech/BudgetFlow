<?php
declare(strict_types=1);

/**
 * Expense Tracker installer.  Open  https://your-site/backend/install.php
 * - Locks itself after a successful install (backend/storage/installed.lock).
 * - Requires the one-time token stored in backend/storage/install_token.txt (proves you have server file access).
 * - Never ships a default Super Admin password.
 */
$root = __DIR__;
$storage = $root . '/storage';
foreach (['', '/logs', '/receipts', '/qr', '/backups', '/avatars', '/sessions'] as $d) { if (!is_dir($storage . $d)) @mkdir($storage . $d, 0750, true); }
$lock = $storage . '/installed.lock';
$tokenFile = $storage . '/install_token.txt';

header('X-Frame-Options: DENY'); header('X-Content-Type-Options: nosniff'); header('Cache-Control: no-store');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'");
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function page(string $body, int $status = 200): never
{
    http_response_code($status);
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Expense Tracker</title><style>
    :root{--g:#182236;--gd:#101828;--gold:#3d8bff;--cream:#f7f7f5}*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:linear-gradient(160deg,#101828,#182236);min-height:100vh;color:#101828;padding:24px}
    .card{max-width:680px;margin:0 auto;background:#fff;border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.35);border-top:5px solid var(--gold)}
    h1{color:var(--g);margin:0 0 4px;font-size:26px}h2{color:var(--g);font-size:17px;margin:24px 0 8px;border-bottom:1px solid #e4e4df;padding-bottom:6px}p.sub{margin:0 0 16px;color:#667085}
    label{display:block;font-weight:600;margin:12px 0 4px;font-size:14px}input{width:100%;padding:11px 12px;border:1.5px solid #d0d5dd;border-radius:10px;font:inherit}input:focus{outline:3px solid rgba(198, 169, 108,.35);border-color:var(--gold)}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.row{grid-template-columns:1fr}}
    button{margin-top:22px;width:100%;padding:14px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--g),var(--gd));color:#fff;font-weight:700;font-size:16px;cursor:pointer;border-bottom:3px solid var(--gold)}
    .ok{color:#14733f}.bad{color:#b3261e;font-weight:600}.err{background:#fdecea;color:#8a1c14;padding:12px 14px;border-radius:10px;margin:12px 0}.note{background:#eef5ff;border:1px solid #a9ccff;padding:12px 14px;border-radius:10px;font-size:14px}
    table{width:100%;border-collapse:collapse;font-size:14px}td{padding:5px 0;border-bottom:1px solid #eeeeea}small{color:#667085}code{background:#eeeeea;padding:1px 6px;border-radius:5px}</style></head><body><div class="card">' . $body . '</div></body></html>';
    exit;
}

if (is_file($lock)) {
    page('<h1>Already installed</h1><p class="sub">The installer is locked. To reinstall, restore a backup, or delete <code>backend/storage/installed.lock</code> only if you are sure (this does not erase data).</p><p><a href="../">Open Expense Tracker</a></p>', 403);
}

session_name('ET_INSTALL'); session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']); session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
if (!is_file($tokenFile)) @file_put_contents($tokenFile, bin2hex(random_bytes(12)));

// ---- environment checks ----
$checks = [
    'PHP 8.1 or newer (found ' . PHP_VERSION . ')' => version_compare(PHP_VERSION, '8.1.0', '>='),
    'PDO MySQL extension' => extension_loaded('pdo_mysql'),
    'mbstring extension' => extension_loaded('mbstring'),
    'fileinfo extension (safe uploads)' => extension_loaded('fileinfo'),
    'openssl / random_bytes' => function_exists('random_bytes'),
    'iconv extension (PDF reports)' => function_exists('iconv'),
    'storage/ folder is writable' => is_writable($storage),
    'backend/ folder is writable (creates .env)' => is_writable($root),
    'frontend/assets/images/brand writable (logo upload, optional)' => is_dir($root . '/../frontend/assets/images') && (is_dir($root . '/../frontend/assets/images/brand') ? is_writable($root . '/../frontend/assets/images/brand') : is_writable($root . '/../frontend/assets/images')),
];
$critical = array_slice($checks, 0, 8, true);
$envOk = !in_array(false, $critical, true);

$errors = []; $v = ['db_host' => 'localhost', 'db_port' => '3306', 'db_name' => 'expense_tracker', 'db_user' => '', 'app_url' => '', 'timezone' => 'Africa/Dar_es_Salaam', 'admin_name' => '', 'admin_email' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($v as $k => $_) $v[$k] = trim((string)($_POST[$k] ?? $v[$k]));
    $dbPass = (string)($_POST['db_pass'] ?? '');
    $pw = (string)($_POST['admin_password'] ?? ''); $pw2 = (string)($_POST['admin_password2'] ?? '');
    if (!hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) $errors[] = 'Security check failed. Reload the page and try again.';
    if (!hash_equals(trim((string)@file_get_contents($tokenFile)), trim((string)($_POST['install_token'] ?? '')))) $errors[] = 'The installation token is wrong. Copy it from backend/storage/install_token.txt.';
    if (!$envOk) $errors[] = 'Fix the failed requirements first.';
    if (!preg_match('/^[A-Za-z0-9_]{1,64}$/', $v['db_name'])) $errors[] = 'Database name may contain letters, numbers and underscores only.';
    if (!ctype_digit($v['db_port'])) $errors[] = 'Database port must be a number.';
    if (mb_strlen($v['admin_name']) < 2) $errors[] = 'Enter the administrator\'s full name.';
    if (!filter_var($v['admin_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid administrator email.';
    if (strlen($pw) < 10 || !preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) $errors[] = 'Admin password must be at least 10 characters with letters and numbers.';
    if ($pw !== $pw2) $errors[] = 'Admin passwords do not match.';
    if (!in_array($v['timezone'], timezone_identifiers_list(), true)) $errors[] = 'Choose a valid timezone.';
    if ($v['app_url'] !== '' && !preg_match('#^https?://[^\s]+$#', $v['app_url'])) $errors[] = 'Application URL must start with http:// or https://';

    if (!$errors) {
        try {
            $pdo = new PDO("mysql:host={$v['db_host']};port={$v['db_port']};charset=utf8mb4", $v['db_user'], $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            try { $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . $v['db_name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); } catch (PDOException $e) { /* may lack privilege; DB might already exist */ }
            $pdo->exec('USE `' . $v['db_name'] . '`');
            $exists = $pdo->query("SHOW TABLES LIKE 'users'")->fetchColumn();
            if ($exists && (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) throw new RuntimeException('This database already contains Expense Tracker data. Use an empty database.');
            $pdo->exec("SET time_zone = '+00:00'");

            $runFile = function (string $file) use ($pdo) {
                $sql = preg_replace('/^\s*--.*$/m', '', (string)file_get_contents($file));
                foreach (preg_split('/;\s*[\r\n]+/', $sql) as $stmt) { $stmt = trim($stmt); if ($stmt !== '') $pdo->exec($stmt); }
            };
            $runFile($root . '/../database/schema.sql');
            $runFile($root . '/../database/initial-settings.sql');
            $warn = [];
            try {
                $pdo->exec("CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only'");
                $pdo->exec("CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only'");
            } catch (PDOException $e) { $warn[] = 'Could not create audit-log protection triggers (the database user needs the TRIGGER privilege). The audit log still works but is not tamper-proof at database level.'; }

            $set = $pdo->prepare('INSERT INTO system_settings (skey, svalue) VALUES (?,?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)');
            $set->execute(['app_timezone', $v['timezone']]);

            $env = "# Generated by install.php - keep private (chmod 600). Never commit this file.\n"
                . "APP_ENV=production\nAPP_DEBUG=false\nAPP_URL={$v['app_url']}\nAPP_TIMEZONE={$v['timezone']}\nAPP_KEY=" . bin2hex(random_bytes(32)) . "\n"
                . "DB_HOST={$v['db_host']}\nDB_PORT={$v['db_port']}\nDB_NAME={$v['db_name']}\nDB_USER={$v['db_user']}\nDB_PASS=\"" . str_replace(['\\', '"'], ['\\\\', '\"'], $dbPass) . "\"\n"
                . "MAIL_FROM=\nCRON_KEY=" . bin2hex(random_bytes(16)) . "\nALLOW_UNINSTALL=false\n";
            if (@file_put_contents($root . '/.env', $env) === false) throw new RuntimeException('Could not write backend/.env. Check folder permissions.');
            @chmod($root . '/.env', 0600);

            // Super Admin (created with the installer's own PDO, then default data via the app code)
            $pdo->prepare("INSERT INTO users (full_name, email, phone, password_hash, role, status, email_verified_at) VALUES (?,?,NULL,?,'super_admin','active',UTC_TIMESTAMP())")
                ->execute([$v['admin_name'], strtolower($v['admin_email']), password_hash($pw, PASSWORD_DEFAULT)]);
            $adminId = (int)$pdo->lastInsertId();
            require_once $root . '/bootstrap.php';
            AuthenticationService::seedDefaults($adminId);
            audit($adminId, 'installed', 'system', null);

            // Verify
            $tables = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()")->fetchColumn();
            if ($tables < 20 || !(int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='super_admin'")->fetchColumn()) throw new RuntimeException('Installation could not be verified.');

            @file_put_contents($lock, 'installed ' . gmdate('c'));
            @unlink($tokenFile);
            session_destroy();
            $login = $v['app_url'] !== '' ? $v['app_url'] . '/login.html' : '../login.html';
            page('<h1>Installation complete &#10003;</h1><p class="sub">Expense Tracker is ready.</p><ul><li>' . $tables . ' database tables created</li><li>Super Admin account created for <b>' . h($v['admin_email']) . '</b></li><li>Installer locked and token deleted</li></ul>'
                . ($warn ? '<div class="note">' . h(implode(' ', $warn)) . '</div>' : '')
                . '<h2>Next steps</h2><ol><li>Log in at <a href="' . h($login) . '">' . h($login) . '</a> with the email and password you just chose.</li><li>Open <b>Admin &rarr; Settings</b> and add your payment methods, support phone and email.</li><li>Set up the daily cron job (see README).</li><li>For extra safety delete <code>backend/install.php</code> from the server.</li></ol>');
        } catch (Throwable $e) {
            error_log('install: ' . $e->getMessage());
            $errors[] = $e instanceof PDOException ? 'Database error: ' . $e->getMessage() : $e->getMessage();
        }
    }
}

$rows = '';
foreach ($checks as $label => $ok) $rows .= '<tr><td>' . h($label) . '</td><td class="' . ($ok ? 'ok' : 'bad') . '" style="text-align:right">' . ($ok ? 'OK' : 'Missing') . '</td></tr>';
$tzOpts = ''; foreach (['Africa/Dar_es_Salaam', 'Africa/Nairobi', 'Africa/Kampala', 'UTC'] as $tz) $tzOpts .= '<option' . ($tz === $v['timezone'] ? ' selected' : '') . '>' . $tz . '</option>';
$err = $errors ? '<div class="err"><b>Please fix:</b><br>' . implode('<br>', array_map('h', $errors)) . '</div>' : '';
page('<h1>Install Expense Tracker</h1><p class="sub">Developed by MABUMBATECH &middot; takes about a minute</p>' . $err . '<h2>1. Server check</h2><table>' . $rows . '</table>
<form method="post" autocomplete="off"><input type="hidden" name="csrf" value="' . h($_SESSION['csrf']) . '">
<h2>2. Installation token</h2><div class="note">Open the file <code>backend/storage/install_token.txt</code> on your server and paste its content. This proves you own the server.</div>
<label>Installation token</label><input name="install_token" required>
<h2>3. Database (MySQL / MariaDB)</h2><div class="row"><div><label>Host</label><input name="db_host" value="' . h($v['db_host']) . '" required></div><div><label>Port</label><input name="db_port" value="' . h($v['db_port']) . '" required></div></div>
<label>Database name</label><input name="db_name" value="' . h($v['db_name']) . '" required><div class="row"><div><label>Database user</label><input name="db_user" value="' . h($v['db_user']) . '" required></div><div><label>Database password</label><input name="db_pass" type="password"></div></div>
<h2>4. Application</h2><label>Application URL <small>(e.g. https://tracker.example.com &mdash; no trailing slash; used in emails)</small></label><input name="app_url" value="' . h($v['app_url']) . '" placeholder="https://">
<label>Timezone</label><select name="timezone" style="width:100%;padding:11px;border-radius:10px;border:1.5px solid #d0d5dd">' . $tzOpts . '</select>
<h2>5. Super Admin account</h2><label>Full name</label><input name="admin_name" value="' . h($v['admin_name']) . '" required><label>Email address</label><input name="admin_email" type="email" value="' . h($v['admin_email']) . '" required>
<div class="row"><div><label>Password <small>(10+ characters, letters and numbers)</small></label><input name="admin_password" type="password" required></div><div><label>Confirm password</label><input name="admin_password2" type="password" required></div></div>
<button type="submit"' . ($envOk ? '' : ' disabled') . '>Install Expense Tracker</button></form>');
