<?php
declare(strict_types=1);

return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];
    $id = $p[0] ?? null;

    if ($method === 'GET') {
        json_ok(['items' => q_all('SELECT a.*, u.full_name AS creator, pu.full_name AS publisher FROM announcements a JOIN users u ON u.id = a.created_by LEFT JOIN users pu ON pu.id = a.published_by ORDER BY a.id DESC LIMIT 200')]);
    }
    $validate = function (array $in): array {
        $v = new V($in);
        $d = ['title' => $v->str('title', 'Title', true, 160), 'body' => $v->str('body', 'Message', true, 3000),
              'audience' => $v->enum('audience', 'Audience', ['all', 'trial', 'active', 'expired', 'selected']), 'targets' => null, 'scheduled_at' => null];
        if ($d['audience'] === 'selected') {
            $ids = array_values(array_unique(array_filter(array_map('intval', (array)($in['target_user_ids'] ?? [])))));
            if (!$ids) $v->fail('target_user_ids', 'Choose at least one customer.'); else $d['targets'] = json_encode($ids);
        }
        if (!empty($in['scheduled_at'])) {
            $ts = strtotime((string)$in['scheduled_at']); // admin enters local time; stored as UTC
            if (!$ts) $v->fail('scheduled_at', 'Enter a valid date and time.'); else $d['scheduled_at'] = gmdate('Y-m-d H:i:s', $ts);
        }
        $v->done();
        return $d;
    };

    if ($method === 'POST' && $id === null) {
        $in = input(); $d = $validate($in);
        q('INSERT INTO announcements (title, body, audience, target_user_ids, scheduled_at, created_by) VALUES (?,?,?,?,?,?)', [$d['title'], $d['body'], $d['audience'], $d['targets'], $d['scheduled_at'], $aid]);
        $nid = (int)db()->lastInsertId();
        audit($aid, 'announcement_created', 'announcement', $nid);
        $sent = 0;
        if (!empty($in['publish_now']) && !$d['scheduled_at']) $sent = NotificationService::publishAnnouncement(q_one('SELECT * FROM announcements WHERE id = ?', [$nid]), $aid);
        json_ok(['id' => $nid, 'sent' => $sent], $sent ? "Announcement sent to $sent customer(s)." : ($d['scheduled_at'] ? 'Announcement scheduled.' : 'Announcement saved as draft.'), 201);
    }
    if ($id === null || !ctype_digit($id)) return;
    $row = q_one('SELECT * FROM announcements WHERE id = ?', [(int)$id]) ?? throw new ApiException('Announcement not found.', 404);
    $sub = $p[1] ?? null;
    if ($method === 'POST' && $sub === 'publish') {
        if ($row['published_at']) throw new ApiException('Already published.', 409);
        $n = NotificationService::publishAnnouncement($row, $aid);
        audit($aid, 'announcement_published', 'announcement', $row['id'], 'success', ['recipients' => $n]);
        json_ok(['sent' => $n], "Sent to $n customer(s).");
    }
    if ($row['published_at']) throw new ApiException('Published announcements cannot be changed.', 409);
    if ($method === 'PUT') {
        $d = $validate(input());
        q('UPDATE announcements SET title=?, body=?, audience=?, target_user_ids=?, scheduled_at=? WHERE id=?', [$d['title'], $d['body'], $d['audience'], $d['targets'], $d['scheduled_at'], $row['id']]);
        audit($aid, 'announcement_updated', 'announcement', $row['id']);
        json_ok(null, 'Announcement saved.');
    }
    if ($method === 'DELETE') { q('DELETE FROM announcements WHERE id = ?', [$row['id']]); audit($aid, 'announcement_deleted', 'announcement', $row['id']); json_ok(null, 'Announcement deleted.'); }
};
