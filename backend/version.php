<?php
declare(strict_types=1);
/** Served as /version.json. The app checks this to know when a new version has been uploaded. */
require_once __DIR__ . '/build.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
echo json_encode(['version' => et_build_id()]);
