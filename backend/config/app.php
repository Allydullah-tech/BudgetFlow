<?php
declare(strict_types=1);

/**
 * Application bootstrap configuration.
 * Reads backend/.env (written by install.php; see .env.example). Never commit the real .env.
 */
define('ET_ROOT', dirname(__DIR__));

function env(string $key, $default = null)
{
    static $vars = null;
    if ($vars === null) {
        $vars = [];
        $file = ET_ROOT . '/.env';
        if (is_file($file)) {
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
                [$k, $v] = explode('=', $line, 2);
                $v = trim($v);
                if (strlen($v) >= 2 && $v[0] === '"' && substr($v, -1) === '"') $v = str_replace(['\\\\', '\\"'], ['\\', '"'], substr($v, 1, -1));
                else $v = trim($v, "'");
                $vars[trim($k)] = $v;
            }
        }
    }
    return $vars[$key] ?? $default;
}

define('APP_DEBUG', env('APP_DEBUG', 'false') === 'true');
define('STORAGE_PATH', rtrim((string)env('STORAGE_PATH', ET_ROOT . '/storage'), '/\\'));
define('APP_KEY', (string)env('APP_KEY', ''));
define('APP_URL', rtrim((string)env('APP_URL', ''), '/'));
date_default_timezone_set((string)env('APP_TIMEZONE', 'Africa/Dar_es_Salaam'));

foreach (['logs', 'receipts', 'qr', 'backups', 'avatars'] as $d) {
    if (!is_dir(STORAGE_PATH . '/' . $d)) @mkdir(STORAGE_PATH . '/' . $d, 0750, true);
}
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', STORAGE_PATH . '/logs/error.log');

/** Money helpers: all amounts are DECIMAL strings in/out of the DB; arithmetic is done on integer cents. */
function to_cents($v): int { return (int)round(((float)$v) * 100); }
function from_cents(int $c): string { return number_format($c / 100, 2, '.', ''); }
function money_fmt($v): string { return 'TZS ' . number_format((float)$v, 2); }

/** Current local date (application timezone) as Y-m-d. */
function today(): string { return (new DateTimeImmutable('now'))->format('Y-m-d'); }
/** Current UTC timestamp for DATETIME columns. */
function now_utc(): string { return gmdate('Y-m-d H:i:s'); }
