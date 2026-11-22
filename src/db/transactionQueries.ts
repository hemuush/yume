import { getDb, type SqlParam } from './client';
import type { TransactionRow } from './rows';
import { rowToTransaction } from './transactionRow';
import { SPEND_ROWS } from './spendSql';
import { getDefaultCurrency } from './settings';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { parseSearchQuery } from '@/lib/searchQuery';
import type { Transaction, TransactionType } from '@/types';

export async function listTransactions(filters?: {
  currency?: string;
  accountId?: string;
  categoryId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  /**
   * With `categoryId`, also match its subcategories: the same rollup Reports' "Where it went" totals use, so a
   * category's list is exactly what its total was built from. No-op without subcategories.
   */
  includeSubcategories?: boolean;
  /** Filter before LIMIT, so ordinary income cannot crowd spending/refunds out of budget details. */
  spendingOnly?: boolean;
}): Promise<Transaction[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const args: SqlParam[] = [];
  if (filters?.spendingOnly) clauses.push(SPEND_ROWS);

  if (filters?.currency) {
    clauses.push('account_id IN (SELECT id FROM accounts WHERE currency = ?)');
    args.push(filters.currency);
  }

  if (filters?.accountId) {
    clauses.push('(account_id = ? OR to_account_id = ?)');
    args.push(filters.accountId, filters.accountId);
  }
  if (filters?.categoryId && filters.includeSubcategories) {
    clauses.push('(category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))');
    args.push(filters.categoryId, filters.categoryId);
  } else if (filters?.categoryId) {
    clauses.push('category_id = ?');
    args.push(filters.categoryId);
  }
  if (filters?.fromDate) {
    clauses.push('date >= ?');
    args.push(filters.fromDate);
  }
  if (filters?.toDate) {
    clauses.push('date <= ?');
    args.push(filters.toDate);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  // A NaN limit (e.g. from parseInt('')) interpolated into the query gave "LIMIT NaN", a SQLite syntax error:
  // parameterized like other values, and omitted unless a valid positive integer.
  const hasLimit = Number.isFinite(filters?.limit) && (filters?.limit as number) > 0;
  if (hasLimit) args.push(Math.floor(filters!.limit as number));
  const rows = await db.getAllAsync<TransactionRow>(
    // A split part carries its whole payment's total, for "Part of a ₹1,850 split".
    `SELECT t.*,
       (SELECT SUM(s.amount_minor) FROM transactions s WHERE s.split_id = t.split_id) AS split_total_minor
     FROM transactions t ${where} ORDER BY date DESC, (day_rank IS NOT NULL) ASC, day_rank ASC, created_at DESC ${hasLimit ? 'LIMIT ?' : ''}`,
    args
  );
  return rows.map(rowToTransaction);
}

/**
 * Most-used amounts for a category in the last 90 days (Add's quick-pick). Ranked by how often an exact amount
 * recurs, not recency, so repeats beat a recent one-off; ties go to the latest. 90 days sheds old habits.
 */
export async function getFrequentAmountsForCategory(
  categoryId: string,
  limit = 4,
  today: string = toLocalIsoDate(new Date()),
  hideSensitive = false,
  accountCurrency?: string
): Promise<number[]> {
  const db = await getDb();
  const currency = accountCurrency ?? (await getDefaultCurrency());
  const since = addDaysToIsoDate(today, -90);
  // Same currency scoping as every other aggregate (see getPeriodSummary): without the accounts join, a
  // foreign-currency transaction would rank among default-currency ones with its face value mislabeled.
  const rows = await db.getAllAsync<{ amount_minor: number }>(
    `SELECT t.amount_minor as amount_minor, COUNT(*) as freq, MAX(t.date) as lastDate
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE t.category_id = ? AND a.currency = ? AND t.date >= ? AND t.date <= ?
       AND (? = 0 OR (c.is_sensitive = 0 AND COALESCE(pc.is_sensitive, 0) = 0))
     GROUP BY t.amount_minor
     ORDER BY freq DESC, lastDate DESC, t.amount_minor ASC
     LIMIT ?`,
    [categoryId, currency, since, today, hideSensitive ? 1 : 0, limit]
  );
  return rows.map((r) => r.amount_minor);
}

/**
 * The account most recently used with a category, if any: Add picks it as the default once a category is
 * chosen. Archived accounts are skipped.
 */
export async function getLastAccountForCategory(categoryId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ account_id: string }>(
    `SELECT t.account_id AS account_id
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.category_id = ? AND a.archived = 0
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 1`,
    [categoryId]
  );
  return row?.account_id ?? null;
}

