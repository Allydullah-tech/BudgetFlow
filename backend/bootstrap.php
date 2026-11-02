<?php
declare(strict_types=1);

require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/validation.php';
require_once __DIR__ . '/helpers/security.php';
require_once __DIR__ . '/middleware/authentication.php';
require_once __DIR__ . '/middleware/authorization.php';
require_once __DIR__ . '/middleware/csrf.php';
require_once __DIR__ . '/middleware/subscription.php';
foreach (['NotificationService', 'SubscriptionService', 'BudgetService', 'FinancialCalculationService', 'AuthenticationService',
          'PaymentService', 'ReportingService', 'PdfReportService', 'TransactionService'] as $svc) {
    require_once __DIR__ . '/services/' . $svc . '.php';
}
