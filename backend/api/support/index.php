<?php
declare(strict_types=1);

/** Public support contact details, read from Super Admin settings. Empty values are returned empty (never placeholders). */
return function (string $method, array $p): void {
    if ($method === 'GET') {
        json_ok([
            'phone' => setting('support_phone', ''), 'email' => setting('support_email', ''), 'whatsapp' => setting('support_whatsapp', ''),
            'hours' => setting('support_hours', ''), 'help_text' => setting('help_text', ''),
        ]);
    }
};
