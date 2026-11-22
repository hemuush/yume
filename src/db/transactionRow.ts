import type { TransactionRow } from './rows';
import type { Transaction } from '@/types';

export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    date: row.date,
    note: row.note,
    paymentMode: row.payment_mode,
    loanPaymentId: row.loan_payment_id,
    splitId: row.split_id ?? null,
    isRefund: !!row.is_refund,
    ruleId: row.rule_id ?? null,
    dayRank: row.day_rank ?? null,
    splitTotalMinor: row.split_total_minor ?? null,
    createdAt: row.created_at,
  };
}
