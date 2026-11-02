<?php
declare(strict_types=1);

/** Minimal dependency-free PDF writer (A4, core Helvetica fonts, vector shapes). */
final class PdfWriter
{
    public const W = 595.28, H = 841.89;
    private array $pages = [];
    private int $cur = -1;
    private const WIDTHS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];

    public function addPage(): void { $this->pages[] = ''; $this->cur = count($this->pages) - 1; }
    public function pageCount(): int { return count($this->pages); }
    public function page(): int { return $this->cur; }
    public function goto(int $i): void { $this->cur = $i; }

    private static function enc(string $s): string
    {
        $c = @iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $s);
        $c = $c === false ? preg_replace('/[^\x20-\x7E]/', '?', $s) : $c;
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $c);
    }

    public function width(string $s, float $size, bool $bold = false): float
    {
        $w = 0;
        foreach (str_split(self::enc_plain($s)) as $ch) {
            $o = ord($ch);
            $w += ($o >= 32 && $o <= 126) ? self::WIDTHS[$o - 32] : 556;
        }
        return $w / 1000 * $size * ($bold ? 1.06 : 1);
    }
    private static function enc_plain(string $s): string { $c = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s); return $c === false ? $s : $c; }

    public function fit(string $s, float $maxW, float $size, bool $bold = false): string
    {
        if ($this->width($s, $size, $bold) <= $maxW) return $s;
        while ($s !== '' && $this->width($s . '...', $size, $bold) > $maxW) $s = mb_substr($s, 0, -1);
        return $s . '...';
    }

    private function col(array $c, bool $stroke = false): string
    {
        return sprintf('%.3f %.3f %.3f %s ', $c[0] / 255, $c[1] / 255, $c[2] / 255, $stroke ? 'RG' : 'rg');
    }

    /** y is measured from the top of the page. */
    public function text(float $x, float $y, string $s, float $size = 10, bool $bold = false, array $color = [30, 30, 30], string $align = 'L'): void
    {
        if ($align === 'R') $x -= $this->width($s, $size, $bold);
        elseif ($align === 'C') $x -= $this->width($s, $size, $bold) / 2;
        $this->pages[$this->cur] .= 'BT ' . $this->col($color) . sprintf('/F%d %.2f Tf %.2f %.2f Td (%s) Tj ET', $bold ? 2 : 1, $size, $x, self::H - $y, self::enc($s)) . "\n";
    }

    public function rect(float $x, float $y, float $w, float $h, array $fill): void
    {
        $this->pages[$this->cur] .= $this->col($fill) . sprintf('%.2f %.2f %.2f %.2f re f', $x, self::H - $y - $h, $w, $h) . "\n";
    }

    public function line(float $x1, float $y1, float $x2, float $y2, array $color = [200, 200, 200], float $w = 0.5): void
    {
        $this->pages[$this->cur] .= $this->col($color, true) . sprintf('%.2f w %.2f %.2f m %.2f %.2f l S', $w, $x1, self::H - $y1, $x2, self::H - $y2) . "\n";
    }

    public function circle(float $cx, float $cy, float $r, array $fill): void
    {
        $k = 0.5523 * $r; $y = self::H - $cy;
        $this->pages[$this->cur] .= $this->col($fill) . sprintf('%.2f %.2f m %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c %.2f %.2f %.2f %.2f %.2f %.2f c f',
            $cx + $r, $y, $cx + $r, $y + $k, $cx + $k, $y + $r, $cx, $y + $r, $cx - $k, $y + $r, $cx - $r, $y + $k, $cx - $r, $y,
            $cx - $r, $y - $k, $cx - $k, $y - $r, $cx, $y - $r, $cx + $k, $y - $r, $cx + $r, $y - $k, $cx + $r, $y) . "\n";
    }

    public function output(string $title = 'Report'): string
    {
        $objs = [];
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $kids = [];
        $n = count($this->pages);
        for ($i = 0; $i < $n; $i++) $kids[] = (5 + $i * 2) . ' 0 R';
        $objs[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . $n . ' >>';
        $objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        foreach ($this->pages as $i => $content) {
            $p = 5 + $i * 2;
            $objs[$p] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>', self::W, self::H, $p + 1);
            $objs[$p + 1] = '<< /Length ' . strlen($content) . " >>\nstream\n" . $content . "endstream";
        }
        $objs[5 + $n * 2] = '<< /Title (' . self::enc($title) . ') /Producer (BudgetFlow) >>';
        $out = "%PDF-1.4\n"; $offs = [];
        ksort($objs);
        foreach ($objs as $id => $body) { $offs[$id] = strlen($out); $out .= "$id 0 obj\n$body\nendobj\n"; }
        $xref = strlen($out); $max = max(array_keys($objs));
        $out .= "xref\n0 " . ($max + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $max; $i++) $out .= sprintf("%010d 00000 n \n", $offs[$i]);
        return $out . "trailer\n<< /Size " . ($max + 1) . " /Root 1 0 R /Info " . (5 + $n * 2) . " 0 R >>\nstartxref\n$xref\n%%EOF";
    }
}

