<?php
declare(strict_types=1);

class ApiException extends Exception
{
    public function __construct(string $message, public int $status = 400, public array $errors = [], public ?string $errorCode = null)
    {
        parent::__construct($message);
    }
}

function json_out(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}
function json_ok($data = null, string $message = 'OK', int $status = 200): never
{
    json_out(['success' => true, 'message' => $message, 'data' => $data], $status);
}
function json_fail(string $message, int $status = 400, array $errors = [], ?string $code = null): never
{
    json_out(['success' => false, 'message' => $message, 'errors' => (object)$errors, 'code' => $code], $status);
}

/** Request body (JSON or form-encoded) merged with query for GET. */
function input(): array
{
    static $in = null;
    if ($in !== null) return $in;
    $in = [];
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $j = $raw === '' ? [] : json_decode($raw, true);
        if (!is_array($j)) throw new ApiException('Invalid request body.', 400);
        $in = $j;
    } else {
        $in = $_POST;
    }
    return $in;
}

function http_method(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }

function log_error(Throwable $e): void
{
    error_log(sprintf('[%s] %s in %s:%d', date('c'), $e->getMessage(), $e->getFile(), $e->getLine()));
}

function paginate_params(int $defaultPer = 20): array
{
    $page = max(1, (int)($_GET['page'] ?? 1));
    $per = min(100, max(1, (int)($_GET['per_page'] ?? $defaultPer)));
    return [$page, $per, ($page - 1) * $per];
}
