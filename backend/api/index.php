<?php
declare(strict_types=1);

/**
 * JSON API front controller.  URL form:  /api/<module>/<segment>/<segment>...
 * Each module lives in backend/api/<module>/index.php and returns function(string $method, array $parts): void
 */
require_once __DIR__ . '/../bootstrap.php';

send_security_headers();
header('Content-Type: application/json; charset=utf-8');

set_exception_handler(function (Throwable $e) {
    if ($e instanceof ApiException) json_fail($e->getMessage(), $e->status, $e->errors, $e->errorCode);
    log_error($e);
    if ($e instanceof PDOException && ($e->errorInfo[1] ?? 0) === 1062) json_fail('This record already exists.', 409);
    json_fail(APP_DEBUG ? $e->getMessage() : 'Something went wrong on our side. Please try again.', 500);
});

if (!is_file(ET_ROOT . '/.env')) json_fail('The application is not installed yet. Open backend/install.php.', 503, [], 'not_installed');

$path = (string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$pos = strpos($path, '/api/');
$rest = $pos === false ? '' : substr($path, $pos + 5);
$rest = preg_replace('#^index\.php/?#', '', trim($rest, '/'));
$parts = $rest === '' ? [] : array_map('urldecode', explode('/', $rest));
$module = array_shift($parts) ?? '';

$modules = ['auth', 'dashboard', 'income', 'expenses', 'transactions', 'debts', 'debt-payments', 'budgets', 'savings', 'accounts',
            'categories', 'reports', 'notifications', 'subscriptions', 'payments', 'profile', 'settings', 'superadmin', 'support', 'recurring'];
if (!in_array($module, $modules, true)) json_fail('Endpoint not found.', 404);

try {
    start_session();
    csrf_guard();
    if (setting('maintenance_mode', '0') === '1' && !in_array($module, ['auth', 'settings', 'support'], true)) {
        $u = auth_user();
        if (!$u || $u['role'] !== 'super_admin') json_fail('The system is under maintenance. Please try again shortly.', 503, [], 'maintenance');
    }
    $handler = require __DIR__ . '/' . $module . '/index.php';
    $handler(http_method(), $parts);
    json_fail('Endpoint not found.', 404);
} catch (PDOException $e) {
    $code = $e->errorInfo[1] ?? 0;
    if (in_array($code, [1045, 1049, 2002, 2006], true)) { log_error($e); json_fail('The service is temporarily unavailable. Please try again later.', 503, [], 'db_unavailable'); }
    throw $e;
}
