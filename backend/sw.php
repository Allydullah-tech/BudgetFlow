<?php
declare(strict_types=1);
/**
 * Served as /service-worker.js. Same file as frontend/service-worker.js, with the automatic build id inserted.
 * Because the text changes whenever any front-end file changes, browsers install the new worker by themselves.
 */
require_once __DIR__ . '/build.php';
$src = (string)@file_get_contents(__DIR__ . '/../frontend/service-worker.js');
$src = preg_replace("/var VERSION = '[^']*';/", "var VERSION = '" . et_build_id() . "';", $src, 1);
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Service-Worker-Allowed: /');
echo $src;
