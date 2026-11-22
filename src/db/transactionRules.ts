import { isPaymentMode } from '@/lib/paymentMode';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';
import { assertValidIsoDate } from '@/lib/date';
import type { PaymentMode, TransactionType } from '@/types';
import { getDb, type AppDb } from './client';

export interface CreateTransactionInput {
  type: TransactionType;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amountMinor: number;
  date: string;
  note?: string;
  paymentMode?: PaymentMode | null;
  loanPaymentId?: string | null;
  /** Set on each part of a split payment (see db/splits.ts). */
  splitId?: string | null;
  /** Money back for a purchase: must be type 'income' against an expense category. */
  isRefund?: boolean;
  /** Set by the recurring-rule runner on the entries it posts, so Activity can call a SIP a SIP. */
  ruleId?: string | null;
}

/**
 * Savings accounts aren't spendable in place: money must transfer out before it's logged as income or
 * expense. Enforced here, not only in pickers, so every writer (recurring, friend ledger, imports...) obeys.
 */
export async function assertSpendableAccount(
  type: TransactionType,
  accountId: string,
  handle?: AppDb
): Promise<void> {
  if (type === 'transfer') return;
  const db = handle ?? (await getDb());
  const acc = await db.getFirstAsync<{ type: string }>('SELECT type FROM accounts WHERE id = ?', [accountId]);
  if (acc?.type === 'savings') {
    throw new Error(
      'Savings accounts can’t be used for income or expenses — transfer to a spendable account first.'
    );
  }
}

/**
 * A transfer moves the same stored number between accounts (the schema has no exchange rate), so across
 * currencies it would silently turn ₹1,000 into $1,000. Rejected until real conversion exists.
 */
async function assertSameCurrencyTransfer(
  type: TransactionType,
  accountId: string,
  toAccountId: string | null | undefined,
  handle?: AppDb
): Promise<void> {
  if (type !== 'transfer' || !toAccountId) return;
  const db = handle ?? (await getDb());
  const rows = await db.getAllAsync<{ id: string; currency: string }>(
    'SELECT id, currency FROM accounts WHERE id IN (?, ?)',
    [accountId, toAccountId]
  );
  const from = rows.find((r) => r.id === accountId)?.currency;
  const to = rows.find((r) => r.id === toAccountId)?.currency;
  if (from && to && from !== to) {
    throw new Error(
      `These accounts use different currencies (${from} and ${to}) — Yume can’t convert between them, so a transfer between them isn’t supported.`
    );
  }
}

/**
 * Every check createTransaction applies before writing; shared with runDueRecurringRules, which inserts inside
 * a transaction (see insertTransactionRow) yet must apply the same rules as a hand-typed entry.
 */
export async function assertValidTransactionInput(
  input: CreateTransactionInput,
  handle?: AppDb
): Promise<void> {
  assertValidIsoDate(input.date);
  if (input.paymentMode != null && !isPaymentMode(input.paymentMode))
    throw new Error('Choose a valid payment method.');
  if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (input.amountMinor > MAX_AMOUNT_MINOR) {
    throw new Error('That amount is too large');
  }
  if (!Number.isSafeInteger(input.amountMinor))
    throw new Error('Amount must be a whole number of minor units');
  if (input.type === 'transfer' && !input.toAccountId) {
    throw new Error('Transfer requires a destination account');
  }
  if (input.type === 'transfer' && input.toAccountId === input.accountId) {
    throw new Error('Cannot transfer to the same account');
  }
  if (input.type !== 'transfer' && !input.categoryId) {
    throw new Error('Income/expense requires a category');
  }
  await assertSpendableAccount(input.type, input.accountId, handle);
  await assertSameCurrencyTransfer(input.type, input.accountId, input.toAccountId, handle);
  if (input.isRefund) await assertRefundTarget(input.type, input.categoryId, handle);
}

/** A refund is money in, back to a spending category. */
async function assertRefundTarget(
  type: TransactionType,
  categoryId: string | null | undefined,
  handle?: AppDb
): Promise<void> {
  if (type !== 'income') throw new Error('A refund is money coming back in');
  const db = handle ?? (await getDb());
  const cat = await db.getFirstAsync<{ kind: string }>('SELECT kind FROM categories WHERE id = ?', [
    categoryId ?? '',
  ]);
  if (cat?.kind !== 'expense') throw new Error('A refund goes back to a spending category');
}