final class PdfReportService
{
    private const GREEN = [16, 24, 40], GOLD = [61, 139, 255], INK = [16, 24, 40], MUTED = [102, 112, 133], LINE = [228, 228, 223], CREAM = [247, 247, 245];
    private const M = 40.0;

    private static function fmt(array $col, $v): string
    {
        if ($v === null || $v === '') return '-';
        return match ($col['kind'] ?? 'text') {
            'money' => number_format((float)$v, 2),
            'percent' => $v . '%',
            'number' => (string)$v,
            default => (string)$v,
        };
    }

    private static function value(array $s): string
    {
        return match ($s['kind']) { 'money' => money_fmt($s['value']), 'percent' => $s['value'] . '%', default => (string)$s['value'] };
    }

    public static function render(array $report, string $userName, string $appName = 'BudgetFlow'): string
    {
        $pdf = new PdfWriter();
        $pdf->addPage();
        $y = self::header($pdf, $report, $userName, $appName);
        $W = PdfWriter::W - 2 * self::M;

        // Summary grid (2 columns)
        $pdf->text(self::M, $y, 'Summary', 13, true, self::GREEN); $y += 8;
        $pdf->line(self::M, $y, self::M + 40, $y, self::GOLD, 1.5); $y += 14;
        $colW = $W / 2;
        foreach (array_chunk($report['summary'], 2) as $pair) {
            if ($y > PdfWriter::H - 90) { $pdf->addPage(); $y = 60; }
            foreach ($pair as $i => $s) {
                $x = self::M + $i * $colW;
                $pdf->rect($x, $y - 10, $colW - 8, 36, self::CREAM);
                $pdf->text($x + 8, $y + 2, $pdf->fit($s['label'], $colW - 24, 8), 8, false, self::MUTED);
                $pdf->text($x + 8, $y + 18, $pdf->fit(self::value($s), $colW - 24, 11, true), 11, true, self::INK);
            }
            $y += 42;
        }
        $y += 6;

        foreach ($report['charts'] as $ch) {
            if (!$ch['labels']) continue;
            $need = $ch['type'] === 'donut' ? 40 + min(10, count($ch['labels'])) * 16 : 190;
            if ($y + $need > PdfWriter::H - 60) { $pdf->addPage(); $y = 60; }
            $y = $ch['type'] === 'donut' ? self::hbars($pdf, $ch, $y) : self::vbars($pdf, $ch, $y);
        }

        foreach ($report['tables'] as $t) $y = self::table($pdf, $t, $y);

        $y += 10;
        foreach ($report['notes'] as $n) {
            foreach (self::wrap($pdf, $n, $W, 8) as $ln) {
                if ($y > PdfWriter::H - 60) { $pdf->addPage(); $y = 60; }
                $pdf->text(self::M, $y, $ln, 8, false, self::MUTED); $y += 11;
            }
        }

        // Footers with "Page X of Y"
        $total = $pdf->pageCount();
        for ($i = 0; $i < $total; $i++) {
            $pdf->goto($i);
            $pdf->line(self::M, PdfWriter::H - 40, PdfWriter::W - self::M, PdfWriter::H - 40, self::LINE);
            $pdf->text(self::M, PdfWriter::H - 26, "$appName - " . $report['title'], 8, false, self::MUTED);
            $pdf->text(PdfWriter::W - self::M, PdfWriter::H - 26, 'Page ' . ($i + 1) . ' of ' . $total, 8, false, self::MUTED, 'R');
        }
        return $pdf->output($report['title']);
    }

