<?php
declare(strict_types=1);

/** Collects field errors and throws a single 422 ApiException from done(). */
final class V
{
    private array $errors = [];
    public function __construct(private array $in) {}

    public function raw(string $k) { return $this->in[$k] ?? null; }
    public function has(string $k): bool { return array_key_exists($k, $this->in) && $this->in[$k] !== '' && $this->in[$k] !== null; }
    public function fail(string $k, string $msg): void { $this->errors[$k] = $msg; }

    public function str(string $k, string $label, bool $required = true, int $max = 255, int $min = 0): ?string
    {
        $v = $this->in[$k] ?? null;
        $v = is_string($v) ? trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $v)) : (is_numeric($v) ? (string)$v : '');
        if ($v === '') {
            if ($required) $this->errors[$k] = "$label is required.";
            return null;
        }
        if (mb_strlen($v) > $max) { $this->errors[$k] = "$label must be at most $max characters."; return null; }
        if ($min && mb_strlen($v) < $min) { $this->errors[$k] = "$label must be at least $min characters."; return null; }
        return $v;
    }

    /** Positive money amount with at most 2 decimals; returns a "1234.50" string. */
    public function amount(string $k, string $label, bool $required = true, bool $allowZero = false): ?string
    {
        $v = $this->in[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required) $this->errors[$k] = "$label is required.";
            return null;
        }
        $s = str_replace([',', ' '], '', (string)$v);
        if (!preg_match('/^\d{1,12}(\.\d{1,2})?$/', $s)) { $this->errors[$k] = "$label must be a valid amount (numbers only, max 2 decimals)."; return null; }
        if (!$allowZero && (float)$s <= 0) { $this->errors[$k] = "$label must be greater than zero."; return null; }
        return number_format((float)$s, 2, '.', '');
    }

    public function date(string $k, string $label, bool $required = true): ?string
    {
        $v = $this->in[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required) $this->errors[$k] = "$label is required.";
            return null;
        }
        $d = DateTime::createFromFormat('Y-m-d', (string)$v);
        if (!$d || $d->format('Y-m-d') !== $v || $d->format('Y') < 2000 || $d->format('Y') > 2100) { $this->errors[$k] = "$label must be a valid date."; return null; }
        return $d->format('Y-m-d');
    }

    public function enum(string $k, string $label, array $options, bool $required = true, ?string $default = null): ?string
    {
        $v = $this->in[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required && $default === null) $this->errors[$k] = "$label is required.";
            return $default;
        }
        if (!in_array($v, $options, true)) { $this->errors[$k] = "$label is not valid."; return $default; }
        return $v;
    }

    public function id(string $k, string $label, bool $required = true): ?int
    {
        $v = $this->in[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required) $this->errors[$k] = "$label is required.";
            return null;
        }
        if (!ctype_digit((string)$v) || (int)$v < 1) { $this->errors[$k] = "$label is not valid."; return null; }
        return (int)$v;
    }

    public function email(string $k = 'email', string $label = 'Email address'): ?string
    {
        $v = strtolower((string)$this->str($k, $label, true, 190));
        if ($v !== '' && !filter_var($v, FILTER_VALIDATE_EMAIL)) { $this->errors[$k] = "$label is not valid."; return null; }
        return $v ?: null;
    }

    public function phone(string $k = 'phone', string $label = 'Phone number', bool $required = false): ?string
    {
        $v = $this->str($k, $label, $required, 30);
        if ($v !== null && !preg_match('/^\+?[0-9 ()\-]{7,20}$/', $v)) { $this->errors[$k] = "$label is not valid."; return null; }
        return $v;
    }

    public function bool(string $k): int
    {
        $v = $this->in[$k] ?? 0;
        return ($v === true || $v === 1 || $v === '1' || $v === 'true' || $v === 'on') ? 1 : 0;
    }

    public function done(): void
    {
        if ($this->errors) throw new ApiException('Please correct the highlighted fields.', 422, $this->errors);
    }
}

function valid_uuid(?string $u): bool
{
    return $u !== null && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $u) === 1;
}

function check_password_strength(string $pw): ?string
{
    if (strlen($pw) < 8) return 'Password must be at least 8 characters.';
    if (!preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) return 'Password must contain letters and numbers.';
    return null;
}

/** Inclusive date-range from query parameters (preset or custom). Returns [from, to, label]. */
function resolve_range(string $preset, ?string $from = null, ?string $to = null): array
{
    $t = new DateTimeImmutable('today');
    switch ($preset) {
        case 'today': return [$t->format('Y-m-d'), $t->format('Y-m-d'), 'Today'];
        case 'yesterday': $y = $t->modify('-1 day')->format('Y-m-d'); return [$y, $y, 'Yesterday'];
        case 'week': $s = $t->modify('monday this week'); return [$s->format('Y-m-d'), $s->modify('+6 days')->format('Y-m-d'), 'This week'];
        case 'last_week': $s = $t->modify('monday last week'); return [$s->format('Y-m-d'), $s->modify('+6 days')->format('Y-m-d'), 'Last week'];
        case 'last_month': $s = $t->modify('first day of last month'); return [$s->format('Y-m-d'), $s->modify('last day of this month')->format('Y-m-d'), 'Last month'];
        case 'year': return [$t->format('Y') . '-01-01', $t->format('Y') . '-12-31', 'This year'];
        case 'last_year': $y = (int)$t->format('Y') - 1; return ["$y-01-01", "$y-12-31", 'Last year'];
        case 'custom':
            $v = new V(['from' => $from, 'to' => $to]);
            $f = $v->date('from', 'Start date'); $e = $v->date('to', 'End date'); $v->done();
            if ($f > $e) throw new ApiException('Start date must not be after the end date.', 422, ['from' => 'Start date must not be after the end date.']);
            if ((new DateTime($f))->diff(new DateTime($e))->days > 1830) throw new ApiException('Date range is too long (max 5 years).', 422);
            return [$f, $e, 'Custom range'];
        case 'month': default:
            return [$t->format('Y-m-01'), $t->modify('last day of this month')->format('Y-m-d'), 'This month'];
    }
}
