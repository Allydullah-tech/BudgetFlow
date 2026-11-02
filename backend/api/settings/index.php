<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $a = $p[0] ?? '';

    // Public, non-sensitive settings used by the landing page, welcome popup and help centre.
    if ($method === 'GET' && $a === 'public') {
        $plan = SubscriptionService::defaultPlan();
        json_ok([
            'app_name' => setting('app_name', 'BudgetFlow'),
            'brand_primary' => setting('brand_primary', '#182236'),
            'brand_gold' => setting('brand_gold', '#3d8bff'),
            'welcome_popup_message' => setting('welcome_popup_message', 'Welcome to BudgetFlow'),
            'landing_announcement' => setting('landing_announcement', ''),
            'trial_days' => (int)setting('trial_days', 30),
            'plan' => $plan ? ['name' => $plan['name'], 'price' => $plan['price'], 'period_months' => (int)$plan['period_months']] : null,
            'currency' => setting('default_currency', 'TZS'),
            'registration_open' => setting('registration_open', '1') === '1',
            'maintenance' => setting('maintenance_mode', '0') === '1',
            'support' => [
                'phone' => setting('support_phone', ''), 'email' => setting('support_email', ''), 'whatsapp' => setting('support_whatsapp', ''),
                'hours' => setting('support_hours', ''), 'help_text' => setting('help_text', ''),
            ],
            'logo_custom' => is_file(dirname(__DIR__, 3) . '/frontend/assets/images/brand/logo.png'),
            'mabumbatech_logo' => is_file(dirname(__DIR__, 3) . '/frontend/assets/images/brand/mabumbatech-logo.png'),
        ]);
    }

    $user = require_feature('settings');
    $uid = (int)$user['id'];
    if ($method === 'GET' && ($a === '' || $a === 'me')) {
        json_ok(q_one('SELECT timezone, date_format, theme, notify_budget, notify_debt, notify_recurring, notify_savings FROM user_settings WHERE user_id = ?', [$uid]));
    }
    if ($method === 'PUT' && ($a === '' || $a === 'me')) {
        $v = new V(input());
        $tz = $v->str('timezone', 'Timezone', true, 64);
        if ($tz && !in_array($tz, timezone_identifiers_list(), true)) $v->fail('timezone', 'Choose a valid timezone.');
        $df = $v->enum('date_format', 'Date format', ['d M Y', 'd/m/Y', 'Y-m-d', 'm/d/Y']);
        $theme = $v->enum('theme', 'Theme', ['light', 'dark', 'system']);
        $v->done();
        q('UPDATE user_settings SET timezone=?, date_format=?, theme=?, notify_budget=?, notify_debt=?, notify_recurring=?, notify_savings=? WHERE user_id=?',
            [$tz, $df, $theme, $v->bool('notify_budget'), $v->bool('notify_debt'), $v->bool('notify_recurring'), $v->bool('notify_savings'), $uid]);
        json_ok(null, 'Settings saved.');
    }
};
