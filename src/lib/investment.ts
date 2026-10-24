import type { Account, AccountInvestment, InvestmentKind, Transaction } from '@/types';
import { parseLocalIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';

/** A tracked account's value is "old" once its latest update is more than this many days back. */
export const STALE_DAYS = 35;

/** Gain as a percentage of what was put in; null before the first update or when nothing was invested. */
export function returnPct(inv: Pick<AccountInvestment, 'gainMinor' | 'investedMinor'>): number | null {
  if (inv.gainMinor == null || inv.investedMinor <= 0) return null;
  return (inv.gainMinor / inv.investedMinor) * 100;
}

/** "+6.1%" / "−2.4%" / "0.0%" — one decimal, a true minus sign. */
export function formatReturnPct(pct: number): string {
  const rounded = Math.round(Math.abs(pct) * 10) / 10;
  const sign = rounded === 0 ? '' : pct < 0 ? '−' : '+';
  return `${sign}${rounded.toFixed(1)}%`;
}

/** Whole days between two ISO dates (never negative). */
export function daysBetween(from: string, to: string): number {
  const ms = parseLocalIsoDate(to).getTime() - parseLocalIsoDate(from).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/** What a deposit or provident fund has grown to since its last update, from its yearly rate. */
export interface GrowthEstimate {
  valueMinor: number;
  /** Days of growth counted: from the last update to today, or to maturity if that came first. */
  days: number;
  /** The yearly rate used, in basis points. */
  rateBp: number;
  /** Maturity has passed: the estimate stopped growing there. */
  matured: boolean;
}

/**
 * An estimate of today's value for a fixed deposit (interest added quarterly, as banks do) or a PPF/EPF
 * account (added yearly): the last value you entered, grown at the rate for the days since, plus the money
 * that has moved in or out since. Null for any other kind, with no rate or no update yet, or when no day has
 * passed. It is an estimate only: the real figure is what your bank says, and entering it is always right.
 */
export function estimatedValue(
  account: Pick<Account, 'currentBalanceMinor' | 'interestRateAnnualBp'> & { investment?: AccountInvestment },
  today: string
): GrowthEstimate | null {
  const inv = account.investment;
  const rateBp = account.interestRateAnnualBp;
  if (!inv || rateBp == null || rateBp <= 0 || !inv.valuedAt || inv.lastValueMinor == null) return null;
  if (inv.kind !== 'fixed_deposit' && inv.kind !== 'ppf_epf') return null;
  const matured = !!inv.maturityDate && inv.maturityDate <= today;
  const end = matured ? inv.maturityDate! : today;
  const days = daysBetween(inv.valuedAt, end);
  if (days === 0) return null;
  const years = days / 365;
  const rate = rateBp / 10000;
  const factor = inv.kind === 'fixed_deposit' ? Math.pow(1 + rate / 4, 4 * years) : Math.pow(1 + rate, years);
  const moved = account.currentBalanceMinor - inv.lastValueMinor;
  const valueMinor = Math.round(inv.lastValueMinor * factor) + moved;
  return { valueMinor, days, rateBp, matured };
}

/** A yearly rate typed in percent ("7.1") as basis points; empty is none, anything else must be 0-100. */
export function parseYearlyRate(text: string): { rateBp: number | null } | { error: string } {
  const t = text.trim();
  if (!t) return { rateBp: null };
  const pct = Number(t);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100)
    return { error: 'The yearly rate is a percentage, from 0 to 100' };
  return { rateBp: Math.round(pct * 100) };
}

/** Whether a kind earns a known rate: a fixed deposit or a PPF/EPF account. */
export const earnsKnownRate = (kind: InvestmentKind | null | undefined) =>
  kind === 'fixed_deposit' || kind === 'ppf_epf';

/** Days since the latest update, or null when there is none yet. */
export function valueAgeDays(inv: Pick<AccountInvestment, 'valuedAt'>, today: string): number | null {
  return inv.valuedAt ? daysBetween(inv.valuedAt, today) : null;
}

export function isValueStale(inv: Pick<AccountInvestment, 'valuedAt'>, today: string): boolean {
  const age = valueAgeDays(inv, today);
  return age != null && age > STALE_DAYS;
}

/** Active tracked accounts (in their own currency) whose value hasn't been updated lately. */
export function staleTrackedAccounts(accounts: Account[], today: string): Account[] {
  return accounts.filter((a) => !a.archived && a.investment && isValueStale(a.investment, today));
}

/** "+₹2,560 · +6.1%": the gain in money and as a share of what went in; hidden amounts mask both. */
export function gainLabel(
  inv: Pick<AccountInvestment, 'gainMinor' | 'investedMinor'>,
  opts: { currency?: string; masked?: boolean; moneyOnly?: boolean } = {}
): string | null {
  if (inv.gainMinor == null) return null;
  if (opts.masked) return opts.moneyOnly ? '••••' : '•••• · ••%';
  const gain = inv.gainMinor;
  const money = `${gain < 0 ? '−' : gain > 0 ? '+' : ''}${formatMoney(Math.abs(gain), opts.currency)}`;
  const pct = returnPct(inv);
  return pct == null || opts.moneyOnly ? money : `${money} · ${formatReturnPct(pct)}`;
}

/** "28 days old" / "Today" for a value's age. */
export function ageLabel(days: number): string {
  return days === 0 ? 'Updated today' : days === 1 ? '1 day old' : `${days} days old`;
}

/** The first seven days of a month are when Suu nudges you to update a stale tracked value. */
const REMINDER_DAYS = 7;

/** Suu's month-start nudge about tracked accounts whose value has gone stale, or null. */
export function valueReminderLine(accounts: Account[], today: string): string | null {
  if (Number(today.slice(8, 10)) > REMINDER_DAYS) return null;
  const stale = staleTrackedAccounts(accounts, today);
  if (stale.length === 0) return null;
  return stale.length === 1
    ? `New month — what is ${stale[0].name} worth now? A quick update keeps its gain honest.`
    : `New month — ${stale.length} of your investments are due a value update.`;
}

export const INVESTMENT_KIND_LABEL: Record<InvestmentKind, string> = {
  mutual_fund: 'Mutual fund',
  stocks: 'Stocks',
  gold: 'Gold',
  fixed_deposit: 'Fixed deposit',
  ppf_epf: 'PPF / EPF',
  other: 'Other',
};

/** "Investment" or "Investment · Mutual fund": what an investment account is called wherever its type shows. */
export function investmentLabel(inv: Pick<AccountInvestment, 'kind'>): string {
  return inv.kind ? `Investment · ${INVESTMENT_KIND_LABEL[inv.kind]}` : 'Investment';
}

/** The ids of the accounts that are investments. */
export function investmentIdsOf(accounts: Pick<Account, 'id' | 'investment'>[]): Set<string> {
  return new Set(accounts.filter((a) => a.investment).map((a) => a.id));
}

/** What a transfer is to an investor: money put in, taken out, or moved from one holding to another. */
export type InvestRole = 'invest' | 'withdraw' | 'move';

/** The role of a transfer that touches an investment, or null for any other entry. */
export function investRole(
  tx: Pick<Transaction, 'type' | 'accountId' | 'toAccountId'>,
  investmentIds: ReadonlySet<string>
): InvestRole | null {
  if (tx.type !== 'transfer' || !tx.toAccountId) return null;
  const from = investmentIds.has(tx.accountId);
  const to = investmentIds.has(tx.toAccountId);
  return from && to ? 'move' : to ? 'invest' : from ? 'withdraw' : null;
}

/** The two lines an investing entry reads as in Activity: "Invested in Nifty 50" / "SIP · from HDFC". */
export function investLines(
  tx: Pick<Transaction, 'accountId' | 'toAccountId' | 'note' | 'ruleId'>,
  role: InvestRole,
  accountName: (id: string) => string
): { title: string; sub: string } {
  const from = accountName(tx.accountId);
  const to = accountName(tx.toAccountId!);
  const note = tx.note?.trim();
  const lead = note ? `${note} · ` : '';
  if (role === 'invest') {
    return { title: `Invested in ${to}`, sub: `${lead}${tx.ruleId ? 'SIP · ' : ''}from ${from}` };
  }
  if (role === 'withdraw') return { title: `Withdrawn from ${from}`, sub: `${lead}to ${to}` };
  return { title: `Moved ${from} → ${to}`, sub: `${lead}Between investments` };
}

/** What a recurring transfer that touches an investment is called: a SIP when money goes in. */
export function investRuleTitle(role: InvestRole, fromName: string, toName: string): string {
  return role === 'invest'
    ? `SIP · ${toName}`
    : role === 'withdraw'
      ? `Withdraw · ${fromName}`
      : `Move · ${fromName} → ${toName}`;
}

/** The Type column for an entry: Invested, SIP, Withdrawn or Moved for investing transfers, else null. */
export function investTypeLabel(
  tx: Pick<Transaction, 'type' | 'accountId' | 'toAccountId' | 'ruleId'>,
  investmentIds: ReadonlySet<string>
): string | null {
  const role = investRole(tx, investmentIds);
  if (!role) return null;
  return role === 'invest' ? (tx.ruleId ? 'SIP' : 'Invested') : role === 'withdraw' ? 'Withdrawn' : 'Moved';
}
