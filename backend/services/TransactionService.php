<?php
declare(strict_types=1);

/** Ledger operations shared by Income, Expenses, Transactions, Debts, Savings and Transfers. */
final class TransactionService
{
    public static function accountOwned(int $uid, int $accountId, bool $mustBeActive = true): array
    {
        $a = q_one('SELECT * FROM financial_accounts WHERE id = ? AND user_id = ?', [$accountId, $uid]);
        if (!$a) throw new ApiException('Please choose one of your accounts.', 422, ['account_id' => 'Please choose one of your accounts.']);
        if ($mustBeActive && !$a['is_active']) throw new ApiException('That account is archived.', 422, ['account_id' => 'That account is archived.']);
        return $a;
    }

    public static function categoryOwned(int $uid, ?int $id, string $type): ?int
    {
        if (!$id) return null;
        $c = q_one('SELECT id FROM categories WHERE id = ? AND user_id = ? AND type = ? AND is_active = 1', [$id, $uid, $type]);
        if (!$c) throw new ApiException('Please choose a valid category.', 422, ['category_id' => 'Please choose a valid category.']);
        return (int)$c['id'];
    }

    /** Current balance of one account, locking the account row to serialise concurrent spends. */
    public static function lockedBalance(int $uid, int $accountId): string
    {
        q('SELECT id FROM financial_accounts WHERE id = ? AND user_id = ? FOR UPDATE', [$accountId, $uid]);
        $r = q_one('SELECT a.opening_balance + COALESCE(SUM(' . FinancialCalculationService::signedSql('t') . '),0) AS b FROM financial_accounts a
                    LEFT JOIN transactions t ON t.account_id = a.id AND t.status = \'posted\' WHERE a.id = ? GROUP BY a.id', [$accountId]);
        return (string)($r['b'] ?? '0.00');
    }

    /** Standard "not enough money" rejection that tells the user which account, how much it holds and how much is missing. */
    public static function insufficient(string $accountName, string $balance, string $needed, string $field = 'account_id'): ApiException
    {
        $bal = max(0, to_cents($balance));
        $msg = sprintf('Not enough money in %s. It has %s but %s is needed (short by %s).', $accountName, money_fmt(from_cents($bal)), money_fmt($needed), money_fmt(from_cents(to_cents($needed) - $bal)));
        return new ApiException($msg, 422, [$field => $msg], 'insufficient_funds');
    }

    public static function assertFunds(int $uid, int $accountId, string $needed, string $field = 'account_id'): void
    {
        $bal = self::lockedBalance($uid, $accountId);
        if (to_cents($bal) < to_cents($needed)) {
            $name = (string)q_val('SELECT name FROM financial_accounts WHERE id = ? AND user_id = ?', [$accountId, $uid]);
            throw self::insufficient($name, $bal, $needed, $field);
        }
    }

    public static function insert(array $d): int
    {
        $cols = ['user_id', 'account_id', 'type', 'amount', 'category_id', 'title', 'party', 'payment_method', 'txn_date', 'reference', 'description',
                 'client_uuid', 'transfer_group', 'debt_id', 'debt_payment_id', 'goal_id', 'recurring_id', 'occurrence_date'];
        $vals = []; foreach ($cols as $c) $vals[] = $d[$c] ?? null;
        q('INSERT INTO transactions (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', $vals);
        return (int)db()->lastInsertId();
    }

    private static function maxDate(): string { return (new DateTimeImmutable('today'))->modify('+1 day')->format('Y-m-d'); }

