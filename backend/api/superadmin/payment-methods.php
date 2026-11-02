<?php
declare(strict_types=1);

/** Configurable payment methods + QR codes. Multipart POST is used for create/update so a QR image can accompany the fields. */
return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];
    $id = $p[0] ?? null;

    if ($method === 'GET' && $id === null) json_ok(['items' => q_all('SELECT id, name, kind, provider, recipient_name, account_number, instructions, qr_file IS NOT NULL AS has_qr, is_active, sort_order FROM payment_methods ORDER BY sort_order, id')]);
    if ($method === 'GET' && $id !== null && ctype_digit($id) && ($p[1] ?? '') === 'qr') {
        $m = q_one('SELECT qr_file FROM payment_methods WHERE id = ?', [(int)$id]);
        if (!$m || !$m['qr_file']) throw new ApiException('No QR code.', 404);
        serve_private_file('qr', $m['qr_file']);
    }

    $fields = function (array $in): array {
        $v = new V($in);
        $d = ['name' => $v->str('name', 'Method name', true, 80), 'kind' => $v->enum('kind', 'Type', ['mobile_money', 'bank', 'other']),
              'provider' => $v->str('provider', 'Provider or bank', false, 80), 'recipient_name' => $v->str('recipient_name', 'Recipient name', false, 120),
              'account_number' => $v->str('account_number', 'Phone or account number', true, 60), 'instructions' => $v->str('instructions', 'Instructions', false, 2000)];
        $v->done();
        return $d;
    };

    if ($method === 'POST' && $id === null) {
        $d = $fields(input());
        $qr = !empty($_FILES['qr']) && $_FILES['qr']['error'] !== UPLOAD_ERR_NO_FILE ? store_private_file($_FILES['qr'], 'qr') : null;
        $order = (int)q_val('SELECT COALESCE(MAX(sort_order),0)+1 FROM payment_methods');
        q('INSERT INTO payment_methods (name, kind, provider, recipient_name, account_number, instructions, qr_file, sort_order) VALUES (?,?,?,?,?,?,?,?)',
            [$d['name'], $d['kind'], $d['provider'], $d['recipient_name'], $d['account_number'], $d['instructions'], $qr, $order]);
        $nid = (int)db()->lastInsertId();
        audit($aid, 'payment_method_created', 'payment_method', $nid);
        json_ok(['id' => $nid], 'Payment method added.', 201);
    }
    if ($method === 'POST' && $id === 'reorder') {
        foreach ((array)(input()['ids'] ?? []) as $i => $mid) q('UPDATE payment_methods SET sort_order = ? WHERE id = ?', [$i + 1, (int)$mid]);
        json_ok(null, 'Order saved.');
    }
    if ($id === null || !ctype_digit($id)) return;
    $mid = (int)$id;
    $row = q_one('SELECT * FROM payment_methods WHERE id = ?', [$mid]) ?? throw new ApiException('Payment method not found.', 404);
    $sub = $p[1] ?? null;

    if ($method === 'POST' && $sub === null) { // update fields (+ optional new QR)
        $d = $fields(input());
        $qr = $row['qr_file'];
        if (!empty($_FILES['qr']) && $_FILES['qr']['error'] !== UPLOAD_ERR_NO_FILE) { $new = store_private_file($_FILES['qr'], 'qr'); if ($qr) @unlink(STORAGE_PATH . '/qr/' . basename($qr)); $qr = $new; }
        elseif (!empty(input()['remove_qr']) && $qr) { @unlink(STORAGE_PATH . '/qr/' . basename($qr)); $qr = null; }
        q('UPDATE payment_methods SET name=?, kind=?, provider=?, recipient_name=?, account_number=?, instructions=?, qr_file=? WHERE id=?',
            [$d['name'], $d['kind'], $d['provider'], $d['recipient_name'], $d['account_number'], $d['instructions'], $qr, $mid]);
        audit($aid, 'payment_method_updated', 'payment_method', $mid);
        json_ok(null, 'Payment method saved.');
    }
    if ($method === 'POST' && $sub === 'toggle') {
        q('UPDATE payment_methods SET is_active = 1 - is_active WHERE id = ?', [$mid]);
        audit($aid, 'payment_method_toggled', 'payment_method', $mid);
        json_ok(null, $row['is_active'] ? 'Method deactivated.' : 'Method activated.');
    }
    if ($method === 'DELETE') {
        if ((int)q_val('SELECT COUNT(*) FROM subscription_payments WHERE method_id = ?', [$mid])) throw new ApiException('This method has payment records, so it cannot be deleted. Deactivate it instead.', 409);
        if ($row['qr_file']) @unlink(STORAGE_PATH . '/qr/' . basename($row['qr_file']));
        q('DELETE FROM payment_methods WHERE id = ?', [$mid]);
        audit($aid, 'payment_method_deleted', 'payment_method', $mid);
        json_ok(null, 'Payment method deleted.');
    }
};
