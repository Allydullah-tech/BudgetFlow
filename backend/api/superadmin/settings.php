<?php
declare(strict_types=1);

/** Whitelisted, validated system settings. Anything not listed here cannot be changed through the API. */
const SETTING_SPEC = [
    // key => [type, max/extra]
    'app_name' => ['text', 60], 'brand_primary' => ['color'], 'brand_gold' => ['color'],
    'welcome_popup_message' => ['text', 120], 'landing_announcement' => ['text', 300],
    'trial_days' => ['int', 0, 365], 'billing_rule' => ['enum', ['calendar_month', 'fixed_30']], 'reminder_days' => ['csvint'],
    'expired_allowed_features' => ['features'],
    'msg_welcome' => ['text', 500], 'msg_trial' => ['text', 500], 'msg_approved' => ['text', 500], 'msg_rejected' => ['text', 500], 'msg_expired' => ['text', 500],
    'support_phone' => ['phone'], 'support_email' => ['email'], 'support_whatsapp' => ['phone'], 'support_hours' => ['text', 120], 'help_text' => ['text', 1000],
    'app_timezone' => ['tz'], 'date_format' => ['enum', ['d M Y', 'd/m/Y', 'Y-m-d', 'm/d/Y']],
    'maintenance_mode' => ['bool'], 'registration_open' => ['bool'], 'require_email_verification' => ['bool'],
    'session_timeout_minutes' => ['int', 5, 1440], 'max_login_attempts' => ['int', 3, 20], 'lockout_minutes' => ['int', 1, 1440], 'backup_retention_days' => ['int', 1, 365],
];
const ALL_FEATURES = ['expenses', 'income', 'transactions', 'accounts', 'categories', 'debts', 'budgets', 'savings', 'recurring', 'analytics', 'insights', 'reports', 'pdf', 'export',
                      'dashboard_basic', 'notifications', 'subscription', 'support', 'profile', 'settings'];

return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];

    if ($method === 'GET') {
        $out = [];
        foreach (SETTING_SPEC as $k => $_) $out[$k] = setting($k, '');
        $out['expired_allowed_features'] = json_decode((string)setting('expired_allowed_features', '[]'), true) ?: [];
        json_ok(['settings' => $out, 'all_features' => ALL_FEATURES, 'logo_custom' => is_file(dirname(__DIR__, 3) . '/frontend/assets/images/brand/logo.png'),
                 'mabumbatech_custom' => is_file(dirname(__DIR__, 3) . '/frontend/assets/images/brand/mabumbatech-logo.png')]);
    }

    if ($method === 'POST' && ($p[0] ?? '') === 'logo') {
        $kind = (string)($_POST['kind'] ?? '');
        if (!in_array($kind, ['app', 'mabumbatech'], true)) throw new ApiException('Choose which logo to replace.', 422);
        if (empty($_FILES['logo'])) throw new ApiException('Please choose an image (PNG with transparency works best).', 422);
        [$ext] = validate_upload($_FILES['logo'], 2097152, ['image/png' => 'png']);
        $dir = dirname(__DIR__, 3) . '/frontend/assets/images/brand';
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) throw new ApiException('The brand folder is not writable.', 500);
        $dest = $dir . '/' . ($kind === 'app' ? 'logo.png' : 'mabumbatech-logo.png');
        if (!@move_uploaded_file($_FILES['logo']['tmp_name'], $dest) && !(defined('ET_TESTING') && @copy($_FILES['logo']['tmp_name'], $dest))) throw new ApiException('Could not save the logo. Check folder permissions.', 500);
        audit($aid, 'logo_changed', 'branding', $kind);
        json_ok(null, 'Logo updated.');
    }
    if ($method === 'DELETE' && ($p[0] ?? '') === 'logo' && isset($p[1]) && in_array($p[1], ['app', 'mabumbatech'], true)) {
        @unlink(dirname(__DIR__, 3) . '/frontend/assets/images/brand/' . ($p[1] === 'app' ? 'logo.png' : 'mabumbatech-logo.png'));
        audit($aid, 'logo_reset', 'branding', $p[1]);
        json_ok(null, 'Original logo restored.');
    }

    if ($method === 'PUT') {
        $in = input(); $v = new V($in); $clean = [];
        foreach (SETTING_SPEC as $k => $spec) {
            if (!array_key_exists($k, $in)) continue;
            $raw = $in[$k];
            switch ($spec[0]) {
                case 'text': $s = $v->str($k, $k, false, $spec[1]); $clean[$k] = $s ?? ''; break;
                case 'color': $s = (string)$raw; if (!preg_match('/^#[0-9a-fA-F]{6}$/', $s)) $v->fail($k, 'Use a colour like #182236.'); $clean[$k] = $s; break;
                case 'int': if (!is_numeric($raw) || (int)$raw < $spec[1] || (int)$raw > $spec[2]) $v->fail($k, "Enter a whole number from {$spec[1]} to {$spec[2]}."); $clean[$k] = (string)(int)$raw; break;
                case 'enum': if (!in_array($raw, $spec[1], true)) $v->fail($k, 'Not a valid choice.'); $clean[$k] = (string)$raw; break;
                case 'bool': $clean[$k] = $v->bool($k) ? '1' : '0'; break;
                case 'csvint': $nums = array_values(array_unique(array_filter(array_map('intval', explode(',', (string)$raw)), fn($n) => $n > 0 && $n <= 365))); rsort($nums); if (!$nums) $v->fail($k, 'Enter day numbers like 7,3,1.'); $clean[$k] = implode(',', $nums); break;
                case 'email': $s = trim((string)$raw); if ($s !== '' && !filter_var($s, FILTER_VALIDATE_EMAIL)) $v->fail($k, 'Enter a valid email.'); $clean[$k] = $s; break;
                case 'phone': $s = trim((string)$raw); if ($s !== '' && !preg_match('/^\+?[0-9 ()\-]{7,20}$/', $s)) $v->fail($k, 'Enter a valid phone number.'); $clean[$k] = $s; break;
                case 'tz': if (!in_array($raw, timezone_identifiers_list(), true)) $v->fail($k, 'Choose a valid timezone.'); $clean[$k] = (string)$raw; break;
                case 'features': $f = array_values(array_intersect(ALL_FEATURES, (array)$raw)); foreach (['subscription', 'notifications', 'support', 'profile'] as $must) if (!in_array($must, $f, true)) $f[] = $must; $clean[$k] = json_encode(array_values(array_unique($f))); break;
            }
        }
        $v->done();
        $changed = [];
        in_tx(function () use ($clean, $aid, &$changed) {
            foreach ($clean as $k => $val) {
                $old = q_val('SELECT svalue FROM system_settings WHERE skey = ?', [$k]);
                if ($old === $val) continue;
                q('INSERT INTO system_settings (skey, svalue, updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue), updated_by = VALUES(updated_by)', [$k, $val, $aid]);
                $changed[] = $k;
            }
        });
        if ($changed) audit($aid, 'settings_changed', 'settings', null, 'success', ['keys' => $changed]);
        json_ok(['changed' => $changed], $changed ? 'Settings saved.' : 'Nothing changed.');
    }
};
