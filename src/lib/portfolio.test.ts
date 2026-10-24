import type { Account, RecurringRule } from '@/types';
import {
  annualisedReturn,
  buildPortfolio,
  buildSeries,
  monthlyEquivalent,
  monthlySipTotal,
  seriesSince,
  sipsOf,
  splitOf,
  xirr,
} from './portfolio';

const TODAY = '2026-10-24';
function inv(
  over: Partial<Account> & { id: string },
  investment: Partial<NonNullable<Account['investment']>> = {}
): Account {
  return {
    name: over.id,
    type: 'savings',
    currency: 'INR',
    openingBalanceMinor: 0,
    currentBalanceMinor: 0,
    creditLimitMinor: null,
    statementDay: null,
    dueDay: null,
    interestRateAnnualBp: null,
    archived: false,
    createdAt: '2025-01-01 10:00:00',
    investment: {
      investedMinor: 0,
      takenOutMinor: 0,
      gainMinor: null,
      valuedAt: null,
      lastValueMinor: null,
      kind: null,
      fundingAccountId: null,
      ...investment,
    },
    ...over,
  } as Account;
}
const bank = {
  id: 'bank',
  name: 'HDFC',
  type: 'bank',
  currency: 'INR',
  investment: undefined,
} as unknown as Account;

const fund = inv(
  { id: 'fund', name: 'Nifty 50', currentBalanceMinor: 438_000_00, openingBalanceMinor: 300_000_00 },
  { investedMinor: 400_000_00, gainMinor: 38_000_00, valuedAt: '2026-10-20', kind: 'mutual_fund' }
);
const gold = inv(
  { id: 'gold', name: 'Gold', currentBalanceMinor: 100_000_00, openingBalanceMinor: 100_000_00 },
  { investedMinor: 100_000_00, kind: 'gold' }
);

describe('buildPortfolio', () => {
  it('adds the holdings up, taking gain and return from the valued ones only', () => {
    const p = buildPortfolio([bank, fund, gold], 'INR', TODAY);
    expect(p.holdings.map((h) => h.id)).toEqual(['fund', 'gold']);
    expect(p.valueMinor).toBe(538_000_00);
    expect(p.investedMinor).toBe(500_000_00);
    expect(p.gainMinor).toBe(38_000_00);
    expect(p.returnPct).toBeCloseTo(9.5); // 38,000 on the 4,00,000 that has a value, not on all 5,00,000
    expect(p.unvaluedCount).toBe(1);
  });

  it('has no gain at all before any value update', () => {
    const p = buildPortfolio([gold], 'INR', TODAY);
    expect(p.gainMinor).toBeNull();
    expect(p.returnPct).toBeNull();
  });

  it('keeps other currencies and archived holdings out of the totals', () => {
    const usd = inv({ id: 'us', currency: 'USD', currentBalanceMinor: 999_00 });
    const old = inv({ id: 'old', archived: true, currentBalanceMinor: 5_00 });
    const p = buildPortfolio([fund, usd, old], 'INR', TODAY);
    expect(p.valueMinor).toBe(438_000_00);
    expect(p.otherCurrency.map((h) => h.id)).toEqual(['us']);
    expect(p.holdings.map((h) => h.id)).toEqual(['fund']);
  });

  it('flags a value that is more than 35 days old', () => {
    const stale = inv({ id: 's' }, { gainMinor: 0, valuedAt: '2026-08-01' });
    expect(buildPortfolio([stale], 'INR', TODAY).holdings[0]).toMatchObject({ stale: true, ageDays: 84 });
  });
});

describe('splitOf', () => {
  it('splits worth by kind, largest first, shares adding to one', () => {
    const parts = splitOf(buildPortfolio([fund, gold], 'INR', TODAY).holdings);
    expect(parts.map((p) => p.label)).toEqual(['Mutual fund', 'Gold']);
    expect(parts.reduce((s, p) => s + p.share, 0)).toBeCloseTo(1);
  });
  it('splits by holding when no kind is set', () => {
    const a = inv({ id: 'a', name: 'A', currentBalanceMinor: 100 });
    const b = inv({ id: 'b', name: 'B', currentBalanceMinor: 300 });
    expect(splitOf(buildPortfolio([a, b], 'INR', TODAY).holdings).map((p) => p.label)).toEqual(['B', 'A']);
  });
  it('names holdings without a kind "Not set" once others have one, and skips empty ones', () => {
    const none = inv({ id: 'n', currentBalanceMinor: 50_000_00 });
    const zero = inv({ id: 'z', currentBalanceMinor: 0 }, { kind: 'stocks' });
    const parts = splitOf(buildPortfolio([fund, none, zero], 'INR', TODAY).holdings);
    expect(parts.map((p) => p.label)).toEqual(['Mutual fund', 'Not set']);
  });
  it('is empty with nothing worth anything', () => {
    expect(splitOf([])).toEqual([]);
  });
});

