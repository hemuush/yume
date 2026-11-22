/** Search and list filters against a brute-force reference on seeded random data (real SQLite). */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { searchTransactions, listTransactions } from '@/db/transactionQueries';
import { parseSearchQuery } from '@/lib/searchQuery';

const TODAY = '2026-11-22';

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

interface Row {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  account: string;
  to: string | null;
  cat: string | null;
  amount: number;
  date: string;
  note: string;
  refund: number;
  createdAt: string;
}
const ACC: Record<string, { name: string; type: string }> = {
  a1: { name: 'HDFC Bank', type: 'bank' },
  a2: { name: 'Cash_Wallet', type: 'cash' },
  a3: { name: 'Zerodha', type: 'savings' },
};
const CAT: Record<string, { name: string; parent: string | null; sens: number; kind: string }> = {
  c1: { name: 'Food', parent: null, sens: 0, kind: 'expense' },
  c2: { name: 'Eating out', parent: 'c1', sens: 0, kind: 'expense' },
  c3: { name: '100% Club', parent: null, sens: 0, kind: 'expense' },
  c4: { name: 'Investments', parent: null, sens: 1, kind: 'expense' },
  c5: { name: 'My SIP', parent: 'c4', sens: 0, kind: 'expense' },
  c6: { name: 'Salary', parent: null, sens: 0, kind: 'income' },
};
const NOTES = [
  '',
  'coffee',
  'Coffee beans',
  'CAFÉ au lait',
  'café',
  'cafe',
  '50% off',
  '50 percent',
  'a_b',
  'axb',
  'back\\slash',
  'c:\\temp\\x',
  '100%',
  '%',
  '_',
  '\\',
  'it’s',
  "O'Brien",
  'naïve',
  'ÉCOLE',
  'école',
  'x%y_z',
  '50',
  '184',
  '₹184.50',
  'a, b',
  '24 sep',
];
const rows: Row[] = [];

beforeAll(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  for (const [id, a] of Object.entries(ACC))
    await mockDb.runAsync('INSERT INTO accounts (id,name,type) VALUES (?,?,?)', [id, a.name, a.type]);
  for (const id of ['c1', 'c3', 'c4', 'c6', 'c2', 'c5']) {
    const c = CAT[id];
    await mockDb.runAsync('INSERT INTO categories (id,name,kind,parent_id,is_sensitive) VALUES (?,?,?,?,?)', [
      id,
      c.name,
      c.kind,
      c.parent,
      c.sens,
    ]);
  }
  const r = rng(12345);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  for (let i = 0; i < 300; i++) {
    const type = pick(['income', 'expense', 'expense', 'transfer'] as const);
    const account = pick(Object.keys(ACC));
    let to: string | null = null;
    if (type === 'transfer') to = pick(Object.keys(ACC).filter((k) => k !== account));
    const cat =
      type === 'transfer' ? null : pick(type === 'income' ? ['c6'] : ['c1', 'c2', 'c3', 'c4', 'c5']);
    const amount =
      pick([50, 99, 100, 18350, 18449, 18450, 18451, 18400, 5000, 180700]) +
      (r() < 0.3 ? Math.floor(r() * 300) : 0);
    const day = 1 + Math.floor(r() * 365);
    const d = new Date(Date.UTC(2025, 11, 1) + day * 86400000).toISOString().slice(0, 10);
    const row: Row = {
      id: `t${i}`,
      type,
      account,
      to,
      cat,
      amount,
      date: d > TODAY ? '2026-09-24' : d,
      note: pick(NOTES),
      refund: type === 'income' && cat && CAT[cat].kind === 'expense' ? 1 : 0,
      createdAt: `2026-01-01 00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    };
    rows.push(row);
    await mockDb.runAsync(
      `INSERT INTO transactions (id,type,account_id,to_account_id,category_id,amount_minor,date,note,is_refund,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        row.id,
        row.type,
        row.account,
        row.to,
        row.cat,
        row.amount,
        row.date,
        row.note,
        row.refund,
        row.createdAt,
      ]
    );
  }
});

// SQLite LIKE folds ASCII case only; "é" and "É" are different letters to it.
const fold = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
const order = (a: Row, b: Row) =>
  a.date !== b.date
    ? a.date < b.date
      ? 1
      : -1
    : a.createdAt < b.createdAt
      ? 1
      : a.createdAt > b.createdAt
        ? -1
        : 0;

