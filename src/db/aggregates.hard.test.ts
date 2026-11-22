/**
 * Seeded random ledgers compared with brute-force JS sums: period summaries, carry-in, monthly trends and
 * cash flow, budgets (spend, rollover), subscription totals and period ranges, on real SQLite.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
const mockTestDb = {
  getFirstAsync: <T>(sql: string, p?: any[]) => mockRaw.getFirstAsync<T>(sql, p),
  getAllAsync: <T>(sql: string, p?: any[]) => mockRaw.getAllAsync<T>(sql, p),
  runAsync: (sql: string, p?: any[]) => mockRaw.runAsync(sql, p),
  execAsync: (sql: string) => mockRaw.execAsync(sql),
  withTransactionAsync: (fn: (tx: typeof mockRaw) => Promise<void>) => mockRaw.withTransactionAsync(fn),
  exclusiveAsync: <T>(fn: (db: typeof mockRaw) => Promise<T>) => fn(mockRaw),
};
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory } from '@/db/ledger';
import { getPeriodRanges, getPeriodSummary, getCarryInMinor } from '@/db/reportsCore';
import { getMonthlyExpenseTrend, getMonthlyCashFlow } from '@/db/reportTrends';
import { createBudget, listBudgetsForMonth } from '@/db/budgets';
import { subscriptionTotals, monthlyCostMinor } from '@/db/subscriptions';

interface Tx {
  type: 'income' | 'expense' | 'transfer';
  account: string;
  to?: string;
  cat?: string;
  amt: number;
  date: string;
  refund: boolean;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const dim = (y: number, m: number) => new Date(y, m, 0).getDate();
function prevDay(d: string) {
  const [y, m, dd] = d.split('-').map(Number);
  const p = new Date(y, m - 1, dd - 1);
  return iso(p.getFullYear(), p.getMonth() + 1, p.getDate());
}

let bank: string, cash: string, sav: string, inv: string, usd: string;
const expCats: string[] = [];
let subCat: string; // child of expCats[0]
let incCat: string;
let ledger: Tx[] = [];
let n = 0;

async function insert(t: Tx, splitId: string | null = null): Promise<string> {
  const id = `t${n++}`;
  await mockRaw.runAsync(
    `INSERT INTO transactions (id, type, account_id, to_account_id, category_id, amount_minor, date, is_refund, split_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, t.type, t.account, t.to ?? null, t.cat ?? null, t.amt, t.date, t.refund ? 1 : 0, splitId]
  );
  return id;
}

// Oct 2023 .. Mar 2025: spans a year boundary and leap Feb 2024.
const MONTHS: [number, number][] = [];
for (let y = 2023, m = 10; ; m++) {
  if (m > 12) {
    m = 1;
    y++;
  }
  MONTHS.push([y, m]);
  if (y === 2025 && m === 3) break;
}

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  cash = (await createAccount({ name: 'Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 0 })).id;
  sav = (await createAccount({ name: 'Sav', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })).id;
  inv = (await createAccount({ name: 'Inv', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })).id;
  usd = (await createAccount({ name: 'Usd', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })).id;
  await mockRaw.runAsync('UPDATE accounts SET tracked = 1 WHERE id = ?', [inv]);
  for (const name of ['Food', 'Rent', 'Fun', 'Travel']) {
    expCats.push((await createCategory({ name, kind: 'expense' })).id);
  }
  subCat = (await createCategory({ name: 'Snacks', kind: 'expense', parentId: expCats[0] } as any)).id;
  incCat = (await createCategory({ name: 'Pay', kind: 'income' })).id;
  const row = await mockRaw.getFirstAsync<{ parent_id: string | null }>(
    'SELECT parent_id FROM categories WHERE id = ?',
    [subCat]
  );
  expect(row!.parent_id).toBe(expCats[0]);

  const rand = rng(20240229);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const paise = () => 1 + Math.floor(rand() * 250000);
  const kept: Tx[] = [];
  for (const [y, m] of MONTHS) {
    const last = dim(y, m);
    const days = [1, last, 1 + Math.floor(rand() * last)]; // first and last day every month
    if (y === 2024 && m === 2) days.push(29);
    for (let i = 0; i < 28; i++) days.push(1 + Math.floor(rand() * last));
    for (const d of days) {
      const date = iso(y, m, d);
      const r = rand();
      let t: Tx;
      if (r < 0.55) {
        t = {
          type: 'expense',
          account: pick([bank, cash, usd]),
          cat: pick([...expCats, subCat]),
          amt: paise(),
          date,
          refund: false,
        };
      } else if (r < 0.7) {
        t = {
          type: 'income',
          account: pick([bank, cash]),
          cat: pick([...expCats, subCat]),
          amt: paise(),
          date,
          refund: true,
        };
      } else if (r < 0.82) {
        t = { type: 'income', account: pick([bank, usd]), cat: incCat, amt: paise(), date, refund: false };
      } else if (r < 0.93) {
        const s = pick([sav, inv]);
        t =
          rand() < 0.3
            ? { type: 'transfer', account: s, to: bank, amt: paise(), date, refund: false }
            : { type: 'transfer', account: bank, to: s, amt: paise(), date, refund: false };
      } else {
        t = { type: 'transfer', account: bank, to: cash, amt: paise(), date, refund: false };
      }
      const id = await insert(t);
      if (rand() < 0.08) await mockRaw.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
      else kept.push(t);
    }
  }
  // One split bill: three parts, three categories, same day.
  for (const p of [1111, 2222, 3333]) {
    const t: Tx = {
      type: 'expense',
      account: bank,
      cat: pick(expCats),
      amt: p,
      date: iso(2025, 1, 31),
      refund: false,
    };
    await insert(t, 'split-1');
    kept.push(t);
  }
  ledger = kept;
});

// ---- brute-force reference ----
const isInr = (id: string) => id !== usd;
const isSavings = (id: string) => id === sav || id === inv;
const topOf = (c: string) => (c === subCat ? expCats[0] : c);
const spendOf = (t: Tx) => (t.type === 'expense' ? t.amt : -t.amt);
const isSpend = (t: Tx) => t.type === 'expense' || (t.type === 'income' && t.refund);

function refSummary(start: string, end: string) {
  let income = 0,
    spend = 0,
    sin = 0,
    sout = 0;
  const byTop = new Map<string, number>();
  for (const t of ledger) {
    if (t.date < start || t.date > end || !isInr(t.account)) continue;
    if (t.type === 'income' && !t.refund) income += t.amt;
    if (isSpend(t)) {
      spend += spendOf(t);
      byTop.set(topOf(t.cat!), (byTop.get(topOf(t.cat!)) ?? 0) + spendOf(t));
    }
    if (t.type === 'transfer') {
      if (isSavings(t.to!)) sin += t.amt;
      if (isSavings(t.account)) sout += t.amt;
    }
  }
  const expense = Math.max(0, spend);
  return { income, spend, expense, saved: sin - sout, net: income - expense - (sin - sout), byTop };
}

describe('getPeriodSummary vs brute force', () => {
  const ranges: [string, string][] = MONTHS.map(([y, m]) => [iso(y, m, 1), iso(y, m, dim(y, m))]);
  ranges.push(['2023-10-01', '2025-03-31'], ['2024-12-31', '2025-01-01'], ['2024-02-29', '2024-02-29']);
  ranges.push(['2030-01-01', '2030-01-31']); // empty

  it.each(ranges)('%s .. %s', async (start, end) => {
    const got = await getPeriodSummary({ start, end });
    const ref = refSummary(start, end);
    expect(got.incomeMinor).toBe(ref.income);
    expect(got.expenseMinor).toBe(ref.expense);
    expect(got.savingsContributionMinor).toBe(ref.saved);
    expect(got.netMinor).toBe(ref.net);
    const positive = [...ref.byTop.entries()].filter(([, v]) => v > 0);
    expect(got.categoryBreakdown.map((r) => [r.categoryId, r.totalMinor]).sort()).toEqual(positive.sort());
    // Parts add up to the total when no category nets negative.
    if (positive.length === ref.byTop.size) {
      expect(got.categoryBreakdown.reduce((s, r) => s + r.totalMinor, 0)).toBe(ref.expense);
    }
  });

  it('first and last second of a month land in that month only', async () => {
    const [feb, mar] = [
      await getPeriodSummary({ start: '2024-02-01', end: '2024-02-29' }),
      await getPeriodSummary({ start: '2024-03-01', end: '2024-03-31' }),
    ];
    const both = await getPeriodSummary({ start: '2024-02-01', end: '2024-03-31' });
    expect(feb.incomeMinor + mar.incomeMinor).toBe(both.incomeMinor);
    expect(feb.savingsContributionMinor + mar.savingsContributionMinor).toBe(both.savingsContributionMinor);
  });

  it('a whole period equals the sum of its months (income, savings)', async () => {
    const whole = await getPeriodSummary({ start: '2023-10-01', end: '2025-03-31' });
    let income = 0,
      saved = 0;
    for (const [y, m] of MONTHS) {
      const s = await getPeriodSummary({ start: iso(y, m, 1), end: iso(y, m, dim(y, m)) });
      income += s.incomeMinor;
      saved += s.savingsContributionMinor;
    }
    expect(whole.incomeMinor).toBe(income);
    expect(whole.savingsContributionMinor).toBe(saved);
  });

  it('carry-in is income - unclamped spend - saved before the date, and rolls month to month', async () => {
    for (const before of [
      '2023-10-01',
      '2024-02-29',
      '2024-03-01',
      '2025-01-01',
      '2025-04-01',
      '2020-01-01',
    ]) {
      const r = refSummary('0000-01-01', prevDay(before));
      expect(await getCarryInMinor(before)).toBe(r.income - r.spend - r.saved);
    }
    // carry(next month) = carry(this month) + that month's net, where net uses unclamped spend
    const c1 = await getCarryInMinor('2024-12-01');
    const c2 = await getCarryInMinor('2025-01-01');
    const dec = refSummary('2024-12-01', '2024-12-31');
    expect(c2 - c1).toBe(dec.income - dec.spend - dec.saved);
  });
});

describe('monthly trend and cash flow', () => {
  it('match per-month brute force across the year boundary', async () => {
    const ref = new Date(2025, 2, 15);
    const trend = await getMonthlyExpenseTrend(18, ref);
    const flow = await getMonthlyCashFlow(18, ref);
    expect(trend).toHaveLength(18);
    expect(flow.map((f) => f.month)).toEqual(MONTHS.map(([y, m]) => `${y}-${pad(m)}`));
    MONTHS.forEach(([y, m], i) => {
      const r = refSummary(iso(y, m, 1), iso(y, m, dim(y, m)));
      expect(trend[i].totalMinor).toBe(r.expense);
      expect(flow[i].expenseMinor).toBe(r.expense);
      expect(flow[i].incomeMinor).toBe(r.income);
    });
  });

  it('months before the first entry are empty and not recorded', async () => {
    const flow = await getMonthlyCashFlow(24, new Date(2025, 2, 15));
    expect(flow[0].recorded).toBe(false);
    expect(flow[0].incomeMinor).toBe(0);
    expect(flow[0].expenseMinor).toBe(0);
    expect(flow[6].recorded).toBe(true);
  });
});

describe('budgets', () => {
  it('spent, rollover limit and remaining equal brute force (parent rolls up its subcategory)', async () => {
    const month = '2025-01',
      prev = '2024-12';
    const limits = [500000, 300000, 800000];
    for (const [i, lim] of limits.entries()) {
      await createBudget({
        categoryId: expCats[i],
        limitAmountMinor: lim,
        rollover: i !== 1,
        periodMonth: prev,
      });
      await createBudget({
        categoryId: expCats[i],
        limitAmountMinor: lim + 7,
        rollover: i !== 1,
        periodMonth: month,
      });
    }
    await createBudget({ categoryId: subCat, limitAmountMinor: 100001, rollover: false, periodMonth: month });
    const progress = await listBudgetsForMonth(month);
    const spend = (cat: string, y: number, m: number) => {
      const fam = cat === expCats[0] ? [cat, subCat] : [cat];
      return Math.max(
        0,
        ledger
          .filter((t) => fam.includes(t.cat ?? '') && isInr(t.account) && isSpend(t))
          .filter((t) => t.date >= iso(y, m, 1) && t.date <= iso(y, m, dim(y, m)))
          .reduce((s, t) => s + spendOf(t), 0)
      );
    };
    expect(progress).toHaveLength(4);
    for (const p of progress) {
      const cat = p.budget.categoryId;
      let limit = p.budget.limitAmountMinor;
      if (p.budget.rollover && cat !== subCat) {
        const carry = limits[expCats.indexOf(cat)] - spend(cat, 2024, 12);
        if (carry > 0) limit += carry;
      }
      const spent = spend(cat, 2025, 1);
      expect(p.spentMinor).toBe(spent);
      expect(p.effectiveLimitMinor).toBe(limit);
      expect(p.remainingMinor).toBe(limit - spent);
      expect(p.overBudget).toBe(spent > limit);
    }
  });
});

describe('subscriptions and period ranges', () => {
  it('totals equal the sum of parts, ignoring paused and non-expense rules', () => {
    const mk = (
      amountMinor: number,
      frequency: string,
      intervalCount: number,
      active = true,
      type = 'expense'
    ) => ({ amountMinor, frequency, intervalCount, active, type }) as any;
    const rules = [
      mk(19999, 'monthly', 1),
      mk(12345, 'weekly', 1),
      mk(99900, 'yearly', 1),
      mk(777, 'daily', 3),
      mk(500, 'monthly', 2, false),
      mk(500, 'monthly', 1, true, 'income'),
    ];
    const t = subscriptionTotals(rules);
    const parts = rules.slice(0, 4).reduce((s, r) => s + monthlyCostMinor(r), 0);
    expect(t.count).toBe(4);
    expect(t.monthlyMinor).toBe(Math.round(parts));
    expect(t.yearlyMinor).toBe(Math.round(parts * 12));
    expect(subscriptionTotals([])).toEqual({ monthlyMinor: 0, yearlyMinor: 0, count: 0 });
  });

  it('month ranges cover leap Feb and the year boundary; previous abuts current', () => {
    for (const [y, m] of MONTHS) {
      const { current, previous } = getPeriodRanges('month', new Date(y, m - 1, 17));
      expect(current).toEqual({ start: iso(y, m, 1), end: iso(y, m, dim(y, m)) });
      expect(prevDay(current.start)).toBe(previous.end);
      expect(previous.start.endsWith('-01')).toBe(true);
    }
    expect(getPeriodRanges('month', new Date(2024, 1, 29)).current.end).toBe('2024-02-29');
    expect(getPeriodRanges('year', new Date(2024, 11, 31))).toEqual({
      current: { start: '2024-01-01', end: '2024-12-31' },
      previous: { start: '2023-01-01', end: '2023-12-31' },
    });
    expect(getPeriodRanges('day', new Date(2025, 0, 1, 23, 59, 59)).previous.start).toBe('2024-12-31');
  });

  it('week ranges are 7 contiguous days containing the reference day, at first and last second', () => {
    for (let i = 0; i < 400; i++) {
      const late = i % 2 === 0;
      const ref = new Date(2023, 11, 20 + i, late ? 23 : 0, late ? 59 : 0, late ? 59 : 0);
      const { current, previous } = getPeriodRanges('week', ref);
      const d = iso(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
      expect(current.start <= d && d <= current.end).toBe(true);
      expect(prevDay(current.start)).toBe(previous.end);
      expect((Date.parse(current.end) - Date.parse(current.start)) / 86400000).toBe(6);
      // reportsCore.startOfWeek starts weeks on Sunday; pinned so a change is deliberate.
      const [y, m, dd] = current.start.split('-').map(Number);
      expect(new Date(y, m - 1, dd).getDay()).toBe(0);
    }
  });
});
