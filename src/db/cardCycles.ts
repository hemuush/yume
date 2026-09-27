import { listAccounts, getAccountFlow } from './accounts';
import { buildCardCycle, cycleDates, CardCycle } from '@/lib/cardCycle';
import { toLocalIsoDate } from '@/lib/date';
import type { Account } from '@/types';

/**
 * The credit card cycle for each card that has both its statement day and
 * bill due day set (the Missing pieces sign-off). Everything is worked out
 * from the card's own entries: what it owed at the end of the statement day,
 * what's been paid into it since, and what's been spent on it since.
 */

export interface AccountCardCycle extends CardCycle {
  accountId: string;
  accountName: string;
}

/** Whether an account has what a bill cycle needs. */
export function tracksCardCycle(a: Account): a is Account & { statementDay: number; dueDay: number } {
  return a.type === 'credit_card' && a.statementDay != null && a.dueDay != null;
}

/** One card's cycle as of `today`. */
export async function getCardCycle(
  account: Account,
  today: string = toLocalIsoDate(new Date())
): Promise<AccountCardCycle | null> {
  if (!tracksCardCycle(account)) return null;
  const { statementDate, cycleStart } = cycleDates(account.statementDay, account.dueDay, today);
  const [upToStatement, since] = await Promise.all([
    getAccountFlow(account.id, { start: '0000-01-01', end: statementDate }),
    getAccountFlow(account.id, { start: cycleStart, end: today }),
  ]);
  // A card's balance is what's in it: negative while money is owed.
  const balanceAtStatement = account.openingBalanceMinor + upToStatement.inMinor - upToStatement.outMinor;
  const cycle = buildCardCycle({
    statementDay: account.statementDay,
    dueDay: account.dueDay,
    today,
    owedAtStatementMinor: -balanceAtStatement,
    paidSinceMinor: since.inMinor,
    spentThisCycleMinor: since.expenseMinor,
  });
  return { ...cycle, accountId: account.id, accountName: account.name };
}

/** Every tracked card's cycle, for Plan's Coming up and Home's Needs you. */
export async function listCardCycles(
  today: string = toLocalIsoDate(new Date())
): Promise<AccountCardCycle[]> {
  const cards = (await listAccounts()).filter(tracksCardCycle);
  const cycles = await Promise.all(cards.map((c) => getCardCycle(c, today)));
  return cycles.filter((c): c is AccountCardCycle => c != null);
}
