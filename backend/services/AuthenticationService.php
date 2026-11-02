<?php
declare(strict_types=1);

final class AuthenticationService
{
    public const DEFAULT_INCOME = ['Salary', 'Business income', 'Freelance income', 'Investments', 'Gifts received', 'Rental income', 'Interest', 'Other income'];
    public const DEFAULT_EXPENSE = ['Food', 'Transport', 'Rent', 'Electricity', 'Water', 'Internet', 'Healthcare', 'Education', 'Shopping', 'Entertainment', 'Fuel', 'Business expenses', 'Family expenses', 'Debt interest', 'Other expenses'];

    public static function appUrl(): string
    {
        if (APP_URL !== '') return APP_URL;
        return (is_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }

    public static function sendMail(string $to, string $subject, string $body): bool
    {
        $name = (string)setting('app_name', 'BudgetFlow');
        $from = (string)env('MAIL_FROM', 'no-reply@' . preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? 'localhost'));
        $headers = "From: $name <$from>\r\nContent-Type: text/plain; charset=utf-8\r\nMIME-Version: 1.0";
        $ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
        if (!$ok && APP_DEBUG) error_log("MAIL (not sent) to $to: $subject\n$body");
        return $ok;
    }

    public static function seedDefaults(int $uid): void
    {
        foreach (self::DEFAULT_INCOME as $n) q('INSERT IGNORE INTO categories (user_id, type, name) VALUES (?,?,?)', [$uid, 'income', $n]);
        foreach (self::DEFAULT_EXPENSE as $n) q('INSERT IGNORE INTO categories (user_id, type, name) VALUES (?,?,?)', [$uid, 'expense', $n]);
        q("INSERT IGNORE INTO financial_accounts (user_id, name, type, currency, opening_balance) VALUES (?, 'Cash in Hand', 'cash', ?, 0)", [$uid, (string)setting('default_currency', 'TZS')]);
        q('INSERT IGNORE INTO user_settings (user_id, timezone, date_format) VALUES (?,?,?)', [$uid, (string)setting('app_timezone', 'Africa/Dar_es_Salaam'), (string)setting('date_format', 'd M Y')]);
    }

    public static function register(array $in): array
    {
        if (setting('registration_open', '1') !== '1') throw new ApiException('Registration is currently closed.', 403);
        $v = new V($in);
        $name = $v->str('full_name', 'Full name', true, 120, 2);
        $email = $v->email();
        $phone = $v->phone('phone', 'Phone number', true);
        $pw = (string)($in['password'] ?? '');
        if ($e = check_password_strength($pw)) $v->fail('password', $e);
        if ($pw !== (string)($in['confirm_password'] ?? '')) $v->fail('confirm_password', 'Passwords do not match.');
        if (!$v->bool('accept_terms')) $v->fail('accept_terms', 'Please accept the terms and privacy policy.');
        $v->done();
        if (q_val('SELECT id FROM users WHERE email = ?', [$email])) throw new ApiException('Please correct the highlighted fields.', 422, ['email' => 'An account with this email already exists.']);

        $verify = setting('require_email_verification', '0') === '1';
        $trialDays = max(0, (int)setting('trial_days', 30));
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $uid = (int)in_tx(function () use ($name, $email, $phone, $pw, $verify, $trialDays, $now) {
            q('INSERT INTO users (full_name, email, phone, password_hash, role, status, trial_started_at, trial_ends_at) VALUES (?,?,?,?,?,?,?,?)', [
                $name, $email, $phone, password_hash($pw, PASSWORD_DEFAULT), 'user', $verify ? 'pending_verification' : 'active',
                $now->format('Y-m-d H:i:s'), $now->modify("+$trialDays days")->format('Y-m-d H:i:s'),
            ]);
            $uid = (int)db()->lastInsertId();
            self::seedDefaults($uid);
            NotificationService::send($uid, 'welcome', 'Welcome to ' . setting('app_name', 'BudgetFlow'), (string)setting('msg_welcome'), 'dashboard.html', 'welcome');
            NotificationService::send($uid, 'trial_started', 'Free trial activated', str_replace('{days}', (string)$trialDays, (string)setting('msg_trial')), 'subscription.html', 'trial-start');
            NotificationService::send($uid, 'registration', 'Registration successful', 'Your account has been created. You can now record income, expenses, debts and more.', 'dashboard.html', 'registered');
            return $uid;
        });
        audit($uid, 'register', 'user', $uid);
        NotificationService::toAdmins('new_user', 'New customer registered', "$name ($email) just registered.", 'admin-customers.html');

        if ($verify) {
            $token = random_token();
            q('INSERT INTO account_verification_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)', [$uid, hash_token($token), gmdate('Y-m-d H:i:s', time() + 86400)]);
            self::sendMail($email, 'Verify your email', "Hello $name,\n\nPlease verify your email address:\n" . self::appUrl() . "/login.html?verify=$token\n\nThis link expires in 24 hours.");
            return ['needs_verification' => true];
        }
        $u = q_one('SELECT id FROM users WHERE id = ?', [$uid]);
        login_session($u);
        return ['needs_verification' => false];
    }

    public static function verifyEmail(string $token): void
    {
        $row = q_one('SELECT * FROM account_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', [hash_token($token), now_utc()]);
        if (!$row) throw new ApiException('This verification link is invalid or has expired.', 400);
        in_tx(function () use ($row) {
            q('UPDATE account_verification_tokens SET used_at = ? WHERE id = ?', [now_utc(), $row['id']]);
            q("UPDATE users SET status = 'active', email_verified_at = ? WHERE id = ? AND status = 'pending_verification'", [now_utc(), $row['user_id']]);
        });
        audit((int)$row['user_id'], 'email_verified', 'user', $row['user_id']);
    }

