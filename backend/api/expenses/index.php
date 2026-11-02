<?php
declare(strict_types=1);
return function (string $method, array $p): void { TransactionService::handle($method, $p, 'expense', 'expenses'); };
