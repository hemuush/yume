/**
 * One interface per table, generated from schema.ts, so a row read from
 * SQLite is typed column by column instead of `any` — a misspelt column
 * in a row mapper is a compile error, not a silent `undefined`. SQLite's
 * INTEGER/REAL are `number`, TEXT is `string`; a column without NOT NULL
 * (and without a default) can be `null`. Booleans are stored as 0/1.
 */

/** A row of `accounts`. */
export interface AccountRow {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet' | 'credit_card' | 'savings';
  currency: string;
  opening_balance_minor: number;
  credit_limit_minor: number | null;
  statement_day: number | null;
  due_day: number | null;
  interest_rate_annual_bp: number | null;
  archived: number;
  created_at: string;
}

/** A row of `categories`. */
export interface CategoryRow {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  parent_id: string | null;
  icon: string;
  color: string;
  archived: number;
  sort_order: number;
  is_sensitive: number;
  is_system: number;
}

/** A row of `loans`. */
export interface LoanRow {
  id: string;
  direction: 'borrowed' | 'lent';
  counterparty: string;
  principal_minor: number;
  interest_rate_annual_bp: number;
  tenure_months: number;
  start_date: string;
  emi_amount_minor: number;
  outstanding_principal_minor: number;
  status: 'active' | 'closed' | 'defaulted';
  linked_account_id: string | null;
  rate_type: 'fixed' | 'floating';
  person_id: string | null;
  notes: string;
  asset_label: string | null;
  asset_value_minor: number | null;
  created_at: string;
}

/** A row of `loan_payments`. */
export interface LoanPaymentRow {
  id: string;
  loan_id: string;
  transaction_id: string | null;
  installment_number: number;
  due_date: string;
  paid_date: string | null;
  emi_amount_minor: number;
  principal_component_minor: number;
  interest_component_minor: number;
  outstanding_after_minor: number;
  status: 'pending' | 'paid' | 'overdue' | 'prepaid';
}

/** A row of `loan_rate_changes`. */
export interface LoanRateChangeRow {
  id: string;
  loan_id: string;
  old_rate_annual_bp: number;
  new_rate_annual_bp: number;
  effective_date: string;
  mode: 'keepEmi' | 'keepTenure';
  old_emi_amount_minor: number;
  new_emi_amount_minor: number;
  created_at: string;
}

/** A row of `transactions`. */
export interface TransactionRow {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  amount_minor: number;
  date: string;
  note: string;
  /** Unused since tags were removed from the app; kept (always '[]') so older backups still restore. */
  tags: string;
  /** Shared by the parts of one split payment; null otherwise. */
  split_id: string | null;
  /** 1 on money back for a purchase (type 'income', expense category). */
  is_refund: number;
  /** Only on list queries: the whole split's total, when this row is a part. */
  split_total_minor?: number | null;
  payment_mode: 'cash' | 'debit' | 'credit' | 'upi' | 'bank_transfer' | 'other' | null;
  loan_payment_id: string | null;
  loan_id: string | null;
  loan_tx_kind: 'disbursement' | 'fee' | 'prepayment' | 'prepayment_charge' | null;
  created_at: string;
}

/** A row of `savings_goals`. */
export interface SavingsGoalRow {
  id: string;
  name: string;
  target_amount_minor: number;
  current_amount_minor: number;
  target_date: string | null;
  linked_account_id: string | null;
  archived: number;
  created_at: string;
  note_to_self: string | null;
  letter_revealed: number;
  track_account: number;
}

/** A row of `budgets`. */
export interface BudgetRow {
  id: string;
  category_id: string;
  period_month: string;
  limit_amount_minor: number;
  rollover: number;
}

/** A row of `people`. */
export interface PersonRow {
  id: string;
  name: string;
  notes: string;
  archived: number;
  created_at: string;
}

/** A row of `person_ledger_entries`. */
export interface PersonLedgerEntryRow {
  id: string;
  person_id: string;
  transaction_id: string | null;
  amount_minor: number;
  date: string;
  note: string;
  created_at: string;
}

/** A row of `settings`. */
export interface SettingRow {
  key: string;
  value: string;
}

/** A row of `recurring_rules`. */
export interface RecurringRuleRow {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  amount_minor: number;
  note: string;
  payment_mode: string | null;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval_count: number;
  next_run_date: string;
  end_date: string | null;
  active: number;
  anchor_day: number | null;
}