    private static function header(PdfWriter $pdf, array $r, string $user, string $app): float
    {
        $pdf->rect(0, 0, PdfWriter::W, 78, self::GREEN);
        $pdf->rect(0, 78, PdfWriter::W, 3, self::GOLD);
        // Simple vector emblem: gold coin on green wallet shape
        $pdf->circle(self::M + 16, 39, 17, self::GOLD);
        $pdf->circle(self::M + 16, 39, 12, self::GREEN);
        $pdf->text(self::M + 16, 44, 'T', 14, true, self::GOLD, 'C');
        $pdf->text(self::M + 44, 36, $app, 17, true, [255, 255, 255]);
        $pdf->text(self::M + 44, 52, 'Developed by MABUMBATECH', 8, false, [226, 210, 169]);
        $pdf->text(PdfWriter::W - self::M, 36, $r['title'], 13, true, [255, 255, 255], 'R');
        $pdf->text(PdfWriter::W - self::M, 52, $r['range']['from'] . ' to ' . $r['range']['to'], 9, false, [226, 210, 169], 'R');
        $y = 102.0;
        $pdf->text(self::M, $y, 'Prepared for: ' . $user, 9, true, self::INK);
        $pdf->text(PdfWriter::W - self::M, $y, 'Generated: ' . $r['generated_at'], 9, false, self::MUTED, 'R');
        $pdf->text(self::M, $y + 13, 'Period: ' . $r['range']['label'], 9, false, self::MUTED);
        return $y + 38;
    }

    private static function wrap(PdfWriter $pdf, string $s, float $w, float $size): array
    {
        $lines = []; $cur = '';
        foreach (explode(' ', $s) as $word) {
            $try = $cur === '' ? $word : "$cur $word";
            if ($pdf->width($try, $size) > $w && $cur !== '') { $lines[] = $cur; $cur = $word; } else $cur = $try;
        }
        if ($cur !== '') $lines[] = $cur;
        return $lines;
    }

    private static function hbars(PdfWriter $pdf, array $ch, float $y): float
    {
        $pdf->text(self::M, $y, $ch['title'], 11, true, self::GREEN); $y += 14;
        $vals = $ch['datasets'][0]['values']; $max = max(1, ...array_map('floatval', $vals ?: [1]));
        $total = array_sum($vals) ?: 1;
        foreach (array_slice($ch['labels'], 0, 10, true) as $i => $lab) {
            $pdf->text(self::M, $y + 9, $pdf->fit((string)$lab, 120, 8), 8, false, self::INK);
            $bw = 250 * ($vals[$i] / $max);
            $pdf->rect(self::M + 130, $y, max(1, $bw), 11, $i % 2 ? self::GOLD : self::GREEN);
            $pdf->text(self::M + 136 + $bw, $y + 9, number_format($vals[$i]) . ' (' . round($vals[$i] / $total * 100, 1) . '%)', 8, false, self::MUTED);
            $y += 16;
        }
        return $y + 14;
    }

