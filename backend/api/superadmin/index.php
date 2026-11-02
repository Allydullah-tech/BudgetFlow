<?php
declare(strict_types=1);

/** Super Admin API. Every route requires the super_admin role (checked on the server). Customers' private financial records are NOT exposed here. */
return function (string $method, array $p): void {
    $admin = require_admin();
    $res = $p[0] ?? '';
    $handlers = ['dashboard', 'customers', 'payments', 'payment-methods', 'plans', 'settings', 'announcements', 'audit-logs', 'backup', 'reports'];
    if (!in_array($res, $handlers, true)) return;
    $fn = require __DIR__ . '/' . $res . '.php';
    $fn($admin, $method, array_slice($p, 1));
};