function reference(query: string, limit = 50, mask = false): string[] {
  const { date, words } = parseSearchQuery(query, TODAY);
  if (!date && words.length === 0) return [];
  return rows
    .filter((t) => {
      if (date && t.date !== date) return false;
      const c = t.cat ? CAT[t.cat] : null;
      const pc = c?.parent ? CAT[c.parent] : null;
      const names = [t.note, c?.name, pc?.name, ACC[t.account].name, t.to ? ACC[t.to].name : undefined];
      return words.every((w) => {
        if (names.some((n) => n != null && fold(n).includes(fold(w.text)))) return true;
        if (!w.amountMinor || t.amount < w.amountMinor.min || t.amount > w.amountMinor.max) return false;
        if (!mask) return true;
        if (t.type === 'transfer') return ACC[t.account].type !== 'savings' && ACC[t.to!].type !== 'savings';
        return !c || (c.sens === 0 && (!pc || pc.sens === 0));
      });
    })
    .sort(order)
    .slice(0, limit)
    .map((t) => t.id);
}
const ids = (r: { id: string }[]) => r.map((x) => x.id);

const QUERIES = [
  'coffee',
  'COFFEE',
  'Coffee',
  'cafe',
  'café',
  'CAFÉ',
  'école',
  'ÉCOLE',
  'naïve',
  'naive',
  '%',
  '_',
  '\\',
  '50%',
  '50',
  '100%',
  'a_b',
  'a%b',
  'back\\slash',
  '\\slash',
  'c:\\temp',
  'x%y_z',
  '%_',
  '\\%',
  '184',
  '184.50',
  '184.5',
  '183.5',
  '183',
  '185',
  '1,807',
  '₹184',
  '₹184.50',
  '0.99',
  '99',
  '1',
  '24 sep',
  '24/9',
  'sep 24',
  'food',
  'eating',
  'eating out',
  'food coffee',
  'hdfc',
  'cash_wallet',
  'cash wallet',
  'cash_',
  'zerodha',
  'bank 184',
  'sip',
  'invest',
  'it’s',
  "o'brien",
  'o’brien',
  '"',
  '(',
  '[',
  '.*',
  '^',
  '$',
  "'; DROP TABLE transactions;--",
  'a, b',
  'a,',
  '',
  '   ',
  'zzzz-no-match',
  '😀',
];

describe('searchTransactions vs brute force', () => {
  it.each(QUERIES)('query %j', async (q) => {
    expect(ids(await searchTransactions(q, 1000, TODAY))).toEqual(reference(q, 1000));
  });
  it.each(QUERIES.filter((q) => /\d/.test(q)))('masked amounts, query %j', async (q) => {
    expect(ids(await searchTransactions(q, 1000, TODAY, true))).toEqual(reference(q, 1000, true));
  });
  it('seeded random multi-word queries', async () => {
    const r = rng(777);
    const parts = [
      'coffee',
      'food',
      '50%',
      '_',
      '184',
      '184.50',
      'hdfc',
      'a_b',
      'cafe',
      '99',
      '100',
      'sip',
      '₹183.99',
      '5',
    ];
    for (let i = 0; i < 80; i++) {
      const q = Array.from(
        { length: 1 + Math.floor(r() * 3) },
        () => parts[Math.floor(r() * parts.length)]
      ).join(' ');
      expect({ q, got: ids(await searchTransactions(q, 1000, TODAY)) }).toEqual({
        q,
        got: reference(q, 1000),
      });
    }
  });
  it('literal wildcards do not over-match', async () => {
    const noteOnly = (await searchTransactions('50%', 1000, TODAY)).filter((t) => t.note === '50 percent');
    expect(noteOnly).toHaveLength(0);
    expect((await searchTransactions('a_b', 1000, TODAY)).some((t) => t.note === 'axb')).toBe(false);
  });
  it('is ASCII case-insensitive and accent-sensitive', async () => {
    expect(ids(await searchTransactions('COFFEE', 1000, TODAY))).toEqual(
      ids(await searchTransactions('coffee', 1000, TODAY))
    );
    expect(rows.some((r) => r.note === 'cafe')).toBe(true);
    expect((await searchTransactions('café', 1000, TODAY)).filter((t) => t.note === 'cafe')).toHaveLength(0);
  });
  it('paise amounts are exact, whole amounts cover the rounded rupee', async () => {
    const exact = await searchTransactions('184.50', 1000, TODAY);
    for (const t of exact) expect(t.amountMinor === 18450 || /184\.50/.test(t.note)).toBe(true);
    const whole = await searchTransactions('184', 1000, TODAY);
    const amounts = new Set(whole.filter((t) => !/184/.test(t.note)).map((t) => t.amountMinor));
    for (const a of amounts) expect(a >= 18350 && a <= 18449).toBe(true);
    expect(amounts.has(18450)).toBe(false);
  });
});