describe('xirr', () => {
  it('finds exactly 10% when 1,000 becomes 1,210 over two years', () => {
    const r = xirr([
      { date: '2025-01-01', amountMinor: -1000 },
      { date: '2027-01-01', amountMinor: 1210 },
    ]);
    expect(r).toBeCloseTo(0.1, 5);
  });
  it('handles money put in along the way', () => {
    // 1,000 now and 1,000 a year on, worth 2,310 two years in: 10% a year.
    const r = xirr([
      { date: '2025-01-01', amountMinor: -1000 },
      { date: '2026-01-01', amountMinor: -1000 },
      { date: '2027-01-01', amountMinor: 2310 },
    ]);
    expect(r).toBeCloseTo(0.1, 5);
  });
  it('is negative for a loss', () => {
    expect(
      xirr([
        { date: '2025-01-01', amountMinor: -1000 },
        { date: '2026-01-01', amountMinor: 900 },
      ])
    ).toBeCloseTo(-0.1, 5);
  });
  it('has nothing to solve without both money in and money out', () => {
    expect(xirr([{ date: '2025-01-01', amountMinor: -1000 }])).toBeNull();
    expect(
      xirr([
        { date: '2025-01-01', amountMinor: -1000 },
        { date: '2026-01-01', amountMinor: -50 },
      ])
    ).toBeNull();
  });
});

describe('annualisedReturn', () => {
  const portfolio = (accounts: Account[]) => buildPortfolio(accounts, 'INR', TODAY);
  it('is a yearly rate from the opening amount, the transfers in and today’s value', () => {
    const a = inv(
      {
        id: 'a',
        createdAt: '2025-10-24 09:00:00',
        openingBalanceMinor: 1000_00,
        currentBalanceMinor: 1100_00,
      },
      { investedMinor: 1000_00, gainMinor: 100_00, valuedAt: '2026-10-20' }
    );
    const r = annualisedReturn(portfolio([a]), [], TODAY)!;
    expect(r.rate).toBeCloseTo(0.1, 3);
    expect(r.days).toBe(365);
  });
  it('counts a transfer in at its own date', () => {
    const a = inv(
      {
        id: 'a',
        createdAt: '2025-10-24 09:00:00',
        openingBalanceMinor: 1000_00,
        currentBalanceMinor: 2200_00,
      },
      { investedMinor: 2000_00, gainMinor: 200_00, valuedAt: '2026-10-20' }
    );
    const r = annualisedReturn(
      portfolio([a]),
      [{ accountId: 'a', date: '2026-04-24', amountMinor: 1000_00 }],
      TODAY
    )!;
    expect(r.rate).toBeGreaterThan(0.1);
    expect(r.rate).toBeLessThan(0.3);
  });
  it('waits for three months of history and for a value update', () => {
    const young = inv(
      {
        id: 'y',
        createdAt: '2026-09-24 09:00:00',
        openingBalanceMinor: 1000_00,
        currentBalanceMinor: 1100_00,
      },
      { gainMinor: 100_00, valuedAt: '2026-10-20' }
    );
    expect(annualisedReturn(portfolio([young]), [], TODAY)).toBeNull();
    const unvalued = inv({
      id: 'u',
      createdAt: '2024-01-01 09:00:00',
      openingBalanceMinor: 1000_00,
      currentBalanceMinor: 1000_00,
    });
    expect(annualisedReturn(portfolio([unvalued]), [], TODAY)).toBeNull();
  });
});

