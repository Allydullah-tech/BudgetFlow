<?php
declare(strict_types=1);

return function (string $method, array $p): void {
    $user = require_feature('categories');
    $uid = (int)$user['id'];
    $a = $p[0] ?? null;

    if ($method === 'GET' && $a === null) {
        $type = in_array($_GET['type'] ?? '', ['income', 'expense'], true) ? $_GET['type'] : null;
        $sql = 'SELECT c.id, c.type, c.name, c.is_active, (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS uses FROM categories c WHERE c.user_id = ?' . ($type ? ' AND c.type = ?' : '') . (($_GET['all'] ?? '') === '1' ? '' : ' AND c.is_active = 1') . ' ORDER BY c.type, c.name';
        json_ok(['items' => q_all($sql, $type ? [$uid, $type] : [$uid])]);
    }
    if ($method === 'POST' && $a === null) {
        $v = new V(input());
        $name = $v->str('name', 'Category name', true, 80); $type = $v->enum('type', 'Type', ['income', 'expense']);
        $v->done();
        $ex = q_one('SELECT id, is_active FROM categories WHERE user_id = ? AND type = ? AND name = ?', [$uid, $type, $name]);
        if ($ex) {
            if (!$ex['is_active']) { q('UPDATE categories SET is_active = 1 WHERE id = ?', [$ex['id']]); json_ok(['id' => (int)$ex['id']], 'Category restored.'); }
            throw new ApiException('Please correct the highlighted fields.', 422, ['name' => 'You already have this category.']);
        }
        q('INSERT INTO categories (user_id, type, name) VALUES (?,?,?)', [$uid, $type, $name]);
        json_ok(['id' => (int)db()->lastInsertId()], 'Category created.', 201);
    }
    if ($a !== null && ctype_digit($a)) {
        $row = owned('categories', (int)$a, $uid);
        if ($method === 'PUT') {
            $v = new V(input()); $name = $v->str('name', 'Category name', true, 80); $v->done();
            if (q_val('SELECT id FROM categories WHERE user_id = ? AND type = ? AND name = ? AND id <> ?', [$uid, $row['type'], $name, $row['id']])) throw new ApiException('Please correct the highlighted fields.', 422, ['name' => 'You already have this category.']);
            q('UPDATE categories SET name = ? WHERE id = ? AND user_id = ?', [$name, $row['id'], $uid]);
            json_ok(null, 'Category renamed.');
        }
        if ($method === 'DELETE') {
            if ((int)q_val('SELECT COUNT(*) FROM transactions WHERE category_id = ?', [$row['id']]) || (int)q_val('SELECT COUNT(*) FROM budgets WHERE category_id = ?', [$row['id']])) {
                q('UPDATE categories SET is_active = 0 WHERE id = ?', [$row['id']]);
                json_ok(null, 'Category hidden. Existing records keep it.');
            }
            q('DELETE FROM categories WHERE id = ? AND user_id = ?', [$row['id'], $uid]);
            json_ok(null, 'Category deleted.');
        }
    }
};
