import { listAccounts, getAccountFlow } from './accounts';
import { buildCardCycle, cycleDates, CardCycle } from '@/lib/cardCycle';
import { toLocalIsoDate } from '@/lib/date';
import type { Account } from '@/types';
import { cachedRead } from './readCache';

/**
 * Cycle for each card with a statement day and bill due day, derived from its entries: owed at statement-day
 * end, paid into it since, and spent on it since.
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
export function listCardCycles(today: string = toLocalIsoDate(new Date())): Promise<AccountCardCycle[]> {
  // Home, its Needs you list and Plan all ask for today's; computed once per change.
  return cachedRead(`cardCycles:${today}`, async () => {
    const cards = (await listAccounts()).filter(tracksCardCycle);
    const cycles = await Promise.all(cards.map((c) => getCardCycle(c, today)));
    return cycles.filter((c): c is AccountCardCycle => c != null);
  });
}