    private static function assertNotLocked(string $email): void
    {
        $max = max(3, (int)setting('max_login_attempts', 5));
        $win = max(1, (int)setting('lockout_minutes', 15));
        $since = gmdate('Y-m-d H:i:s', time() - $win * 60);
        $byEmail = (int)q_val('SELECT COUNT(*) FROM login_attempts WHERE email = ? AND success = 0 AND created_at > ?', [$email, $since]);
        $byIp = (int)q_val('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND success = 0 AND created_at > ?', [client_ip(), $since]);
        if ($byEmail >= $max || $byIp >= $max * 4) {
            throw new ApiException("Too many failed attempts. Please wait $win minutes and try again, or reset your password.", 429, [], 'locked');
        }
    }

    public static function login(array $in): array
    {
        $v = new V($in);
        $email = strtolower(trim((string)($in['email'] ?? '')));
        $pw = (string)($in['password'] ?? '');
        if ($email === '' || $pw === '') { $v->fail('email', 'Enter your email and password.'); $v->done(); }
        self::assertNotLocked($email);

        $u = q_one('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [$email]);
        $hash = $u['password_hash'] ?? '$2y$10$usesomesillystringforsaltuMQ0b8g0qPqJ8e5y4b6bX1p1y3pX3yG';
        $ok = password_verify($pw, $hash) && $u;
        if (!$ok) {
            q('INSERT INTO login_attempts (email, ip, success) VALUES (?,?,0)', [$email, client_ip()]);
            audit($u ? (int)$u['id'] : null, 'login_failed', 'user', $u['id'] ?? null, 'failure', ['email' => $email]);
            throw new ApiException('Invalid email or password.', 401);
        }
        if ($u['status'] === 'suspended') throw new ApiException('Your account is suspended. Please contact support.', 403, [], 'suspended');
        if ($u['status'] === 'pending_verification') throw new ApiException('Please verify your email address first. Check your inbox for the verification link.', 403, [], 'verify');

        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), $u['id']]);
        q('DELETE FROM login_attempts WHERE email = ? AND success = 0', [$email]);
        q('UPDATE users SET last_login_at = ? WHERE id = ?', [now_utc(), $u['id']]);
        login_session($u);
        audit((int)$u['id'], 'login', 'user', $u['id']);
        return ['name' => $u['full_name']];
    }

    public static function forgotPassword(string $email): void
    {
        $email = strtolower(trim($email));
        $u = filter_var($email, FILTER_VALIDATE_EMAIL) ? q_one("SELECT id, full_name FROM users WHERE email = ? AND deleted_at IS NULL AND status <> 'suspended'", [$email]) : null;
        $recent = (int)q_val('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND email = ? AND created_at > ?', [client_ip(), '#reset', gmdate('Y-m-d H:i:s', time() - 3600)]);
        q('INSERT INTO login_attempts (email, ip, success) VALUES (?,?,1)', ['#reset', client_ip()]);
        if ($recent >= 10) return; // silent throttle
        if (!$u) return;
        $token = random_token();
        q('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [now_utc(), $u['id']]);
        q('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)', [$u['id'], hash_token($token), gmdate('Y-m-d H:i:s', time() + 3600)]);
        audit((int)$u['id'], 'password_reset_requested', 'user', $u['id']);
        self::sendMail($email, 'Reset your password', "Hello {$u['full_name']},\n\nUse this link to choose a new password (valid for 1 hour):\n" . self::appUrl() . "/reset-password.html?token=$token\n\nIf you did not request this, ignore this email.");
    }

    public static function resetPassword(string $token, string $pw, string $confirm): void
    {
        if ($e = check_password_strength($pw)) throw new ApiException($e, 422, ['password' => $e]);
        if ($pw !== $confirm) throw new ApiException('Passwords do not match.', 422, ['confirm_password' => 'Passwords do not match.']);
        $row = q_one('SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', [hash_token($token), now_utc()]);
        if (!$row) throw new ApiException('This reset link is invalid or has expired. Please request a new one.', 400);
        in_tx(function () use ($row, $pw) {
            q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), $row['user_id']]);
            q('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [now_utc(), $row['id']]);
        });
        audit((int)$row['user_id'], 'password_reset', 'user', $row['user_id']);
        NotificationService::send((int)$row['user_id'], 'security', 'Password changed', 'Your password was reset. If this was not you, contact support immediately.', 'profile.html');
    }

    public static function changePassword(array $user, string $current, string $new, string $confirm): void
    {
        $hash = q_val('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if (!password_verify($current, (string)$hash)) throw new ApiException('Your current password is incorrect.', 422, ['current_password' => 'Your current password is incorrect.']);
        if ($e = check_password_strength($new)) throw new ApiException($e, 422, ['new_password' => $e]);
        if ($new !== $confirm) throw new ApiException('Passwords do not match.', 422, ['confirm_password' => 'Passwords do not match.']);
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $user['id']]);
        session_regenerate_id(true);
        audit((int)$user['id'], 'password_changed', 'user', $user['id']);
        NotificationService::send((int)$user['id'], 'security', 'Password changed', 'Your password was changed successfully.', 'profile.html');
    }

    public static function logout(): void
    {
        $u = auth_user();
        if ($u) audit((int)$u['id'], 'logout', 'user', $u['id']);
        start_session();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'] ?? '', (bool)$p['secure'], true);
        }
        session_destroy();
    }
}
