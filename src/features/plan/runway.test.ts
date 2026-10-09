import { buildRunway, runwayStartMinor } from './runway';
import type { PlanDueItem } from './planOverview';
import type { Account } from '@/types';

const item = (date: string, kind: PlanDueItem['kind'], amountMinor: number, title = kind): PlanDueItem => ({
  key: `${kind}-${date}-${title}`,
  title,
  kind,
  dueDate: date,
  amountMinor,
  route: '/recurring',
});

const account = (over: Partial<Account>): Account => ({
  id: 'a',
  name: 'A',
  type: 'bank',
  currency: 'INR',
  openingBalanceMinor: 0,
  currentBalanceMinor: 0,
  creditLimitMinor: null,
  statementDay: null,
  dueDay: null,
  interestRateAnnualBp: null,
  archived: false,
  createdAt: '2026-01-01',
  ...over,
});

describe('runwayStartMinor', () => {
  it('adds bank, cash and wallets in the default currency only', () => {
    expect(
      runwayStartMinor(
        [
          account({ id: 'b', currentBalanceMinor: 100000 }),
          account({ id: 'c', type: 'cash', currentBalanceMinor: 5000 }),
          account({ id: 'w', type: 'wallet', currentBalanceMinor: 2000 }),
          account({ id: 's', type: 'savings', currentBalanceMinor: 900000 }),
          account({ id: 'cc', type: 'credit_card', currentBalanceMinor: -40000 }),
          account({ id: 'usd', currency: 'USD', currentBalanceMinor: 70000 }),
          account({ id: 'old', archived: true, currentBalanceMinor: 30000 }),
        ],
        'INR'
      )
    ).toBe(107000);
  });
});

describe('buildRunway', () => {
  it('steps the balance down for bills and EMIs and up for income, day by day', () => {
    const r = buildRunway(
      100000,
      [
        item('2026-10-10', 'emi', 30000),
        item('2026-10-12', 'income', 20000),
        item('2026-10-12', 'bill', 5000),
        item('2026-10-13', 'transfer', 99999),
      ],
      '2026-10-09',
      5
    );
    expect(r.days.map((d) => d.afterMinor)).toEqual([100000, 70000, 70000, 85000, 85000]);
    expect(r.days[3]).toMatchObject({ beforeMinor: 70000, outMinor: 5000, inMinor: 20000 });
    expect(r.endMinor).toBe(85000);
    expect(r.lowMinor).toBe(70000);
    expect(r.lowDate).toBe('2026-10-10');
    expect(r.inMinor).toBe(20000);
    expect(r.short).toBeNull();
  });

  it('counts anything overdue on today', () => {
    const r = buildRunway(10000, [item('2026-10-01', 'bill', 4000)], '2026-10-09', 2);
    expect(r.days[0].items).toHaveLength(1);
    expect(r.days[0].afterMinor).toBe(6000);
  });

  it('says on which day the accounts run short, and by how much', () => {
    const r = buildRunway(
      10000,
      [item('2026-10-10', 'emi', 8000), item('2026-10-11', 'bill', 5000), item('2026-10-12', 'bill', 1000)],
      '2026-10-09',
      4
    );
    expect(r.short).toEqual({ date: '2026-10-11', minor: 3000 });
    expect(r.lowMinor).toBe(-4000);
  });
});
