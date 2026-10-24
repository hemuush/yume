import type { Account, InvestmentKind, RecurringRule } from '@/types';
import type { InvestmentFlow, InvestmentValuation } from '@/db/investmentHistory';
import {
  daysBetween,
  investmentIdsOf,
  isValueStale,
  valueAgeDays,
  returnPct,
  INVESTMENT_KIND_LABEL,
} from './investment';

/**
 * The investments as one portfolio: totals, split, chart, SIPs and a yearly rate. Every figure is built from
 * the same per-account numbers each account sheet shows (invested = opening + transfers in; gain = value +
 * taken out − invested), so the page can never disagree with a sheet. Pure: nothing here reads the database.
 */

export interface Holding {
  account: Account;
  id: string;
  name: string;
  kind: InvestmentKind | null;
  valueMinor: number;
  investedMinor: number;
  takenOutMinor: number;
  gainMinor: number | null;
  returnPct: number | null;
  valuedAt: string | null;
  ageDays: number | null;
  stale: boolean;
  fundingAccountId: string | null;
}

export interface Portfolio {
  currency: string;
  /** Active investments in the default currency; the totals add these. */
  holdings: Holding[];
  /** Active investments in another currency: listed, never added in. */
  otherCurrency: Holding[];
  valueMinor: number;
  investedMinor: number;
  takenOutMinor: number;
  /** Gain of the holdings that have a value update; null when none has. */
  gainMinor: number | null;
  returnPct: number | null;
  /** Holdings still waiting for their first value update. */
  unvaluedCount: number;
}

export function buildPortfolio(accounts: Account[], currency: string, today: string): Portfolio {
  const all: Holding[] = accounts
    .filter((a) => a.investment && !a.archived)
    .map((a) => {
      const inv = a.investment!;
      return {
        account: a,
        id: a.id,
        name: a.name,
        kind: inv.kind ?? null,
        valueMinor: a.currentBalanceMinor,
        investedMinor: inv.investedMinor,
        takenOutMinor: inv.takenOutMinor,
        gainMinor: inv.gainMinor,
        returnPct: returnPct(inv),
        valuedAt: inv.valuedAt,
        ageDays: valueAgeDays(inv, today),
        stale: isValueStale(inv, today),
        fundingAccountId: inv.fundingAccountId ?? null,
      };
    });
  const holdings = all.filter((h) => h.account.currency === currency);
  const valued = holdings.filter((h) => h.gainMinor != null);
  const gainMinor = valued.length ? valued.reduce((s, h) => s + h.gainMinor!, 0) : null;
  const base = valued.reduce((s, h) => s + h.investedMinor, 0);
  return {
    currency,
    holdings,
    otherCurrency: all.filter((h) => h.account.currency !== currency),
    valueMinor: holdings.reduce((s, h) => s + h.valueMinor, 0),
    investedMinor: holdings.reduce((s, h) => s + h.investedMinor, 0),
    takenOutMinor: holdings.reduce((s, h) => s + h.takenOutMinor, 0),
    gainMinor,
    returnPct: gainMinor != null && base > 0 ? (gainMinor / base) * 100 : null,
    unvaluedCount: holdings.length - valued.length,
  };
}

export interface SplitPart {
  key: string;
  label: string;
  valueMinor: number;
  share: number;
}

/** Worth by kind; by holding when no holding has a kind set. Only holdings worth something count. */
export function splitOf(holdings: Holding[]): SplitPart[] {
  const live = holdings.filter((h) => h.valueMinor > 0);
  const total = live.reduce((s, h) => s + h.valueMinor, 0);
  if (total === 0) return [];
  const byKind = live.some((h) => h.kind);
  const parts = new Map<string, SplitPart>();
  for (const h of live) {
    const key = byKind ? (h.kind ?? 'unset') : h.id;
    const label = byKind ? (h.kind ? INVESTMENT_KIND_LABEL[h.kind] : 'Not set') : h.name;
    const part = parts.get(key) ?? { key, label, valueMinor: 0, share: 0 };
    part.valueMinor += h.valueMinor;
    parts.set(key, part);
  }
  return [...parts.values()]
    .map((p) => ({ ...p, share: p.valueMinor / total }))
    .sort((a, b) => b.valueMinor - a.valueMinor);
}

/**
 * The yearly rate that makes dated money in, money out and today's value balance (XIRR), found by bisection.
 * Null when there is nothing to solve: no money in, no money back, or no rate between −99% and 10,000% fits.
 */
