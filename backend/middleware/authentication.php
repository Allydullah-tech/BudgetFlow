<?php
declare(strict_types=1);

/** Returns the authenticated user row (without password hash) or null. Enforces idle timeout. */
function auth_user(): ?array
{
    static $cached = false;
    if ($cached !== false) return $cached;
    start_session();
    $uid = $_SESSION['uid'] ?? null;
    if (!$uid) return $cached = null;

    $timeout = max(5, (int)setting('session_timeout_minutes', 120)) * 60;
    if (time() - (int)($_SESSION['last_activity'] ?? 0) > $timeout) {
        $_SESSION = [];
        session_destroy();
        return $cached = null;
    }
    $_SESSION['last_activity'] = time();

    $u = q_one('SELECT id, full_name, email, phone, role, status, email_verified_at, profile_image, trial_started_at, trial_ends_at, created_at
                FROM users WHERE id = ? AND deleted_at IS NULL', [$uid]);
    if (!$u || $u['status'] === 'suspended') {
        $_SESSION = [];
        return $cached = null;
    }
    // Reading data does not change the session any further, so release the session lock now.
    // Otherwise PHP makes every request of the same person wait for the previous one to finish.
    if (http_method() === 'GET' && !defined('ET_SESSION_WRITE') && session_status() === PHP_SESSION_ACTIVE) session_write_close();
    return $cached = $u;
}

function require_auth(): array
{
    $u = auth_user();
    if (!$u) throw new ApiException('Your session has expired. Please log in again.', 401, [], 'unauthenticated');
    return $u;
}

function login_session(array $user): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$user['id'];
    $_SESSION['last_activity'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