    /** Validate and create an income or expense. Idempotent when client_uuid is supplied. */
    public static function create(array $user, string $type, array $in): array
    {
        $uid = (int)$user['id'];
        $v = new V($in);
        $title = $v->str('title', 'Title', true, 150);
        $amount = $v->amount('amount', 'Amount');
        $catId = $v->id('category_id', 'Category');
        $accId = $v->id('account_id', 'Account');
        $date = $v->date('txn_date', 'Date');
        $party = $v->str('party', $type === 'income' ? 'Income source' : 'Merchant or recipient', false, 120);
        $method = $v->str('payment_method', 'Payment method', false, 40);
        $ref = $v->str('reference', 'Reference number', false, 80);
        $desc = $v->str('description', 'Description', false, 2000);
        $uuid = $v->str('client_uuid', 'Transaction id', false, 36);
        // Optional: when the chosen account is short, the user may cover only the missing part by borrowing it (recorded as a debt).
        $borrowParty = $type === 'expense' ? $v->str('borrow_party', 'Lender', false, 120) : null;
        $borrow = null;
        if ($borrowParty !== null) {
            $ir = null;
            if ($v->has('borrow_interest_rate')) {
                $x = str_replace(',', '.', (string)$v->raw('borrow_interest_rate'));
                if (!is_numeric($x) || $x < 0 || $x > 1000) $v->fail('borrow_interest_rate', 'Interest rate must be between 0 and 1000.'); else $ir = number_format((float)$x, 2, '.', '');
            }
            $borrow = ['party' => $borrowParty, 'phone' => $v->phone('borrow_phone', 'Phone number', false), 'due' => $v->date('borrow_due_date', 'Due date', false),
                       'notes' => $v->str('borrow_notes', 'Notes', false, 2000), 'rate' => $ir];
            if ($date && $borrow['due'] && $borrow['due'] < $date) $v->fail('borrow_due_date', 'Due date cannot be before the debt date.');
        }
        if ($uuid !== null && !valid_uuid($uuid)) $v->fail('client_uuid', 'Invalid transaction id.');
        if ($date && $date > self::maxDate()) $v->fail('txn_date', 'Date cannot be in the future.');
        $v->done();

        if ($uuid) {
            $dup = q_one('SELECT * FROM transactions WHERE user_id = ? AND client_uuid = ?', [$uid, $uuid]);
            if ($dup) return ['id' => (int)$dup['id'], 'duplicate' => true];
        }
        $acc = self::accountOwned($uid, $accId);
        self::categoryOwned($uid, $catId, $type);

        $id = (int)in_tx(function () use ($uid, $type, $title, $amount, $catId, $accId, $date, $party, $method, $ref, $desc, $uuid, $acc, $borrow) {
            if ($type === 'expense') {
                // An expense can only be paid with money the account really holds.
                $bal = self::lockedBalance($uid, $accId);
                if (to_cents($bal) < to_cents($amount)) {
                    if ($borrow === null) throw self::insufficient($acc['name'], $bal, $amount);
                    // Borrow exactly the missing part; it is recorded as a debt (I owe), not as income.
                    $short = from_cents(to_cents($amount) - max(0, to_cents($bal)));
                    q('INSERT INTO debts (user_id, direction, party_name, phone, description, principal, interest_rate, start_date, due_date, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        [$uid, 'owed_by_me', $borrow['party'], $borrow['phone'], 'Borrowed to pay: ' . $title, $short, $borrow['rate'], $date, $borrow['due'], $borrow['notes']]);
                    $debtId = (int)db()->lastInsertId();
                    self::insert(['user_id' => $uid, 'account_id' => $accId, 'type' => 'debt_borrowed', 'amount' => $short, 'title' => 'Loan received from ' . $borrow['party'],
                        'party' => $borrow['party'], 'txn_date' => $date, 'debt_id' => $debtId]);
                    audit($uid, 'debt_created', 'debt', $debtId);
                }
            }
            return self::insert(['user_id' => $uid, 'account_id' => $accId, 'type' => $type, 'amount' => $amount, 'category_id' => $catId, 'title' => $title,
                'party' => $party, 'payment_method' => $method, 'txn_date' => $date, 'reference' => $ref, 'description' => $desc, 'client_uuid' => $uuid]);
        });
        audit($uid, $type . '_created', 'transaction', $id);
        if ($type === 'expense') BudgetService::checkAlerts($uid);
        return ['id' => $id, 'duplicate' => false];
    }

    public static function update(array $user, int $id, string $type, array $in): void
    {
        $uid = (int)$user['id'];
        $row = owned('transactions', $id, $uid);
        if ($row['status'] !== 'posted') throw new ApiException('Reversed records cannot be edited.', 409);
        if ($row['type'] !== $type) throw new ApiException('This record is managed from another page.', 422);
        $v = new V($in);
        $title = $v->str('title', 'Title', true, 150);
        $amount = $v->amount('amount', 'Amount');
        $catId = $v->id('category_id', 'Category');
        $accId = $v->id('account_id', 'Account');
        $date = $v->date('txn_date', 'Date');
        $party = $v->str('party', 'Party', false, 120);
        $method = $v->str('payment_method', 'Payment method', false, 40);
        $ref = $v->str('reference', 'Reference number', false, 80);
        $desc = $v->str('description', 'Description', false, 2000);
        if ($date && $date > self::maxDate()) $v->fail('txn_date', 'Date cannot be in the future.');
        $v->done();
        $acc = self::accountOwned($uid, $accId, $accId !== (int)$row['account_id']);
        self::categoryOwned($uid, $catId, $type);
        if ($type === 'expense') {
            in_tx(function () use ($uid, $accId, $amount, $row, $acc) {
                // This expense already left its old account, so give that amount back before checking the new one.
                $bal = to_cents(self::lockedBalance($uid, $accId)) + ($accId === (int)$row['account_id'] ? to_cents($row['amount']) : 0);
                if ($bal < to_cents($amount)) throw self::insufficient($acc['name'], from_cents($bal), $amount);
            });
        }
        q('UPDATE transactions SET title=?, amount=?, category_id=?, account_id=?, txn_date=?, party=?, payment_method=?, reference=?, description=? WHERE id=? AND user_id=?',
            [$title, $amount, $catId, $accId, $date, $party, $method, $ref, $desc, $id, $uid]);
        audit($uid, $type . '_updated', 'transaction', $id);
        if ($type === 'expense') BudgetService::checkAlerts($uid);
    }

    /** "Delete" = reversal. The row is kept (status=reversed) so history is preserved but excluded from every total. */
    public static function reverse(array $user, int $id): void
    {
        $uid = (int)$user['id'];
        $row = owned('transactions', $id, $uid);
        if ($row['status'] === 'reversed') return;
        if (in_array($row['type'], ['debt_borrowed', 'debt_lent', 'debt_repaid', 'debt_collected'], true) || $row['debt_id'] || $row['debt_payment_id']) {
            throw new ApiException('Reverse this from the Debts page so the debt balance stays correct.', 422);
        }
        if ($row['goal_id']) throw new ApiException('Reverse this from the Savings page so the goal balance stays correct.', 422);
        in_tx(function () use ($row, $uid) {
            if ($row['transfer_group']) q("UPDATE transactions SET status='reversed', reversed_at=? WHERE user_id=? AND transfer_group=?", [now_utc(), $uid, $row['transfer_group']]);
            else q("UPDATE transactions SET status='reversed', reversed_at=? WHERE id=? AND user_id=?", [now_utc(), $row['id'], $uid]);
        });
        audit($uid, 'transaction_reversed', 'transaction', $id, 'success', ['type' => $row['type']]);
    }

    /** Filtered list with totals for the filtered result set. $forcedType restricts to income|expense. */
    public static function listing(int $uid, ?string $forcedType, array $q, bool $forExport = false): array
    {
        $where = ['t.user_id = ?']; $p = [$uid];
        $where[] = ($q['status'] ?? '') === 'reversed' ? "t.status = 'reversed'" : (($q['status'] ?? '') === 'all' ? '1=1' : "t.status = 'posted'");
        $type = $forcedType ?? ($q['type'] ?? '');
        $groups = ['transfer' => ['transfer_in', 'transfer_out'], 'debt' => ['debt_borrowed', 'debt_lent', 'debt_repaid', 'debt_collected'], 'savings' => ['savings_contribution', 'savings_withdrawal']];
        if ($type !== '') {
            $set = $groups[$type] ?? [$type];
            $where[] = 't.type IN (' . implode(',', array_fill(0, count($set), '?')) . ')'; array_push($p, ...$set);
        }
        if (!empty($q['from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $q['from'])) { $where[] = 't.txn_date >= ?'; $p[] = $q['from']; }
        if (!empty($q['to']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $q['to'])) { $where[] = 't.txn_date <= ?'; $p[] = $q['to']; }
        if (!empty($q['category_id'])) { $where[] = 't.category_id = ?'; $p[] = (int)$q['category_id']; }
        if (!empty($q['account_id'])) { $where[] = 't.account_id = ?'; $p[] = (int)$q['account_id']; }
        if (!empty($q['payment_method'])) { $where[] = 't.payment_method = ?'; $p[] = (string)$q['payment_method']; }
        if (isset($q['q']) && trim((string)$q['q']) !== '') {
            $s = trim((string)$q['q']);
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $s) . '%';
            $cond = '(t.title LIKE ? OR t.description LIKE ? OR t.reference LIKE ? OR t.party LIKE ? OR c.name LIKE ? OR a.name LIKE ?';
            array_push($p, $like, $like, $like, $like, $like, $like);
            if (is_numeric(str_replace(',', '', $s))) { $cond .= ' OR t.amount = ?'; $p[] = str_replace(',', '', $s); }
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) { $cond .= ' OR t.txn_date = ?'; $p[] = $s; }
            $where[] = $cond . ')';
        }
        $from = ' FROM transactions t LEFT JOIN categories c ON c.id = t.category_id JOIN financial_accounts a ON a.id = t.account_id WHERE ' . implode(' AND ', $where);
        $sorts = ['date' => 't.txn_date', 'amount' => 't.amount', 'title' => 't.title'];
        $sort = $sorts[$q['sort'] ?? 'date'] ?? 't.txn_date';
        $dir = strtolower((string)($q['dir'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';
        $order = " ORDER BY $sort $dir, t.id DESC";
        $sel = 'SELECT t.id, t.type, t.title, t.amount, t.txn_date, t.party, t.payment_method, t.reference, t.description, t.status, t.category_id, t.account_id, t.receipt_file IS NOT NULL AS has_receipt,
                       t.debt_id, t.goal_id, t.transfer_group, t.recurring_id, t.created_at, COALESCE(c.name, \'\') AS category_name, a.name AS account_name';
        $sum = q_one("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount END),0) AS income, COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0) AS expenses" . $from, $p);
        if ($forExport) return ['items' => q_all($sel . $from . $order . ' LIMIT 10000', $p), 'summary' => $sum];
        [$page, $per, $off] = paginate_params();
        $items = q_all($sel . $from . $order . " LIMIT $per OFFSET $off", $p);
        return ['items' => $items, 'summary' => $sum, 'page' => $page, 'per_page' => $per, 'pages' => (int)ceil($sum['total'] / $per)];
    }

    public static function csv(array $items): string
    {
        $h = fopen('php://temp', 'r+');
        fputcsv($h, ['Date', 'Type', 'Title', 'Category', 'Account', 'Amount', 'Payment method', 'Reference', 'Party', 'Status']);
        foreach ($items as $r) {
            $safe = fn($v) => ($v !== '' && $v !== null && strpbrk((string)$v[0], '=+-@') !== false) ? "'" . $v : $v;
            fputcsv($h, [$r['txn_date'], $r['type'], $safe($r['title']), $safe($r['category_name']), $safe($r['account_name']), $r['amount'], $safe($r['payment_method']), $safe($r['reference']), $safe($r['party']), $r['status']]);
        }
        rewind($h);
        return "\xEF\xBB\xBF" . stream_get_contents($h);
    }

    /** Shared REST handler for the income / expenses / transactions endpoints. */
    public static function handle(string $method, array $p, ?string $forcedType, string $feature): void
    {
        $user = require_feature($feature);
        $uid = (int)$user['id'];
        $a = $p[0] ?? null;

        if ($method === 'GET' && $a === 'export') {
            require_feature('export', $user);
            $r = self::listing($uid, $forcedType, $_GET, true);
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . ($forcedType ?? 'transactions') . '-' . today() . '.csv"');
            echo self::csv($r['items']); exit;
        }
        if ($method === 'GET' && $a === 'receipt' && isset($p[1])) {
            $row = owned('transactions', (int)$p[1], $uid);
            if (!$row['receipt_file']) throw new ApiException('No receipt attached.', 404);
            serve_private_file('receipts', $row['receipt_file']);
        }
        if ($method === 'GET' && $a === null) json_ok(self::listing($uid, $forcedType, $_GET));
        if ($method === 'GET' && ctype_digit((string)$a)) {
            $row = owned('transactions', (int)$a, $uid);
            $row['category_name'] = q_val('SELECT name FROM categories WHERE id = ?', [$row['category_id']]);
            $row['account_name'] = q_val('SELECT name FROM financial_accounts WHERE id = ?', [$row['account_id']]);
            unset($row['receipt_file']);
            json_ok($row);
        }
        if ($forcedType === null) {
            if ($method === 'DELETE' && ctype_digit((string)$a)) { self::reverse($user, (int)$a); json_ok(null, 'Transaction reversed.'); }
            return;
        }
        if ($method === 'POST' && $a === null) {
            $r = self::create($user, $forcedType, input());
            json_ok($r, $r['duplicate'] ? 'Already saved.' : ucfirst($forcedType) . ' saved.', $r['duplicate'] ? 200 : 201);
        }
        if ($method === 'POST' && ctype_digit((string)$a) && ($p[1] ?? '') === 'receipt') {
            $row = owned('transactions', (int)$a, $uid);
            if (empty($_FILES['receipt'])) throw new ApiException('Please choose a receipt file.', 422);
            $name = store_private_file($_FILES['receipt'], 'receipts');
            if ($row['receipt_file']) @unlink(STORAGE_PATH . '/receipts/' . basename($row['receipt_file']));
            q('UPDATE transactions SET receipt_file = ? WHERE id = ? AND user_id = ?', [$name, $row['id'], $uid]);
            json_ok(null, 'Receipt attached.');
        }
        if ($method === 'PUT' && ctype_digit((string)$a)) { self::update($user, (int)$a, $forcedType, input()); json_ok(null, 'Saved.'); }
        if ($method === 'DELETE' && ctype_digit((string)$a)) { self::reverse($user, (int)$a); json_ok(null, ucfirst($forcedType) . ' deleted.'); }
    }
}
