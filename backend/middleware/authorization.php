<?php
declare(strict_types=1);

/** Role checks are always made against the database role, never against anything sent by the browser. */
function require_admin(): array
{
    $u = require_auth();
    if ($u['role'] !== 'super_admin') {
        audit((int)$u['id'], 'admin_access_denied', 'route', $_SERVER['REQUEST_URI'] ?? '', 'failure');
        throw new ApiException('You are not allowed to do this.', 403, [], 'forbidden');
    }
    return $u;
}

/** Ownership guard: fetch a row that must belong to the user, or 404 (never reveals other users' ids). */
function owned(string $table, int $id, int $uid, string $extra = ''): array
{
    static $allowed = ['transactions','financial_accounts','categories','debts','debt_payments','budgets','savings_goals','recurring_transactions','notifications','subscription_payments'];
    if (!in_array($table, $allowed, true)) throw new LogicException('Bad table');
    $row = q_one("SELECT * FROM `$table` WHERE id = ? AND user_id = ? $extra", [$id, $uid]);
    if (!$row) throw new ApiException('Record not found.', 404);
    return $row;
}
