<?php
declare(strict_types=1);

/** Read-only view of the audit trail (the table also has database triggers blocking UPDATE/DELETE). */
return function (array $admin, string $method, array $p): void {
    if ($method !== 'GET') return;
    $where = ['1=1']; $params = [];
    if (!empty($_GET['action'])) { $where[] = 'l.action = ?'; $params[] = (string)$_GET['action']; }
    if (!empty($_GET['actor_id'])) { $where[] = 'l.actor_id = ?'; $params[] = (int)$_GET['actor_id']; }
    if (!empty($_GET['result']) && in_array($_GET['result'], ['success', 'failure'], true)) { $where[] = 'l.result = ?'; $params[] = $_GET['result']; }
    if (!empty($_GET['from'])) { $where[] = 'l.created_at >= ?'; $params[] = $_GET['from'] . ' 00:00:00'; }
    if (!empty($_GET['to'])) { $where[] = 'l.created_at <= ?'; $params[] = $_GET['to'] . ' 23:59:59'; }
    [$page, $per, $off] = paginate_params(30);
    $total = (int)q_val('SELECT COUNT(*) FROM audit_logs l WHERE ' . implode(' AND ', $where), $params);
    $items = q_all('SELECT l.id, l.actor_id, u.full_name AS actor, l.action, l.entity, l.entity_id, l.result, l.ip, l.meta, l.created_at FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_id WHERE ' . implode(' AND ', $where) . " ORDER BY l.id DESC LIMIT $per OFFSET $off", $params);
    json_ok(['items' => $items, 'total' => $total, 'pages' => (int)ceil($total / $per), 'page' => $page, 'actions' => array_column(q_all('SELECT DISTINCT action FROM audit_logs ORDER BY action'), 'action')]);
};
