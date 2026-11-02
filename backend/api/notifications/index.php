<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('notifications');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === 'count') json_ok(['unread' => (int)q_val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0 AND dismissed_at IS NULL', [$uid])]);

    if ($method === 'GET' && $a === null) {
        NotificationService::runUserChecks($uid);
        $hist = ($_GET['history'] ?? '') === '1';
        $where = 'user_id = ?' . ($hist ? '' : ' AND dismissed_at IS NULL') . (($_GET['unread'] ?? '') === '1' ? ' AND is_read = 0' : '');
        [$page, $per, $off] = paginate_params(20);
        $total = (int)q_val("SELECT COUNT(*) FROM notifications WHERE $where", [$uid]);
        $items = q_all("SELECT id, type, title, body, link, is_read, dismissed_at IS NOT NULL AS dismissed, created_at FROM notifications WHERE $where ORDER BY id DESC LIMIT $per OFFSET $off", [$uid]);
        json_ok(['items' => $items, 'total' => $total, 'pages' => (int)ceil($total / $per), 'page' => $page,
                 'unread' => (int)q_val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0 AND dismissed_at IS NULL', [$uid])]);
    }
    if ($method === 'POST' && $a === 'read-all') { q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$uid]); json_ok(null, 'All marked as read.'); }
    if ($a !== null && ctype_digit($a)) {
        owned('notifications', (int)$a, $uid);
        if ($method === 'POST' && ($p[1] ?? '') === 'read') { q('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [$a, $uid]); json_ok(null, 'Marked as read.'); }
        if ($method === 'POST' && ($p[1] ?? '') === 'dismiss') { q('UPDATE notifications SET is_read = 1, dismissed_at = ? WHERE id = ? AND user_id = ?', [now_utc(), $a, $uid]); json_ok(null, 'Dismissed.'); }
    }
};
