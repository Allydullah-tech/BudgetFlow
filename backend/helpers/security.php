<?php
declare(strict_types=1);

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function client_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45); }

function send_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    header('Cache-Control: no-store, no-cache, must-revalidate, private');
    header('Pragma: no-cache');
    if (is_https()) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('ET_SESSION');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    if (is_dir(STORAGE_PATH . '/sessions') || @mkdir(STORAGE_PATH . '/sessions', 0750, true)) {
        session_save_path(STORAGE_PATH . '/sessions');
    }
    session_start();
}

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function random_token(int $bytes = 32): string { return bin2hex(random_bytes($bytes)); }
function hash_token(string $t): string { return hash_hmac('sha256', $t, APP_KEY !== '' ? APP_KEY : 'dev-key'); }

function uuid_v4(): string
{
    $d = random_bytes(16);
    $d[6] = chr(ord($d[6]) & 0x0f | 0x40);
    $d[8] = chr(ord($d[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

/** Append-only audit trail. Never pass passwords/tokens in $meta. */
function audit(?int $actorId, string $action, ?string $entity = null, $entityId = null, string $result = 'success', array $meta = []): void
{
    try {
        q('INSERT INTO audit_logs (actor_id, action, entity, entity_id, result, ip, meta) VALUES (?,?,?,?,?,?,?)', [
            $actorId, $action, $entity, $entityId === null ? null : (string)$entityId, $result, client_ip(),
            $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null,
        ]);
    } catch (Throwable $e) { log_error($e); }
}

/** System settings with defaults and per-request cache. */
function setting(string $key, $default = null)
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        try { foreach (q_all('SELECT skey, svalue FROM system_settings') as $r) $cache[$r['skey']] = $r['svalue']; }
        catch (Throwable $e) { log_error($e); }
    }
    return array_key_exists($key, $cache) && $cache[$key] !== null ? $cache[$key] : $default;
}

/** Validate an uploaded image (receipt/QR/logo). Returns [extension, mime]. */
function validate_upload(array $file, int $maxBytes = 3145728, array $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp']): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) throw new ApiException('File upload failed. Please try again.', 422);
    if ($file['size'] > $maxBytes) throw new ApiException('File is too large (max ' . round($maxBytes / 1048576, 1) . ' MB).', 422);
    if (!is_uploaded_file($file['tmp_name']) && !(defined('ET_TESTING') && ET_TESTING)) throw new ApiException('Invalid upload.', 422);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($allowed[$mime])) throw new ApiException('Only ' . strtoupper(implode(', ', array_values($allowed))) . ' files are allowed.', 422);
    if (strpos($mime, 'image/') === 0 && @getimagesize($file['tmp_name']) === false) throw new ApiException('The file is not a valid image.', 422);
    return [$allowed[$mime], $mime];
}

function store_private_file(array $file, string $dir, array $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp']): string
{
    [$ext] = validate_upload($file, 3145728, $allowed);
    $name = bin2hex(random_bytes(16)) . '.' . $ext;
    $dest = STORAGE_PATH . '/' . $dir . '/' . $name;
    if (!@move_uploaded_file($file['tmp_name'], $dest) && !(defined('ET_TESTING') && ET_TESTING && @copy($file['tmp_name'], $dest))) {
        throw new ApiException('Could not save the uploaded file.', 500);
    }
    @chmod($dest, 0640);
    return $name;
}

function serve_private_file(string $dir, string $name): never
{
    $path = STORAGE_PATH . '/' . $dir . '/' . basename($name);
    if (!is_file($path)) throw new ApiException('File not found.', 404);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . basename($path) . '"');
    header('Cache-Control: private, no-store');
    readfile($path);
    exit;
}
