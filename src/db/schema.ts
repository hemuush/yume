// SQLite DDL for Flynse. Money = integer minor units. IDs = UUID text.
// Balance integrity: account balances are NEVER stored as free-standing mutable
// fields updated ad-hoc — they're recomputed from ledger entries by db/ledger.ts
// so a bug in one screen can never silently desync a balance from its transactions.

export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank','cash','wallet','credit_card','savings')),
  currency TEXT NOT NULL DEFAULT 'INR',
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  credit_limit_minor INTEGER,
  statement_day INTEGER,
  due_day INTEGER,
  interest_rate_annual_bp INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#6366F1',
  archived INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_sensitive INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('borrowed','lent')),
  counterparty TEXT NOT NULL,
  principal_minor INTEGER NOT NULL,
  interest_rate_annual_bp INTEGER NOT NULL,
  tenure_months INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  emi_amount_minor INTEGER NOT NULL,
  outstanding_principal_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','defaulted')),
  linked_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  rate_type TEXT NOT NULL DEFAULT 'fixed' CHECK (rate_type IN ('fixed','floating')),
  person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  -- What a *borrowed* loan actually financed (a home, a vehicle), and its
  -- current tracked value — both null by default, matching the original
  -- "Flynse doesn't track assets" behavior exactly for anyone who doesn't
  -- set one. Once set, the loan's own net-worth contribution becomes its
  -- real equity (asset value minus what's still owed) instead of counting
  -- pure debt with nothing offsetting it.
  asset_label TEXT,
  asset_value_minor INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  paid_date TEXT,
  emi_amount_minor INTEGER NOT NULL,
  principal_component_minor INTEGER NOT NULL,
  interest_component_minor INTEGER NOT NULL,
  outstanding_after_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','prepaid'))
);

-- One row per applyRateChange call — otherwise a floating loan's rate
-- history is lost the moment it's overwritten, leaving no record of what
-- it used to be or when/why it changed (which mode was used, whether the
-- EMI or the tenure absorbed the difference).
CREATE TABLE IF NOT EXISTS loan_rate_changes (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  old_rate_annual_bp INTEGER NOT NULL,
  new_rate_annual_bp INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('keepEmi','keepTenure')),
  old_emi_amount_minor INTEGER NOT NULL,
  new_emi_amount_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  payment_mode TEXT CHECK (payment_mode IN ('cash','debit','credit','upi','bank_transfer','other')),
  loan_payment_id TEXT REFERENCES loan_payments(id) ON DELETE SET NULL,
  -- Set only for a loan's disbursement/processing-fee/prepayment transactions
  -- (never for an EMI payment, which is linked the other way via
  -- loan_payments.transaction_id instead). ON DELETE CASCADE so deleting a
  -- loan removes these along with it, rather than leaving them behind as
  -- transactions with no loan to point back to.
  loan_id TEXT REFERENCES loans(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (type != 'transfer' OR to_account_id IS NOT NULL),
  CHECK (type = 'transfer' OR category_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_amount_minor INTEGER NOT NULL,
  current_amount_minor INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  linked_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  limit_amount_minor INTEGER NOT NULL,
  rollover INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, period_month)
);

-- People/Friends ledger: informal, interest-free IOUs. Distinct from the
-- loans table (which is for real, scheduled loans). A person's balance is
-- SUM(amount_minor) across their entries: positive = they owe you, negative
-- = you owe them.
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS person_ledger_entries (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Free-form key/value app settings (default currency, theme, etc).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  amount_minor INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  payment_mode TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  interval_count INTEGER NOT NULL DEFAULT 1,
  next_run_date TEXT NOT NULL,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_rate_changes_loan ON loan_rate_changes(loan_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_person_ledger_person ON person_ledger_entries(person_id);
`;
