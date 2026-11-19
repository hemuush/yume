import type { Transaction } from '@/types';
import type { PlanRoute } from './planOverview';
import type { PlanDetailKind } from './planSheetsStore';
import type { MoneySection } from './PlanMoneyTab';
import type { PlanTab } from './PlanNavigation';

/** What the parts of the Plan page can do: one object that keeps its identity, so they are not redrawn for it. */
export interface PlanActions {
  /** Opens a full screen (Loans, Budgets, Recurring…). */
  open: (route: PlanRoute) => void;
  /** Opens an item's detail, or a form to add one when `id` is empty. */
  openDetail: (kind: PlanDetailKind, id: string) => void;
  selectTab: (tab: PlanTab, upcomingDate?: string, collection?: MoneySection) => void;
  /** Pays a loan's due installment from Coming up. */
  payEmi: (loanId: string) => void;
  /** Opens an entry from the pending refunds. */
  openRefund: (tx: Transaction) => void;
  openComparison: () => void;
}