    private static function vbars(PdfWriter $pdf, array $ch, float $y): float
    {
        $pdf->text(self::M, $y, $ch['title'], 11, true, self::GREEN);
        $x0 = self::M + 4; $top = $y + 28; $h = 110.0; $w = PdfWriter::W - 2 * self::M - 8;
        $labels = $ch['labels']; $n = count($labels);
        $step = $n > 24 ? (int)ceil($n / 24) : 1;
        $ds = $ch['datasets']; $max = 1.0;
        foreach ($ds as $d) foreach ($d['values'] as $v) $max = max($max, abs((float)$v));
        $lx = PdfWriter::W - self::M;
        foreach (array_reverse($ds, true) as $di => $d) { $pdf->text($lx, $y, $d['name'], 8, false, self::MUTED, 'R'); $lx -= $pdf->width($d['name'], 8) + 14; $pdf->rect($lx + 4, $y - 7, 8, 8, $di % 2 ? self::GOLD : self::GREEN); $lx -= 6; }
        $pdf->line($x0, $top + $h, $x0 + $w, $top + $h, self::LINE);
        $slot = $w / max(1, $n); $bw = max(1.5, min(18, $slot / (count($ds) + 0.6)));
        for ($i = 0; $i < $n; $i++) {
            foreach ($ds as $di => $d) {
                $v = max(0.0, (float)($d['values'][$i] ?? 0)); $bh = $h * $v / $max;
                if ($bh > 0) $pdf->rect($x0 + $i * $slot + $di * $bw + ($slot - $bw * count($ds)) / 2, $top + $h - $bh, $bw, $bh, $di % 2 ? self::GOLD : self::GREEN);
            }
            if ($i % $step === 0) $pdf->text($x0 + $i * $slot + $slot / 2, $top + $h + 11, $pdf->fit(substr((string)$labels[$i], -5), max(18, $slot * $step), 6.5), 6.5, false, self::MUTED, 'C');
        }
        $pdf->text($x0, $top - 4, 'Max ' . number_format($max), 7, false, self::MUTED);
        return $top + $h + 30;
    }

    private static function table(PdfWriter $pdf, array $t, float $y): float
    {
        $cols = $t['columns']; $n = count($cols);
        if (!$t['rows']) return $y;
        $W = PdfWriter::W - 2 * self::M;
        $weights = array_map(fn($c) => match ($c['kind']) { 'money' => 1.2, 'number', 'percent' => 0.8, default => ($c['key'] === 'title' || $c['key'] === 'party_name' || $c['key'] === 'name') ? 1.8 : 1.2 }, $cols);
        $sum = array_sum($weights); $widths = array_map(fn($w) => $W * $w / $sum, $weights);
        $head = function (float $y) use ($pdf, $t, $cols, $widths) {
            $pdf->text(self::M, $y, $t['title'], 11, true, self::GREEN); $y += 8;
            $pdf->rect(self::M, $y, PdfWriter::W - 2 * self::M, 18, self::GREEN);
            $x = self::M;
            foreach ($cols as $i => $c) {
                $right = in_array($c['kind'], ['money', 'number', 'percent'], true);
                $pdf->text($right ? $x + $widths[$i] - 4 : $x + 4, $y + 12, $pdf->fit($c['label'], $widths[$i] - 8, 8, true), 8, true, [255, 255, 255], $right ? 'R' : 'L');
                $x += $widths[$i];
            }
            return $y + 18;
        };
        if ($y > PdfWriter::H - 120) { $pdf->addPage(); $y = 60; }
        $y = $head($y + 4);
        foreach ($t['rows'] as $ri => $row) {
            if ($y > PdfWriter::H - 62) { $pdf->addPage(); $y = $head(60); }
            if ($ri % 2 === 0) $pdf->rect(self::M, $y, $W, 16, self::CREAM);
            $x = self::M;
            foreach ($cols as $i => $c) {
                $right = in_array($c['kind'], ['money', 'number', 'percent'], true);
                $txt = $pdf->fit(self::fmt($c, $row[$c['key']] ?? null), $widths[$i] - 8, 8);
                $pdf->text($right ? $x + $widths[$i] - 4 : $x + 4, $y + 11, $txt, 8, false, self::INK, $right ? 'R' : 'L');
                $x += $widths[$i];
            }
            $y += 16;
        }
        return $y + 18;
    }
}