describe('buildSeries', () => {
  const a = inv({
    id: 'a',
    createdAt: '2026-01-01 00:00:00',
    openingBalanceMinor: 1000_00,
    currentBalanceMinor: 1500_00,
  });
  const p = buildPortfolio([a], 'INR', TODAY);
  const history = {
    flows: [
      { accountId: 'a', date: '2026-03-01', amountMinor: 200_00 },
      { accountId: 'a', date: '2026-08-01', amountMinor: 100_00 },
    ],
    valuations: [{ accountId: 'a', date: '2026-06-01', valueMinor: 1500_00 }],
  };
  it('puts a point at each value update and at today', () => {
    expect(buildSeries(p, history, TODAY).map((x) => x.date)).toEqual(['2026-06-01', TODAY]);
  });
  it('is the update’s value then what moved since, against what was put in', () => {
    const [first, last] = buildSeries(p, history, TODAY);
    expect(first).toMatchObject({ valueMinor: 1500_00, putInMinor: 1200_00 });
    expect(last).toMatchObject({ valueMinor: 1600_00, putInMinor: 1300_00 });
  });
  it('treats a holding with no update as worth what was put in', () => {
    const none = buildPortfolio(
      [
        inv({
          id: 'b',
          createdAt: '2026-01-01 00:00:00',
          openingBalanceMinor: 500_00,
          currentBalanceMinor: 500_00,
        }),
      ],
      'INR',
      TODAY
    );
    expect(buildSeries(none, { flows: [], valuations: [] }, TODAY)).toEqual([
      { date: TODAY, valueMinor: 500_00, putInMinor: 500_00 },
    ]);
  });
  it('keeps one point before the window so the line starts at its edge', () => {
    const series = [
      { date: '2025-01-01', valueMinor: 1, putInMinor: 1 },
      { date: '2026-06-01', valueMinor: 2, putInMinor: 2 },
      { date: TODAY, valueMinor: 3, putInMinor: 3 },
    ];
    expect(seriesSince(series, 6, TODAY).map((x) => x.date)).toEqual(['2025-01-01', '2026-06-01', TODAY]);
    expect(seriesSince(series, 3, TODAY).map((x) => x.date)).toEqual(['2026-06-01', TODAY]);
    expect(seriesSince(series, null, TODAY)).toBe(series);
  });
});

describe('SIPs', () => {
  const rule = (over: Partial<RecurringRule>): RecurringRule =>
    ({
      id: 'r',
      type: 'transfer',
      accountId: 'bank',
      toAccountId: 'fund',
      categoryId: null,
      amountMinor: 10_000_00,
      note: '',
      paymentMode: null,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-11-05',
      endDate: null,
      active: true,
      ...over,
    }) as RecurringRule;
  const accounts = [bank, fund, gold];
  it('are recurring transfers into an investment from a plain account', () => {
    const sips = sipsOf(
      [
        rule({ id: 'sip' }),
        rule({ id: 'paused', active: false, toAccountId: 'gold' }),
        rule({ id: 'plain', toAccountId: 'cash' }),
        rule({ id: 'move', accountId: 'gold', toAccountId: 'fund' }),
        rule({ id: 'expense', type: 'expense' }),
      ],
      accounts
    );
    expect(sips.map((s) => s.rule.id)).toEqual(['sip', 'paused']);
    expect(sips[0]).toMatchObject({ holdingName: 'Nifty 50', fromName: 'HDFC', monthlyMinor: 10_000_00 });
  });
  it('turn weekly, yearly and every-other-month rules into a month', () => {
    expect(monthlyEquivalent(rule({ frequency: 'weekly', amountMinor: 1200 }))).toBe(5200);
    expect(monthlyEquivalent(rule({ frequency: 'yearly', amountMinor: 12000 }))).toBe(1000);
    expect(monthlyEquivalent(rule({ intervalCount: 2, amountMinor: 1000 }))).toBe(500);
  });
  it('add up the active ones in the default currency', () => {
    const usd = inv({ id: 'us', currency: 'USD' });
    const sips = sipsOf(
      [
        rule({ id: 'a' }),
        rule({ id: 'b', amountMinor: 2_000_00 }),
        rule({ id: 'c', active: false }),
        rule({ id: 'd', toAccountId: 'us' }),
      ],
      [...accounts, usd]
    );
    expect(monthlySipTotal(sips, [...accounts, usd], 'INR')).toBe(12_000_00);
  });
});
