<?php
declare(strict_types=1);

/**
 * Feature gate enforced on the server. Feature keys:
 *  expenses, income, transactions, accounts, categories, debts, budgets, savings, recurring,
 *  analytics, insights, reports, pdf, export, dashboard_basic, notifications, subscription, support, profile, settings
 * While the trial/subscription is active everything is allowed. After expiry only the features in the
 * Super Admin setting "expired_allowed_features" are allowed. Super Admins are never restricted.
 */
function require_feature(string $feature, ?array $user = null): array
{
    $user = $user ?? require_auth();
    if ($user['role'] === 'super_admin') return $user;
    $st = SubscriptionService::status($user);
    if ($st['full_access']) return $user;
    $allowed = json_decode((string)setting('expired_allowed_features', '[]'), true) ?: [];
    if (!in_array($feature, $allowed, true)) {
        throw new ApiException(setting('msg_expired', 'Your subscription has expired. Renew to restore full access.'), 402, ['feature' => $feature], 'subscription_required');
    }
    return $user;
}

function feature_allowed(string $feature, array $user): bool
{
    try { require_feature($feature, $user); return true; } catch (ApiException $e) { return false; }
}
