<?php
declare(strict_types=1);

/**
 * Scheduled jobs. Run once a day (or every few hours) from the command line:
 *     php /path/to/backend/cron.php            # reminders, announcements
 *     php /path/to/backend/cron.php --backup   # also writes a database backup
 * Everything here is idempotent (dedupe keys), so running it more often is harmless.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/api/superadmin/backup.php';

$started = microtime(true);
$n = 0;
foreach (q_all("SELECT id FROM users WHERE status = 'active' AND deleted_at IS NULL") as $u) {
    try { NotificationService::runUserChecks((int)$u['id']); $n++; } catch (Throwable $e) { log_error($e); }
}
NotificationService::publishDueAnnouncements();
$msg = "checked $n users in " . round(microtime(true) - $started, 2) . 's';
if (in_array('--backup', $argv ?? [], true)) { try { $msg .= '; backup ' . make_backup(); } catch (Throwable $e) { $msg .= '; backup FAILED'; log_error($e); } }
q('INSERT INTO scheduled_jobs (name, last_run_at, last_status) VALUES (?,?,?) ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_status = VALUES(last_status)', ['daily', now_utc(), $msg]);
echo $msg, "\n";
