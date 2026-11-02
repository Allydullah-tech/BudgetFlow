<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('profile');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) json_ok(['id' => $uid, 'full_name' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone'], 'created_at' => $user['created_at'], 'role' => $user['role']]);

    if ($method === 'GET' && $a === 'avatar') {
        if (!$user['profile_image']) throw new ApiException('No image.', 404);
        serve_private_file('avatars', $user['profile_image']);
    }

    if ($method === 'PUT' && $a === null) {
        $in = input(); $v = new V($in);
        $name = $v->str('full_name', 'Full name', true, 120, 2); $email = $v->email(); $phone = $v->phone('phone', 'Phone number', true);
        $v->done();
        if ($email !== $user['email']) {
            $hash = q_val('SELECT password_hash FROM users WHERE id = ?', [$uid]);
            if (!password_verify((string)($in['current_password'] ?? ''), (string)$hash)) throw new ApiException('Enter your current password to change your email.', 422, ['current_password' => 'Your current password is required to change your email.']);
            if (q_val('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $uid])) throw new ApiException('That email is already in use.', 422, ['email' => 'That email is already in use.']);
            audit($uid, 'email_changed', 'user', $uid);
            NotificationService::send($uid, 'security', 'Email address changed', 'Your account email was changed.', 'profile.html');
        }
        q('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?', [$name, $email, $phone, $uid]);
        json_ok(null, 'Profile saved.');
    }

    if ($method === 'POST' && $a === 'password') {
        $in = input();
        AuthenticationService::changePassword($user, (string)($in['current_password'] ?? ''), (string)($in['new_password'] ?? ''), (string)($in['confirm_password'] ?? ''));
        json_ok(null, 'Password changed.');
    }

    if ($method === 'POST' && $a === 'avatar') {
        if (empty($_FILES['image'])) throw new ApiException('Please choose an image.', 422);
        $name = store_private_file($_FILES['image'], 'avatars');
        if ($user['profile_image']) @unlink(STORAGE_PATH . '/avatars/' . basename($user['profile_image']));
        q('UPDATE users SET profile_image = ? WHERE id = ?', [$name, $uid]);
        json_ok(null, 'Photo updated.');
    }

    // Account export: everything belonging to this user (and nothing else), as JSON.
    if ($method === 'GET' && $a === 'export') {
        $data = ['exported_at' => gmdate('c'), 'profile' => ['name' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone'], 'registered' => $user['created_at']]];
        foreach (['financial_accounts', 'categories', 'transactions', 'debts', 'debt_payments', 'budgets', 'savings_goals', 'recurring_transactions', 'notifications', 'subscription_payments'] as $t) {
            $cols = $t === 'transactions' ? 'id,account_id,type,amount,category_id,title,party,payment_method,txn_date,reference,description,status,created_at' : '*';
            $rows = q_all("SELECT $cols FROM `$t` WHERE user_id = ?", [$uid]);
            foreach ($rows as &$r) { unset($r['receipt_file'], $r['approved_ref_key']); }
            $data[$t] = $rows;
        }
        audit($uid, 'account_exported', 'user', $uid);
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="expense-tracker-export-' . today() . '.json"');
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); exit;
    }

    // Account deletion: requires password + typed confirmation. Financial data is erased; the user row is anonymised
    // and subscription payment records are kept for the business's own accounting.
    if ($method === 'POST' && $a === 'delete') {
        $in = input();
        if ($user['role'] === 'super_admin') throw new ApiException('The Super Admin account cannot be deleted here.', 403);
        $hash = q_val('SELECT password_hash FROM users WHERE id = ?', [$uid]);
        if (!password_verify((string)($in['password'] ?? ''), (string)$hash)) throw new ApiException('Your password is incorrect.', 422, ['password' => 'Your password is incorrect.']);
        if (($in['confirm'] ?? '') !== 'DELETE') throw new ApiException('Type DELETE to confirm.', 422, ['confirm' => 'Type DELETE to confirm.']);
        in_tx(function () use ($uid) {
            foreach (['transactions', 'debt_payments', 'recurring_transactions', 'budgets', 'savings_goals', 'debts', 'categories', 'financial_accounts', 'notifications'] as $t) {
                q("DELETE FROM `$t` WHERE user_id = ?", [$uid]);
            }
            q('DELETE FROM user_settings WHERE user_id = ?', [$uid]);
            q("UPDATE users SET deleted_at = ?, status = 'suspended', full_name = 'Deleted user', email = ?, phone = NULL, profile_image = NULL, password_hash = ? WHERE id = ?",
                [now_utc(), 'deleted-' . $uid . '@invalid.local', password_hash(random_token(), PASSWORD_DEFAULT), $uid]);
        });
        audit($uid, 'account_deleted', 'user', $uid);
        AuthenticationService::logout();
        json_ok(null, 'Your account and financial data were deleted.');
    }
};
