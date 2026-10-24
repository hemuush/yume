import type { TransactionType } from '@/types';

/** The one-tap type choices on Activity: an entry's type, or Invest for money moved into or out of an investment. */
export type ActivityType = TransactionType | 'all' | 'invest';

/** Activity's row filters; chart scope is deliberately independent. */
export interface ActivityFilter {
  type: ActivityType;
  expenseLabel?: string;
  categoryIds: string[];
  /** A transfer matches either account. */
  accountIds: string[];
}