export function xirr(flows: { date: string; amountMinor: number }[]): number | null {
  if (flows.length < 2) return null;
  if (!flows.some((f) => f.amountMinor < 0) || !flows.some((f) => f.amountMinor > 0)) return null;
  const start = flows.reduce((d, f) => (f.date < d ? f.date : d), flows[0].date);
  const years = flows.map((f) => daysBetween(start, f.date) / 365);
  const npv = (rate: number) =>
    flows.reduce((s, f, i) => s + f.amountMinor / Math.pow(1 + rate, years[i]), 0);
  let lo = -0.99;
  let hi = 100;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-6 || hi - lo < 1e-10) return mid;
    if (fLo * fMid <= 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** The shortest history that gives a yearly rate worth showing. */
export const MIN_RATE_DAYS = 90;

/**
 * About how much the portfolio grows a year, from when each holding started to today. Null until at least one
 * holding has a value update and the history spans at least three months.
 */
export function annualisedReturn(
  portfolio: Portfolio,
  flows: InvestmentFlow[],
  today: string
): { rate: number; days: number } | null {
  const ids = new Set(portfolio.holdings.map((h) => h.id));
  if (!portfolio.holdings.some((h) => h.gainMinor != null)) return null;
  const cash: { date: string; amountMinor: number }[] = [];
  for (const h of portfolio.holdings) {
    if (h.account.openingBalanceMinor > 0) {
      cash.push({ date: h.account.createdAt.slice(0, 10), amountMinor: -h.account.openingBalanceMinor });
    }
    cash.push({ date: today, amountMinor: h.valueMinor });
  }
  for (const f of flows) if (ids.has(f.accountId)) cash.push({ date: f.date, amountMinor: -f.amountMinor });
  const first = cash.reduce((d, c) => (c.date < d ? c.date : d), today);
  const days = daysBetween(first, today);
  if (days < MIN_RATE_DAYS) return null;
  const rate = xirr(cash);
  return rate == null ? null : { rate, days };
}

export interface SeriesPoint {
  date: string;
  valueMinor: number;
  /** Net of what was put in and taken out, to that date. */
  putInMinor: number;
}

/**
 * Worth against money put in, at each date a value was entered and at today. A holding counts from the day it
 * was opened; with no update yet it is worth what was put in, and after one it is that value plus what moved
 * since.
 */
export function buildSeries(
  portfolio: Portfolio,
  history: { flows: InvestmentFlow[]; valuations: InvestmentValuation[] },
  today: string
): SeriesPoint[] {
  const holdings = portfolio.holdings;
  const ids = new Set(holdings.map((h) => h.id));
  const flows = history.flows.filter((f) => ids.has(f.accountId));
  const valuations = history.valuations.filter((v) => ids.has(v.accountId));
  const dates = [...new Set([...valuations.map((v) => v.date), today])].filter((d) => d <= today).sort();
  const at = (date: string): SeriesPoint => {
    let value = 0;
    let putIn = 0;
    for (const h of holdings) {
      const opened = h.account.createdAt.slice(0, 10);
      if (opened > date && !flows.some((f) => f.accountId === h.id && f.date <= date)) continue;
      const moved = flows
        .filter((f) => f.accountId === h.id && f.date <= date)
        .reduce((s, f) => s + f.amountMinor, 0);
      putIn += h.account.openingBalanceMinor + moved;
      const last = valuations
        .filter((v) => v.accountId === h.id && v.date <= date)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (!last) value += h.account.openingBalanceMinor + moved;
      else {
        const since = flows
          .filter((f) => f.accountId === h.id && f.date > last.date && f.date <= date)
          .reduce((s, f) => s + f.amountMinor, 0);
        value += last.valueMinor + since;
      }
    }
    return { date, valueMinor: value, putInMinor: putIn };
  };
  return dates.map(at);
}

/** The slice of the series within the last `months` months (all of it when null). */
export function seriesSince(series: SeriesPoint[], months: number | null, today: string): SeriesPoint[] {
  if (months == null || series.length === 0) return series;
  const [y, m, d] = today.split('-').map(Number);
  const cut = new Date(Date.UTC(y, m - 1 - months, d));
  const from = `${cut.getUTCFullYear()}-${String(cut.getUTCMonth() + 1).padStart(2, '0')}-${String(cut.getUTCDate()).padStart(2, '0')}`;
  const inside = series.filter((p) => p.date >= from);
  // One point before the window keeps the line starting where the window begins.
  const before = [...series].reverse().find((p) => p.date < from);
  return before && inside.length < series.length ? [before, ...inside] : inside;
}

export interface Sip {
  rule: RecurringRule;
  holdingId: string;
  holdingName: string;
  fromName: string;
  monthlyMinor: number;
  active: boolean;
}

/** What one run adds up to over a month: weekly runs about 4.3 times, a yearly one a twelfth. */
export function monthlyEquivalent(
  rule: Pick<RecurringRule, 'amountMinor' | 'frequency' | 'intervalCount'>
): number {
  const perMonth = { daily: 365 / 12, weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[rule.frequency];
  return Math.round((rule.amountMinor * perMonth) / Math.max(1, rule.intervalCount));
}

/** Recurring transfers into an investment: the SIPs. A rule between two investments is a move, not a SIP. */
export function sipsOf(rules: RecurringRule[], accounts: Account[]): Sip[] {
  const ids = investmentIdsOf(accounts);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return rules
    .filter((r) => r.type === 'transfer' && r.toAccountId && ids.has(r.toAccountId) && !ids.has(r.accountId))
    .map((rule) => ({
      rule,
      holdingId: rule.toAccountId!,
      holdingName: byId.get(rule.toAccountId!)?.name ?? '—',
      fromName: byId.get(rule.accountId)?.name ?? '—',
      monthlyMinor: monthlyEquivalent(rule),
      active: rule.active,
    }))
    .sort(
      (a, b) => Number(b.active) - Number(a.active) || a.rule.nextRunDate.localeCompare(b.rule.nextRunDate)
    );
}

/** What the active SIPs into default-currency holdings add up to a month. */
export function monthlySipTotal(sips: Sip[], accounts: Account[], currency: string): number {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return sips
    .filter((s) => s.active && byId.get(s.holdingId)?.currency === currency)
    .reduce((n, s) => n + s.monthlyMinor, 0);
}
