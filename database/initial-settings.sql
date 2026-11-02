-- Initial system settings and the default subscription plan.
-- Applied by backend/install.php (safe to re-run: uses INSERT IGNORE).
INSERT IGNORE INTO system_settings (skey, svalue) VALUES
('app_name', 'BudgetFlow'),
('brand_primary', '#182236'),
('brand_gold', '#3d8bff'),
('welcome_popup_message', 'Welcome to BudgetFlow'),
('landing_announcement', ''),
('trial_days', '30'),
('billing_rule', 'calendar_month'),
('reminder_days', '7,3,1'),
('expired_allowed_features', '["expenses","accounts","categories","dashboard_basic","notifications","subscription","support","profile","settings"]'),
('msg_welcome', 'Welcome to BudgetFlow! Your account is ready.'),
('msg_trial', 'Welcome to BudgetFlow! Your {days}-day free trial is now active. Enjoy full access to all features.'),
('msg_approved', 'Your payment was approved. Your subscription is active until {date}.'),
('msg_rejected', 'Your payment could not be approved. {reason}'),
('msg_expired', 'Your subscription has expired. You can continue recording expenses, but some features are temporarily restricted. Renew your subscription to restore full access.'),
('support_phone', ''),
('support_email', ''),
('support_whatsapp', ''),
('support_hours', ''),
('help_text', ''),
('default_currency', 'TZS'),
('app_timezone', 'Africa/Dar_es_Salaam'),
('date_format', 'd M Y'),
('maintenance_mode', '0'),
('registration_open', '1'),
('require_email_verification', '0'),
('session_timeout_minutes', '120'),
('max_login_attempts', '5'),
('lockout_minutes', '15'),
('backup_retention_days', '14');

INSERT INTO subscription_plans (name, price, period_months, is_active, is_default)
SELECT 'Monthly', 5000.00, 1, 1, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans);
