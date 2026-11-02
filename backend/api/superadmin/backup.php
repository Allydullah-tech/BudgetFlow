<?php
declare(strict_types=1);

/** Database backups written to backend/storage/backups (outside the public web paths, protected by .htaccess). */
function make_backup(): string
{
    $pdo = db();
    $dir = STORAGE_PATH . '/backups';
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) throw new ApiException('The backup folder is not writable.', 500);
    $name = 'backup-' . date('Ymd-His') . '.sql';
    $fh = @fopen("$dir/$name", 'w');
    if (!$fh) throw new ApiException('Could not create the backup file. Check folder permissions.', 500);
    fwrite($fh, "-- BudgetFlow backup " . gmdate('c') . "\nSET NAMES utf8mb4; SET FOREIGN_KEY_CHECKS=0;\n\n");
    foreach ($pdo->query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')->fetchAll(PDO::FETCH_NUM) as [$t]) {
        $create = $pdo->query("SHOW CREATE TABLE `$t`")->fetch(PDO::FETCH_NUM)[1];
        fwrite($fh, "DROP TABLE IF EXISTS `$t`;\n$create;\n\n");
        $st = $pdo->query("SELECT * FROM `$t`", PDO::FETCH_ASSOC);
        $batch = [];
        foreach ($st as $row) {
            $batch[] = '(' . implode(',', array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote((string)$v), $row)) . ')';
            if (count($batch) >= 200) { fwrite($fh, "INSERT INTO `$t` VALUES " . implode(",\n", $batch) . ";\n"); $batch = []; }
        }
        if ($batch) fwrite($fh, "INSERT INTO `$t` VALUES " . implode(",\n", $batch) . ";\n");
        fwrite($fh, "\n");
    }
    fwrite($fh, "SET FOREIGN_KEY_CHECKS=1;\n");
    fclose($fh); @chmod("$dir/$name", 0640);
    // Retention
    $keep = max(1, (int)setting('backup_retention_days', 14)) * 86400;
    foreach (glob("$dir/backup-*.sql") ?: [] as $f) if (filemtime($f) < time() - $keep) @unlink($f);
    return $name;
}

return function (array $admin, string $method, array $p): void {
    $aid = (int)$admin['id'];
    if ($method === 'GET' && !isset($p[0])) {
        $files = [];
        foreach (glob(STORAGE_PATH . '/backups/backup-*.sql') ?: [] as $f) $files[] = ['name' => basename($f), 'size' => filesize($f), 'created' => gmdate('Y-m-d H:i:s', filemtime($f))];
        usort($files, fn($a, $b) => strcmp($b['created'], $a['created']));
        json_ok(['items' => $files]);
    }
    if ($method === 'POST' && !isset($p[0])) {
        try { $name = make_backup(); } catch (ApiException $e) { audit($aid, 'backup_created', 'backup', null, 'failure'); throw $e; }
        catch (Throwable $e) { log_error($e); audit($aid, 'backup_created', 'backup', null, 'failure'); throw new ApiException('The backup failed. Check the server error log or use mysqldump (see README).', 500); }
        audit($aid, 'backup_created', 'backup', $name);
        json_ok(['name' => $name], 'Backup created.', 201);
    }
    if ($method === 'GET' && isset($p[0])) {
        if (!preg_match('/^backup-\d{8}-\d{6}\.sql$/', $p[0]) || !is_file(STORAGE_PATH . '/backups/' . $p[0])) throw new ApiException('Backup not found.', 404);
        audit($aid, 'backup_downloaded', 'backup', $p[0]);
        header('Content-Type: application/sql'); header('Content-Disposition: attachment; filename="' . $p[0] . '"'); header('Content-Length: ' . filesize(STORAGE_PATH . '/backups/' . $p[0]));
        readfile(STORAGE_PATH . '/backups/' . $p[0]); exit;
    }
};