/** How long after saving an entry an identical one counts as a possible repeat. */
const REPEAT_WINDOW_MINUTES = 30;

/** `created_at`'s own format: UTC, "YYYY-MM-DD HH:MM:SS" (SQLite's datetime('now')). */
function toSqliteUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * An identical entry (type, account(s), category, amount, date) saved within REPEAT_WINDOW_MINUTES, or null;
 * returns its ISO save time. Add asks "add it anyway?": a double tap or forgotten entry is the usual cause.
 */
export async function findRecentRepeat(
  input: {
    type: TransactionType;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    amountMinor: number;
    date: string;
  },
  now: Date = new Date()
): Promise<{ savedAt: string } | null> {
  const db = await getDb();
  const since = toSqliteUtc(new Date(now.getTime() - REPEAT_WINDOW_MINUTES * 60_000));
  const row = await db.getFirstAsync<{ created_at: string }>(
    `SELECT created_at FROM transactions
     WHERE type = ? AND account_id = ? AND IFNULL(to_account_id, '') = ? AND IFNULL(category_id, '') = ?
       AND amount_minor = ? AND date = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [
      input.type,
      input.accountId,
      input.toAccountId ?? '',
      input.categoryId ?? '',
      input.amountMinor,
      input.date,
      since,
    ]
  );
  return row ? { savedAt: `${row.created_at.replace(' ', 'T')}Z` } : null;
}

/**
 * Cross-period search: each word must match note, category name or account (either transfer side);
 * numbers also match the amount, a day ("24 sep") the date (parseSearchQuery). Deliberately not period-scoped.
 */
export async function searchTransactions(
  query: string,
  limit = 50,
  today: string = toLocalIsoDate(new Date()),
  maskPrivateAmounts = false
): Promise<Transaction[]> {
  const { date, words } = parseSearchQuery(query, today);
  if (!date && words.length === 0) return [];
  const db = await getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (date) {
    clauses.push('t.date = ?');
    params.push(date);
  }
  for (const word of words) {
    // `%` and `_` are SQL LIKE wildcards: unescaped, searching a literal "50%" would match "50" followed by
    // anything (silent over-matching).
    const like = `%${word.text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const text = `t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR pc.name LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\' OR ta.name LIKE ? ESCAPE '\\'`;
    if (word.amountMinor) {
      const publicAmount = maskPrivateAmounts
        ? ` AND CASE WHEN t.type = 'transfer'
            THEN COALESCE(a.type, 'savings') != 'savings' AND COALESCE(ta.type, 'savings') != 'savings'
            ELSE t.category_id IS NULL OR (c.id IS NOT NULL AND COALESCE(c.is_sensitive, 0) = 0
              AND (c.parent_id IS NULL OR (pc.id IS NOT NULL AND COALESCE(pc.is_sensitive, 0) = 0)))
          END`
        : '';
      clauses.push(`(${text} OR (t.amount_minor BETWEEN ? AND ?${publicAmount}))`);
      params.push(like, like, like, like, like, word.amountMinor.min, word.amountMinor.max);
    } else {
      clauses.push(`(${text})`);
      params.push(like, like, like, like, like);
    }
  }
  const cappedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.* FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT ?`,
    [...params, cappedLimit]
  );
  return rows.map(rowToTransaction);
}

export interface RepeatEntry {
  isSensitive?: boolean;
  type: 'expense' | 'income';
  accountId: string;
  accountCurrency: string;
  categoryId: string;
  categoryName: string;
  /** The parent's name when the category is a subcategory, so same-named children can be told apart. */
  parentName: string | null;
  categoryIcon: string;
  categoryColor: string;
  amountMinor: number;
  /** The note from the most recent occurrence, '' if it had none. */
  note: string;
  timesLogged: number;
}

/**
 * Entries (type, account, category, amount) hand-logged 2+ times in 90 days, most repeated first (Log again).
 * Skips loan/friend and built-in-category entries (mis-filed), recurring-rule ones (double), archived/savings.
 */
export async function getRepeatEntries(
  limit = 3,
  today: string = toLocalIsoDate(new Date()),
  type?: 'expense' | 'income'
): Promise<RepeatEntry[]> {
  const db = await getDb();
  const since = addDaysToIsoDate(today, -90);
  // `t.note` is a bare column next to the single MAX(): SQLite takes it from
  // that same row, i.e. the most recent occurrence's note.
  const rows = await db.getAllAsync<{
    type: 'expense' | 'income';
    account_id: string;
    currency: string;
    category_id: string;
    category_name: string;
    parent_name: string | null;
    category_icon: string;
    category_color: string;
    is_sensitive: number;
    amount_minor: number;
    freq: number;
    last_key: string;
    note: string;
  }>(
    `SELECT t.type AS type, t.account_id AS account_id, a.currency AS currency,
       t.category_id AS category_id, c.name AS category_name, pc.name AS parent_name, c.icon AS category_icon, c.color AS category_color,
       t.amount_minor AS amount_minor, MAX(c.is_sensitive, COALESCE(pc.is_sensitive, 0)) AS is_sensitive, COUNT(*) AS freq,
       MAX(t.date || ' ' || t.created_at) AS last_key, t.note AS note
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     JOIN accounts a ON a.id = t.account_id
     WHERE t.type IN ('expense', 'income') AND (? IS NULL OR t.type = ?) AND t.loan_id IS NULL AND t.is_refund = 0
       AND c.archived = 0 AND c.is_system = 0 AND a.archived = 0 AND a.type != 'savings'
       AND t.date >= ? AND t.date <= ?
       AND NOT EXISTS (SELECT 1 FROM loan_payments lp WHERE lp.transaction_id = t.id)
       AND NOT EXISTS (SELECT 1 FROM person_ledger_entries pe WHERE pe.transaction_id = t.id)
       AND NOT EXISTS (
         SELECT 1 FROM recurring_rules r
         WHERE r.active = 1 AND r.type = t.type AND r.account_id = t.account_id
           AND r.category_id = t.category_id AND r.amount_minor = t.amount_minor
       )
     GROUP BY t.type, t.account_id, t.category_id, t.amount_minor
     HAVING COUNT(*) >= 2
     ORDER BY freq DESC, last_key DESC
     LIMIT ?`,
    [type ?? null, type ?? null, since, today, limit]
  );
  return rows.map((r) => ({
    type: r.type,
    accountId: r.account_id,
    accountCurrency: r.currency,
    categoryId: r.category_id,
    categoryName: r.category_name,
    parentName: r.parent_name,
    categoryIcon: r.category_icon,
    categoryColor: r.category_color,
    isSensitive: !!r.is_sensitive,
    amountMinor: r.amount_minor,
    note: r.note ?? '',
    timesLogged: r.freq,
  }));
}

/** How many transactions exist at all — a cheap COUNT for UI that only needs "is there real data yet". */
export async function countTransactions(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
  return row?.n ?? 0;
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ?', [id]);
  return row ? rowToTransaction(row) : null;
}