describe('limits', () => {
  it.each([1, 2, 7, 50, 1000])('limit %i returns the newest prefix', async (n) => {
    expect(ids(await searchTransactions('food', n, TODAY))).toEqual(reference('food', 1000).slice(0, n));
  });
  it.each([0, -3, NaN, Infinity])('odd limit %p falls back to 50', async (n) => {
    expect(ids(await searchTransactions('food', n, TODAY))).toEqual(reference('food', 50));
  });
  it('a fractional limit is floored', async () => {
    expect(await searchTransactions('food', 2.9, TODAY)).toHaveLength(2);
  });
});

describe('listTransactions filter combinations vs brute force', () => {
  type F = NonNullable<Parameters<typeof listTransactions>[0]>;
  const ref = (f: F) =>
    rows
      .filter((t) => {
        if (f.accountId && t.account !== f.accountId && t.to !== f.accountId) return false;
        if (f.categoryId) {
          const kids = Object.keys(CAT).filter((k) => CAT[k].parent === f.categoryId);
          if (!(t.cat === f.categoryId || (f.includeSubcategories && t.cat && kids.includes(t.cat))))
            return false;
        }
        if (f.fromDate && t.date < f.fromDate) return false;
        if (f.toDate && t.date > f.toDate) return false;
        if (f.spendingOnly && !(t.type === 'expense' || (t.type === 'income' && t.refund === 1)))
          return false;
        return true;
      })
      .map((t) => t.id);
  it('random filter combinations', async () => {
    const r = rng(99);
    const sorted = (a: string[]) => [...a].sort();
    for (let i = 0; i < 120; i++) {
      const f: F = {};
      if (r() < 0.5) f.accountId = ['a1', 'a2', 'a3'][Math.floor(r() * 3)];
      if (r() < 0.5) f.categoryId = ['c1', 'c2', 'c3', 'c4', 'c6'][Math.floor(r() * 5)];
      if (f.categoryId && r() < 0.5) f.includeSubcategories = true;
      if (r() < 0.5) f.fromDate = ['2026-01-01', '2026-06-15', '2026-09-24'][Math.floor(r() * 3)];
      if (r() < 0.5) f.toDate = ['2026-03-01', '2026-09-24', '2026-11-22'][Math.floor(r() * 3)];
      if (r() < 0.4) f.spendingOnly = true;
      const got = await listTransactions(f);
      expect({ f, ids: sorted(ids(got)) }).toEqual({ f, ids: sorted(ref(f)) });
      for (let k = 1; k < got.length; k++) expect(got[k - 1].date >= got[k].date).toBe(true);
    }
  });
  it('limit applies after the filter', async () => {
    const all = await listTransactions({ spendingOnly: true });
    expect(ids(await listTransactions({ spendingOnly: true, limit: 5 }))).toEqual(ids(all).slice(0, 5));
    expect(await listTransactions({ limit: NaN })).toHaveLength(rows.length);
    expect(await listTransactions({ limit: 0 })).toHaveLength(rows.length);
    expect(await listTransactions({ limit: 2.7 })).toHaveLength(2);
  });
  it('currency filter', async () => {
    expect(await listTransactions({ currency: 'USD' })).toHaveLength(0);
    expect(await listTransactions({ currency: 'INR' })).toHaveLength(rows.length);
  });
  it('an account filter includes the transfer destination', async () => {
    const got = await listTransactions({ accountId: 'a3' });
    expect(got.some((t) => t.type === 'transfer' && t.toAccountId === 'a3')).toBe(true);
  });
});
