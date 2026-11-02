<?php
declare(strict_types=1);

/**
 * Automatic build id. A short hash of every front-end file's name, size and modified time.
 * Upload a changed file and the id changes by itself: no version number to edit by hand.
 * The result is kept for a few seconds so busy sites do not re-scan the folder on every request.
 */
function et_build_id(): string
{
    $front = realpath(__DIR__ . '/../frontend');
    if ($front === false) return 'et-none';
    $cacheFile = (is_dir(__DIR__ . '/storage') ? __DIR__ . '/storage' : sys_get_temp_dir()) . '/build-id.cache';
    $c = @file_get_contents($cacheFile);
    if ($c !== false && ($p = explode('|', $c, 2)) && count($p) === 2 && time() - (int)$p[0] < 15) return $p[1];

    $parts = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($front, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if (!$f->isFile()) continue;
        $name = str_replace('\\', '/', substr($f->getPathname(), strlen($front) + 1));
        if (strpos($name, 'assets/images/brand/') === 0) continue; // logos uploaded from the admin screen
        $parts[] = $name . ':' . $f->getSize() . ':' . $f->getMTime();
    }
    sort($parts);
    $id = 'et-' . substr(sha1(implode('|', $parts)), 0, 12);
    @file_put_contents($cacheFile, time() . '|' . $id, LOCK_EX);
    return $id;
}
