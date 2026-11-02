-- Expense Tracker - MySQL 8.0+ / MariaDB 10.4+ schema (utf8mb4, InnoDB)
-- Rules: money = DECIMAL(15,2); timestamps stored in UTC; txn_date/pay_date are local calendar DATEs.
-- Statements are separated by ";" at end of line so backend/install.php can run them one by one.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','user') NOT NULL DEFAULT 'user',
  status ENUM('active','suspended','pending_verification') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  profile_image VARCHAR(255) NULL,
  trial_started_at DATETIME NULL,
  trial_ends_at DATETIME NULL,
  last_login_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT UNSIGNED PRIMARY KEY,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  date_format VARCHAR(20) NOT NULL DEFAULT 'd M Y',
  theme ENUM('light','dark','system') NOT NULL DEFAULT 'system',
  notify_budget TINYINT(1) NOT NULL DEFAULT 1,
  notify_debt TINYINT(1) NOT NULL DEFAULT 1,
  notify_recurring TINYINT(1) NOT NULL DEFAULT 1,
  notify_savings TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_la_email (email, created_at),
  KEY idx_la_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prt_hash (token_hash),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_verification_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_avt_hash (token_hash),
  CONSTRAINT fk_avt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Income and expense categories share one table (type column).
CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('income','expense') NOT NULL,
  name VARCHAR(80) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cat (user_id, type, name),
  CONSTRAINT fk_cat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS financial_accounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  type ENUM('cash','bank','mobile_money','savings','other') NOT NULL DEFAULT 'cash',
  currency CHAR(3) NOT NULL DEFAULT 'TZS',
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_acc (user_id, name),
  CONSTRAINT fk_acc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS debts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  direction ENUM('owed_by_me','owed_to_me') NOT NULL,
  party_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  description VARCHAR(255) NULL,
  principal DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(6,2) NULL,
  start_date DATE NOT NULL,
  due_date DATE NULL,
  notes TEXT NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_debt_user (user_id, direction),
  KEY idx_debt_due (user_id, due_date),
  CONSTRAINT chk_debt_amount CHECK (principal > 0),
  CONSTRAINT fk_debt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS debt_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  debt_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  interest_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  pay_date DATE NOT NULL,
  method VARCHAR(40) NULL,
  reference VARCHAR(80) NULL,
  notes VARCHAR(255) NULL,
  status ENUM('posted','reversed') NOT NULL DEFAULT 'posted',
  client_uuid CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dp_uuid (user_id, client_uuid),
  KEY idx_dp_debt (debt_id, status),
  CONSTRAINT chk_dp_amount CHECK (principal_amount > 0 AND interest_amount >= 0),
  CONSTRAINT fk_dp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_debt FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
  CONSTRAINT fk_dp_acc FOREIGN KEY (account_id) REFERENCES financial_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS savings_goals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_amount DECIMAL(15,2) NOT NULL,
  target_date DATE NULL,
  notes VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  milestone_notified TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sg_user (user_id),
  CONSTRAINT chk_sg_target CHECK (target_amount > 0),
  CONSTRAINT fk_sg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recurring_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('income','expense') NOT NULL,
  title VARCHAR(120) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id INT UNSIGNED NULL,
  account_id INT UNSIGNED NOT NULL,
  frequency ENUM('daily','weekly','monthly','yearly','custom') NOT NULL,
  interval_days SMALLINT UNSIGNED NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  next_due DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_rec_due (user_id, is_active, next_due),
  CONSTRAINT chk_rec_amount CHECK (amount > 0),
  CONSTRAINT fk_rec_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_rec_acc FOREIGN KEY (account_id) REFERENCES financial_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Central ledger. Every money movement is exactly one row (or two for a transfer).
