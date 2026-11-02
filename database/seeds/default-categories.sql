-- REFERENCE ONLY. Default categories are created per user at registration by
-- backend/services/AuthenticationService.php (so each user can rename them freely).
-- Replace :uid with a user id to seed manually.
--
-- Income : Salary, Business income, Freelance income, Investments, Gifts received,
--          Rental income, Interest, Other income
-- Expense: Food, Transport, Rent, Electricity, Water, Internet, Healthcare, Education,
--          Shopping, Entertainment, Fuel, Business expenses, Family expenses,
--          Debt interest, Other expenses
--
-- Note: "Debt repayments" and "Savings contributions" are deliberately NOT expense categories.
-- Repaying debt principal and saving money are recorded through the Debts and Savings modules,
-- which keeps them out of "Total Expenses" and prevents double counting.
INSERT IGNORE INTO categories (user_id, type, name) VALUES
(:uid,'income','Salary'),(:uid,'income','Business income'),(:uid,'income','Freelance income'),
(:uid,'income','Investments'),(:uid,'income','Gifts received'),(:uid,'income','Rental income'),
(:uid,'income','Interest'),(:uid,'income','Other income'),
(:uid,'expense','Food'),(:uid,'expense','Transport'),(:uid,'expense','Rent'),(:uid,'expense','Electricity'),
(:uid,'expense','Water'),(:uid,'expense','Internet'),(:uid,'expense','Healthcare'),(:uid,'expense','Education'),
(:uid,'expense','Shopping'),(:uid,'expense','Entertainment'),(:uid,'expense','Fuel'),
(:uid,'expense','Business expenses'),(:uid,'expense','Family expenses'),(:uid,'expense','Debt interest'),
(:uid,'expense','Other expenses');
