<?php
declare(strict_types=1);

/** All state-changing requests (anything but GET/HEAD) must carry the session CSRF token. */
function csrf_guard(): void
{
    if (in_array(http_method(), ['GET', 'HEAD', 'OPTIONS'], true)) return;
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($sent === '' || !hash_equals(csrf_token(), $sent)) {
        throw new ApiException('Security check failed. Please refresh the page and try again.', 419, [], 'csrf');
    }
    // Same-origin check as a second layer.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== ($_SERVER['HTTP_HOST'] ?? '') && parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '') !== ($_SERVER['HTTP_HOST'] ?? '')) {
        throw new ApiException('Cross-site request blocked.', 403, [], 'csrf');
    }
}
