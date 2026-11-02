-- Expense Tracker backup 2026-10-20T07:46:03+00:00
SET NAMES utf8mb4; SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `account_verification_tokens`;
CREATE TABLE `account_verification_tokens` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_avt_hash` (`token_hash`),
  KEY `fk_avt_user` (`user_id`),
  CONSTRAINT `fk_avt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(160) NOT NULL,
  `body` text NOT NULL,
  `audience` enum('all','trial','active','expired','selected') NOT NULL DEFAULT 'all',
  `target_user_ids` text DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_by` int(10) unsigned NOT NULL,
  `published_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ann_pub` (`published_at`,`scheduled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `actor_id` int(10) unsigned DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `entity` varchar(40) DEFAULT NULL,
  `entity_id` varchar(40) DEFAULT NULL,
  `result` enum('success','failure') NOT NULL DEFAULT 'success',
  `ip` varchar(45) DEFAULT NULL,
  `meta` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor` (`actor_id`,`created_at`),
  KEY `idx_audit_action` (`action`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `audit_logs` VALUES ('1','1','installed','system',NULL,'success','::1',NULL,'2026-10-20 07:41:48'),
('2','1','login','user','1','success','::1',NULL,'2026-10-20 07:45:13');

DROP TABLE IF EXISTS `budgets`;
CREATE TABLE `budgets` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `period` enum('weekly','monthly','custom') NOT NULL DEFAULT 'monthly',
  `category_id` int(10) unsigned DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `alert_thresholds` varchar(40) NOT NULL DEFAULT '50,75,90,100',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_bud_user` (`user_id`,`is_active`),
  KEY `fk_bud_cat` (`category_id`),
  CONSTRAINT `fk_bud_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bud_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_bud_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` enum('income','expense') NOT NULL,
  `name` varchar(80) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cat` (`user_id`,`type`,`name`),
  CONSTRAINT `fk_cat_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `categories` VALUES ('1','1','income','Salary','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('2','1','income','Business income','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('3','1','income','Freelance income','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('4','1','income','Investments','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('5','1','income','Gifts received','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('6','1','income','Rental income','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('7','1','income','Interest','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('8','1','income','Other income','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('9','1','expense','Food','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('10','1','expense','Transport','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('11','1','expense','Rent','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('12','1','expense','Electricity','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('13','1','expense','Water','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('14','1','expense','Internet','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('15','1','expense','Healthcare','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('16','1','expense','Education','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('17','1','expense','Shopping','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('18','1','expense','Entertainment','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('19','1','expense','Fuel','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('20','1','expense','Business expenses','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('21','1','expense','Family expenses','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('22','1','expense','Debt interest','1','2026-10-20 07:41:48','2026-10-20 07:41:48'),
('23','1','expense','Other expenses','1','2026-10-20 07:41:48','2026-10-20 07:41:48');

DROP TABLE IF EXISTS `debt_payments`;
CREATE TABLE `debt_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `debt_id` int(10) unsigned NOT NULL,
  `account_id` int(10) unsigned NOT NULL,
  `principal_amount` decimal(15,2) NOT NULL,
  `interest_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `pay_date` date NOT NULL,
  `method` varchar(40) DEFAULT NULL,
  `reference` varchar(80) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `status` enum('posted','reversed') NOT NULL DEFAULT 'posted',
  `client_uuid` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dp_uuid` (`user_id`,`client_uuid`),
  KEY `idx_dp_debt` (`debt_id`,`status`),
  KEY `fk_dp_acc` (`account_id`),
  CONSTRAINT `fk_dp_acc` FOREIGN KEY (`account_id`) REFERENCES `financial_accounts` (`id`),
  CONSTRAINT `fk_dp_debt` FOREIGN KEY (`debt_id`) REFERENCES `debts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_dp_amount` CHECK (`principal_amount` > 0 and `interest_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `debts`;
CREATE TABLE `debts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `direction` enum('owed_by_me','owed_to_me') NOT NULL,
  `party_name` varchar(120) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `principal` decimal(15,2) NOT NULL,
  `interest_rate` decimal(6,2) DEFAULT NULL,
  `start_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_debt_user` (`user_id`,`direction`),
  KEY `idx_debt_due` (`user_id`,`due_date`),
  CONSTRAINT `fk_debt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_debt_amount` CHECK (`principal` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `financial_accounts`;
CREATE TABLE `financial_accounts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(80) NOT NULL,
  `type` enum('cash','bank','mobile_money','savings','other') NOT NULL DEFAULT 'cash',
  `currency` char(3) NOT NULL DEFAULT 'TZS',
  `opening_balance` decimal(15,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc` (`user_id`,`name`),
  CONSTRAINT `fk_acc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `financial_accounts` VALUES ('1','1','Cash in Hand','cash','TZS','0.00','1','2026-10-20 07:41:48','2026-10-20 07:41:48');

DROP TABLE IF EXISTS `login_attempts`;
CREATE TABLE `login_attempts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(190) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_la_email` (`email`,`created_at`),
  KEY `idx_la_ip` (`ip`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` varchar(40) NOT NULL,
  `title` varchar(160) NOT NULL,
  `body` text DEFAULT NULL,
  `link` varchar(160) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `dismissed_at` datetime DEFAULT NULL,
  `dedupe_key` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notif_dedupe` (`user_id`,`dedupe_key`),
  KEY `idx_notif_user` (`user_id`,`is_read`,`created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prt_hash` (`token_hash`),
  KEY `fk_prt_user` (`user_id`),
  CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `payment_methods`;
CREATE TABLE `payment_methods` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `kind` enum('mobile_money','bank','other') NOT NULL DEFAULT 'mobile_money',
  `provider` varchar(80) DEFAULT NULL,
  `recipient_name` varchar(120) DEFAULT NULL,
  `account_number` varchar(60) NOT NULL,
  `instructions` text DEFAULT NULL,
  `qr_file` varchar(120) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `recurring_transactions`;
CREATE TABLE `recurring_transactions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` enum('income','expense') NOT NULL,
  `title` varchar(120) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `category_id` int(10) unsigned DEFAULT NULL,
  `account_id` int(10) unsigned NOT NULL,
  `frequency` enum('daily','weekly','monthly','yearly','custom') NOT NULL,
  `interval_days` smallint(5) unsigned DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `next_due` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rec_due` (`user_id`,`is_active`,`next_due`),
  KEY `fk_rec_cat` (`category_id`),
  KEY `fk_rec_acc` (`account_id`),
  CONSTRAINT `fk_rec_acc` FOREIGN KEY (`account_id`) REFERENCES `financial_accounts` (`id`),
  CONSTRAINT `fk_rec_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rec_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_rec_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `savings_goals`;
CREATE TABLE `savings_goals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `target_amount` decimal(15,2) NOT NULL,
  `target_date` date DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `milestone_notified` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sg_user` (`user_id`),
  CONSTRAINT `fk_sg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_sg_target` CHECK (`target_amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `scheduled_jobs`;
CREATE TABLE `scheduled_jobs` (
  `name` varchar(60) NOT NULL,
  `last_run_at` datetime DEFAULT NULL,
  `last_status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `subscription_payments`;
CREATE TABLE `subscription_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `plan_id` int(10) unsigned NOT NULL,
  `method_id` int(10) unsigned NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `reference` varchar(80) NOT NULL,
  `pay_date` date NOT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `receipt_file` varchar(120) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reject_reason` varchar(255) DEFAULT NULL,
  `reviewed_by` int(10) unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `subscription_id` int(10) unsigned DEFAULT NULL,
  `approved_ref_key` varchar(160) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sp_approved_ref` (`approved_ref_key`),
  KEY `idx_sp_status` (`status`,`created_at`),
  KEY `idx_sp_user` (`user_id`,`created_at`),
  KEY `fk_sp_plan` (`plan_id`),
  KEY `fk_sp_method` (`method_id`),
  CONSTRAINT `fk_sp_method` FOREIGN KEY (`method_id`) REFERENCES `payment_methods` (`id`),
  CONSTRAINT `fk_sp_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`),
  CONSTRAINT `fk_sp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_sp_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `subscription_plans`;
CREATE TABLE `subscription_plans` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `period_months` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_plan_price` CHECK (`price` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `subscription_plans` VALUES ('1','Monthly','5000.00','1','1','1','2026-10-20 07:41:47','2026-10-20 07:41:47');

DROP TABLE IF EXISTS `subscriptions`;
CREATE TABLE `subscriptions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `plan_id` int(10) unsigned DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `source` enum('payment','complimentary','extension') NOT NULL DEFAULT 'payment',
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sub_user` (`user_id`,`ends_at`),
  KEY `fk_sub_plan` (`plan_id`),
  CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `skey` varchar(80) NOT NULL,
  `svalue` text DEFAULT NULL,
  `updated_by` int(10) unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`skey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `system_settings` VALUES ('app_name','Expense Tracker',NULL,'2026-10-20 07:41:47'),
('app_timezone','Africa/Dar_es_Salaam',NULL,'2026-10-20 07:41:47'),
('backup_retention_days','14',NULL,'2026-10-20 07:41:47'),
('billing_rule','calendar_month',NULL,'2026-10-20 07:41:47'),
('brand_gold','#c9a227',NULL,'2026-10-20 07:41:47'),
('brand_primary','#0f4d36',NULL,'2026-10-20 07:41:47'),
('date_format','d M Y',NULL,'2026-10-20 07:41:47'),
('default_currency','TZS',NULL,'2026-10-20 07:41:47'),
('expired_allowed_features','[\"expenses\",\"accounts\",\"categories\",\"dashboard_basic\",\"notifications\",\"subscription\",\"support\",\"profile\",\"settings\"]',NULL,'2026-10-20 07:41:47'),
('help_text','',NULL,'2026-10-20 07:41:47'),
('landing_announcement','',NULL,'2026-10-20 07:41:47'),
('lockout_minutes','15',NULL,'2026-10-20 07:41:47'),
('maintenance_mode','0',NULL,'2026-10-20 07:41:47'),
('max_login_attempts','5',NULL,'2026-10-20 07:41:47'),
('msg_approved','Your payment was approved. Your subscription is active until {date}.',NULL,'2026-10-20 07:41:47'),
('msg_expired','Your subscription has expired. You can continue recording expenses, but some features are temporarily restricted. Renew your subscription to restore full access.',NULL,'2026-10-20 07:41:47'),
('msg_rejected','Your payment could not be approved. {reason}',NULL,'2026-10-20 07:41:47'),
('msg_trial','Welcome to Expense Tracker! Your {days}-day free trial is now active. Enjoy full access to all features.',NULL,'2026-10-20 07:41:47'),
('msg_welcome','Welcome to Expense Tracker! Your account is ready.',NULL,'2026-10-20 07:41:47'),
('registration_open','1',NULL,'2026-10-20 07:41:47'),
('reminder_days','7,3,1',NULL,'2026-10-20 07:41:47'),
('require_email_verification','0',NULL,'2026-10-20 07:41:47'),
('session_timeout_minutes','120',NULL,'2026-10-20 07:41:47'),
('support_email','',NULL,'2026-10-20 07:41:47'),
('support_hours','',NULL,'2026-10-20 07:41:47'),
('support_phone','',NULL,'2026-10-20 07:41:47'),
('support_whatsapp','',NULL,'2026-10-20 07:41:47'),
('trial_days','30',NULL,'2026-10-20 07:41:47'),
('welcome_popup_message','Welcome to Expense Tracker',NULL,'2026-10-20 07:41:47');

DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `account_id` int(10) unsigned NOT NULL,
  `type` enum('income','expense','transfer_in','transfer_out','debt_borrowed','debt_lent','debt_repaid','debt_collected','savings_contribution','savings_withdrawal') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `category_id` int(10) unsigned DEFAULT NULL,
  `title` varchar(150) NOT NULL,
  `party` varchar(120) DEFAULT NULL,
  `payment_method` varchar(40) DEFAULT NULL,
  `txn_date` date NOT NULL,
  `reference` varchar(80) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `receipt_file` varchar(120) DEFAULT NULL,
  `status` enum('posted','reversed') NOT NULL DEFAULT 'posted',
  `client_uuid` char(36) DEFAULT NULL,
  `transfer_group` char(36) DEFAULT NULL,
  `debt_id` int(10) unsigned DEFAULT NULL,
  `debt_payment_id` int(10) unsigned DEFAULT NULL,
  `goal_id` int(10) unsigned DEFAULT NULL,
  `recurring_id` int(10) unsigned DEFAULT NULL,
  `occurrence_date` date DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_txn_uuid` (`user_id`,`client_uuid`),
  UNIQUE KEY `uq_txn_recurring` (`recurring_id`,`occurrence_date`),
  KEY `idx_txn_user_date` (`user_id`,`status`,`txn_date`),
  KEY `idx_txn_type` (`user_id`,`type`,`txn_date`),
  KEY `idx_txn_account` (`account_id`,`status`),
  KEY `idx_txn_cat` (`user_id`,`category_id`),
  KEY `idx_txn_goal` (`goal_id`),
  KEY `idx_txn_debt` (`debt_id`),
  KEY `fk_txn_cat` (`category_id`),
  CONSTRAINT `fk_txn_acc` FOREIGN KEY (`account_id`) REFERENCES `financial_accounts` (`id`),
  CONSTRAINT `fk_txn_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_txn_goal` FOREIGN KEY (`goal_id`) REFERENCES `savings_goals` (`id`),
  CONSTRAINT `fk_txn_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_txn_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


DROP TABLE IF EXISTS `user_settings`;
CREATE TABLE `user_settings` (
  `user_id` int(10) unsigned NOT NULL,
  `timezone` varchar(64) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  `date_format` varchar(20) NOT NULL DEFAULT 'd M Y',
  `theme` enum('light','dark','system') NOT NULL DEFAULT 'system',
  `notify_budget` tinyint(1) NOT NULL DEFAULT 1,
  `notify_debt` tinyint(1) NOT NULL DEFAULT 1,
  `notify_recurring` tinyint(1) NOT NULL DEFAULT 1,
  `notify_savings` tinyint(1) NOT NULL DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_us_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `user_settings` VALUES ('1','Africa/Dar_es_Salaam','d M Y','light','1','1','1','1','2026-10-20 07:45:35');

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','user') NOT NULL DEFAULT 'user',
  `status` enum('active','suspended','pending_verification') NOT NULL DEFAULT 'active',
  `email_verified_at` datetime DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `trial_started_at` datetime DEFAULT NULL,
  `trial_ends_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `users` VALUES ('1','ALLY ABDALLAH','mabumbatech@gmail.com',NULL,'$2y$10$dE1oc3uaA4XRfxlfW1VnleC7wxHueua/Y0rhlazvRjCFxHfMSEBOW','super_admin','active','2026-10-20 07:41:48',NULL,NULL,NULL,'2026-10-20 07:45:13',NULL,'2026-10-20 07:41:48','2026-10-20 07:45:13');

SET FOREIGN_KEY_CHECKS=1;
