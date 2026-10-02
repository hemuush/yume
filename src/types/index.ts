// Core domain types for Yume — personal finance tracker.
// Money is always stored as integer minor units (paise) to avoid float errors.

export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit_card' | 'savings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string; // ISO 4217, e.g. "INR"
  openingBalanceMinor: number;
  currentBalanceMinor: number; // derived, kept in sync by ledger triggers
  creditLimitMinor: number | null; // credit_card only
  statementDay: number | null; // credit_card only, 1-31 (a short month uses its last day)
  dueDay: number | null; // credit_card only, 1-31 (a short month uses its last day)
  interestRateAnnualBp: number | null; // credit_card only, basis points
  archived: boolean;
  createdAt: string;
  /** Present only on a tracked account (value updated by hand); its currentBalanceMinor is then the value. */
  investment?: AccountInvestment;
}

/** What a tracked account has had put in, taken out and gained — gain is null until the first value update. */
export interface AccountInvestment {
  /** Invested so far (the opening figure) plus every transfer in. */
  investedMinor: number;
  takenOutMinor: number;
  gainMinor: number | null;
  /** ISO date of the latest value update. */
  valuedAt: string | null;
  /** What that update said it was worth. */
  lastValueMinor: number | null;
}

export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  icon: string;
  color: string;
  archived: boolean;
  sortOrder: number;
  /** When on and the "hide savings & investment amounts" setting is also on, this category's amounts show masked wherever they appear. */
  isSensitive: boolean;
  /** A built-in category the app matches by name to auto-file loan / Friends & Family transactions — can't be deleted, archived, or renamed. */
  isSystem: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type PaymentMode = 'cash' | 'debit' | 'credit' | 'upi' | 'bank_transfer' | 'other';

export interface Transaction {
  id: string;
  type: TransactionType;
  accountId: string; // source account (debited for expense/transfer)
  toAccountId: string | null; // destination account, transfer only
  categoryId: string | null; // null for transfers
  amountMinor: number; // always positive
  date: string; // ISO date
  note: string;
  paymentMode: PaymentMode | null;
  loanPaymentId: string | null; // set when this tx is a loan repayment/disbursement
  /** Shared by the parts of one split payment (one bill across several categories); null otherwise. */
  splitId: string | null;
  /** Money back for a purchase: stored as money in, it lowers its (expense) category's spending instead of counting as income. */
  isRefund: boolean;
  /** Where the person dragged it within its day (0 = top); null/undefined when never reordered. */
  dayRank?: number | null;
  /** The whole split's total, on a part read from a list; undefined when not looked up. */
  splitTotalMinor?: number | null;
  createdAt: string;
}

export type LoanDirection = 'borrowed' | 'lent';
export type LoanStatus = 'active' | 'closed' | 'defaulted';
export type LoanRateType = 'fixed' | 'floating';

export interface Loan {
  id: string;
  direction: LoanDirection;
  counterparty: string; // bank name or person's name
  principalMinor: number;
  interestRateAnnualBp: number; // basis points, e.g. 950 = 9.50%
  tenureMonths: number;
  startDate: string;
  emiAmountMinor: number;
  outstandingPrincipalMinor: number;
  status: LoanStatus;
  linkedAccountId: string | null; // account disbursement/repayment flows through
  rateType: LoanRateType;
  personId: string | null; // optional link into the Friends & Family people table
  notes: string;
  createdAt: string;
  /** Due date of the earliest unpaid installment, or null once fully paid — not a stored column, joined in at query time. */
  nextDueDate: string | null;
  /** What this loan financed (e.g. "Home", "Car") — only meaningful for a borrowed loan; null if not tracked. */
  assetLabel: string | null;
  /** Current tracked value of that asset — offsets this loan's own net-worth contribution when set. Null (not 0) means "not tracked", not "worth nothing". */
  assetValueMinor: number | null;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  transactionId: string | null;
  installmentNumber: number;
  dueDate: string;
  paidDate: string | null;
  emiAmountMinor: number;
  principalComponentMinor: number;
  interestComponentMinor: number;
  outstandingAfterMinor: number;
  status: 'pending' | 'paid' | 'overdue' | 'prepaid';
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  targetDate: string | null;
  linkedAccountId: string | null;
  /**
   * True when progress follows the linked account's balance: then
   * `currentAmountMinor` is that balance (never below zero), not money
   * added by hand. Only ever true with a linked account.
   */
  tracksAccount: boolean;
  /** An optional note written at creation, sealed until the goal first reaches 100% — see contributeToGoal. */
  noteToSelf: string | null;
  /** Flips to true exactly once, the moment the completion reveal is shown — see markGoalLetterRevealed. */
  letterRevealed: boolean;
  archived: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  periodMonth: string; // "YYYY-MM"
  limitAmountMinor: number;
  rollover: boolean;
}

export interface Person {
  id: string;
  name: string;
  notes: string;
  archived: boolean;
  createdAt: string;
}

// Informal IOU ledger. Positive amountMinor = this entry increased what the
// person owes you (you paid for them / lent them cash). Negative = it
// reduced what they owe (they repaid you, or you're settling a debt to them).
export interface PersonLedgerEntry {
  id: string;
  personId: string;
  transactionId: string | null;
  amountMinor: number;
  date: string;
  note: string;
  createdAt: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  amountMinor: number;
  note: string;
  paymentMode: PaymentMode | null;
  frequency: RecurrenceFrequency;
  intervalCount: number; // every N frequency units
  nextRunDate: string;
  endDate: string | null;
  active: boolean;
}

/** An inclusive calendar-date range, both ends YYYY-MM-DD — what every report/period query takes. */
export interface DateRange {
  start: string; // inclusive, YYYY-MM-DD
  end: string; // inclusive, YYYY-MM-DD
}