-- Account balance = opening_balance + SUM(inflow types) - SUM(outflow types) over status='posted'.
--   inflow : income, transfer_in, debt_borrowed, debt_collected, savings_withdrawal
--   outflow: expense, transfer_out, debt_lent, debt_repaid, savings_contribution
-- Only 'income' and 'expense' count as income/expenses in reports.
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  type ENUM('income','expense','transfer_in','transfer_out','debt_borrowed','debt_lent','debt_repaid','debt_collected','savings_contribution','savings_withdrawal') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category_id INT UNSIGNED NULL,
  title VARCHAR(150) NOT NULL,
  party VARCHAR(120) NULL,
  payment_method VARCHAR(40) NULL,
  txn_date DATE NOT NULL,
  reference VARCHAR(80) NULL,
  description TEXT NULL,
  receipt_file VARCHAR(120) NULL,
  status ENUM('posted','reversed') NOT NULL DEFAULT 'posted',
  client_uuid CHAR(36) NULL,
  transfer_group CHAR(36) NULL,
  debt_id INT UNSIGNED NULL,
  debt_payment_id INT UNSIGNED NULL,
  goal_id INT UNSIGNED NULL,
  recurring_id INT UNSIGNED NULL,
  occurrence_date DATE NULL,
  reversed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_txn_uuid (user_id, client_uuid),
  UNIQUE KEY uq_txn_recurring (recurring_id, occurrence_date),
  KEY idx_txn_user_date (user_id, status, txn_date),
  KEY idx_txn_type (user_id, type, txn_date),
  KEY idx_txn_account (account_id, status),
  KEY idx_txn_cat (user_id, category_id),
  KEY idx_txn_goal (goal_id),
  KEY idx_txn_debt (debt_id),
  CONSTRAINT chk_txn_amount CHECK (amount > 0),
  CONSTRAINT fk_txn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_txn_acc FOREIGN KEY (account_id) REFERENCES financial_accounts(id),
  CONSTRAINT fk_txn_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_txn_goal FOREIGN KEY (goal_id) REFERENCES savings_goals(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  period ENUM('weekly','monthly','custom') NOT NULL DEFAULT 'monthly',
  category_id INT UNSIGNED NULL,
  amount DECIMAL(15,2) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  alert_thresholds VARCHAR(40) NOT NULL DEFAULT '50,75,90,100',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bud_user (user_id, is_active),
  CONSTRAINT chk_bud_amount CHECK (amount > 0),
  CONSTRAINT fk_bud_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bud_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NULL,
  link VARCHAR(160) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  dismissed_at DATETIME NULL,
  dedupe_key VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notif_dedupe (user_id, dedupe_key),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  period_months TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_plan_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_methods (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  kind ENUM('mobile_money','bank','other') NOT NULL DEFAULT 'mobile_money',
  provider VARCHAR(80) NULL,
  recipient_name VARCHAR(120) NULL,
  account_number VARCHAR(60) NOT NULL,
  instructions TEXT NULL,
  qr_file VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  source ENUM('payment','complimentary','extension') NOT NULL DEFAULT 'payment',
  note VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sub_user (user_id, ends_at),
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscription_payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  plan_id INT UNSIGNED NOT NULL,
  method_id INT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(80) NOT NULL,
  pay_date DATE NOT NULL,
  notes VARCHAR(500) NULL,
  receipt_file VARCHAR(120) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reject_reason VARCHAR(255) NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  subscription_id INT UNSIGNED NULL,
  approved_ref_key VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sp_approved_ref (approved_ref_key),
  KEY idx_sp_status (status, created_at),
  KEY idx_sp_user (user_id, created_at),
  CONSTRAINT chk_sp_amount CHECK (amount > 0),
  CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  CONSTRAINT fk_sp_method FOREIGN KEY (method_id) REFERENCES payment_methods(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
  skey VARCHAR(80) PRIMARY KEY,
  svalue TEXT NULL,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  audience ENUM('all','trial','active','expired','selected') NOT NULL DEFAULT 'all',
  target_user_ids TEXT NULL,
  scheduled_at DATETIME NULL,
  published_at DATETIME NULL,
  created_by INT UNSIGNED NOT NULL,
  published_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ann_pub (published_at, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(40) NULL,
  entity_id VARCHAR(40) NULL,
  result ENUM('success','failure') NOT NULL DEFAULT 'success',
  ip VARCHAR(45) NULL,
  meta TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_actor (actor_id, created_at),
  KEY idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  name VARCHAR(60) PRIMARY KEY,
  last_run_at DATETIME NULL,
  last_status VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
