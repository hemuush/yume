import type { TransactionType } from '@/types';

/** Activity's row filters; chart scope is deliberately independent. */
export interface ActivityFilter {
  type: TransactionType | 'all';
  expenseLabel?: string;
  categoryIds: string[];
  /** A transfer matches either account. */
  accountIds: string[];
}
