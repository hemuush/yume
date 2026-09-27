import {
  buildDueDays,
  groupDueItems,
  buildLoansSummary,
  buildDueItems,
  buildDueSoon,
  buildBudgetsSummary,
  buildPeopleState,
  buildHabitState,
  PlanLoanInput,
  PlanLoanProgressInput,
  PlanRuleInput,
} from './planOverview';

const loan = (over: Partial<PlanLoanInput> & { id: string }): PlanLoanInput => ({
  counterparty: over.id,
  direction: 'borrowed',
  status: 'active',
  principalMinor: 1000000,
  outstandingPrincipalMinor: 800000,
  ...over,
});
const prog = (over: Partial<PlanLoanProgressInput> & { loanId: string }): PlanLoanProgressInput => ({
  paidCount: 0,
  totalCount: 12,
  nextDueDate: null,
  nextEmiMinor: null,
  ...over,
});

describe('buildLoansSummary', () => {
  it('totals debt left and how much is paid off, across borrowed loans only', () => {
    const s = buildLoansSummary(
      [
        loan({ id: 'house', principalMinor: 3000000, outstandingPrincipalMinor: 2400000 }),
        loan({ id: 'car', principalMinor: 1000000, outstandingPrincipalMinor: 600000 }),
        loan({ id: 'friend', direction: 'lent', principalMinor: 50000, outstandingPrincipalMinor: 20000 }),
      ],
      []
    );
    expect(s.debtLeftMinor).toBe(3000000);
    expect(s.borrowedPrincipalMinor).toBe(4000000);
    expect(s.paidOffMinor).toBe(1000000);
    expect(s.paidFraction).toBeCloseTo(0.25);
    expect(s.borrowedCount).toBe(2);
    expect(s.lentLeftMinor).toBe(20000);
  });

  it('leaves closed loans out, but still counts a defaulted one', () => {
    const s = buildLoansSummary(
      [
        loan({ id: 'done', status: 'closed', outstandingPrincipalMinor: 0 }),
        loan({ id: 'late', status: 'defaulted', outstandingPrincipalMinor: 500000 }),
      ],
      []
    );
    expect(s.rows.map((r) => r.id)).toEqual(['late']);
    expect(s.debtLeftMinor).toBe(500000);
  });

  it('lists borrowed loans soonest EMI first, then money lent', () => {
    const s = buildLoansSummary(
      [
        loan({ id: 'lent', direction: 'lent' }),
        loan({ id: 'later' }),
        loan({ id: 'sooner' }),
        loan({ id: 'none' }),
      ],
      [
        prog({ loanId: 'later', nextDueDate: '2026-10-10', nextEmiMinor: 940000 }),
        prog({
          loanId: 'sooner',
          nextDueDate: '2026-10-05',
          nextEmiMinor: 2400000,
          paidCount: 42,
          totalCount: 240,
        }),
      ]
    );
    expect(s.rows.map((r) => r.id)).toEqual(['sooner', 'later', 'none', 'lent']);
    expect(s.rows[0]).toMatchObject({ nextEmiMinor: 2400000, paidCount: 42, totalCount: 240 });
  });

  it('is debt-free on the last EMI across borrowed loans, ignoring money lent', () => {
    const summary = buildLoansSummary(
      [loan({ id: 'house' }), loan({ id: 'car' }), loan({ id: 'lentOut', direction: 'lent' })],
      [
        prog({ loanId: 'house', lastDueDate: '2045-01-05' }),
        prog({ loanId: 'car', lastDueDate: '2029-04-07' }),
        prog({ loanId: 'lentOut', lastDueDate: '2050-01-01' }),
      ]
    );
    expect(summary.debtFreeDate).toBe('2045-01-05');
    expect(summary.rows.find((r) => r.id === 'car')?.endDate).toBe('2029-04-07');
    expect(buildLoansSummary([], []).debtFreeDate).toBeNull();
  });

  it('reads as nothing borrowed when there are no loans', () => {
    const s = buildLoansSummary([], []);
    expect(s).toMatchObject({ debtLeftMinor: 0, paidFraction: 0, borrowedCount: 0, rows: [] });
  });
});

const rule = (over: Partial<PlanRuleInput> & { id: string }): PlanRuleInput => ({
  type: 'expense',
  active: true,
  nextRunDate: '2026-10-01',
  amountMinor: 45000,
  label: over.id,
  ...over,
});

describe('buildDueItems / buildDueSoon', () => {
  const rows = buildLoansSummary(
    [loan({ id: 'house' }), loan({ id: 'lentOut', direction: 'lent' })],
    [
      prog({ loanId: 'house', nextDueDate: '2026-10-05', nextEmiMinor: 2400000 }),
      prog({ loanId: 'lentOut', nextDueDate: '2026-10-02', nextEmiMinor: 50000 }),
    ]
  ).rows;
  const items = buildDueItems(rows, [
    rule({ id: 'youtube', nextRunDate: '2026-10-01' }),
    rule({ id: 'salary', type: 'income', nextRunDate: '2026-10-01', amountMinor: 18000000 }),
    rule({ id: 'sip', type: 'transfer', nextRunDate: '2026-10-03', amountMinor: 500000 }),
    rule({ id: 'paused', active: false, nextRunDate: '2026-09-28' }),
    rule({ id: 'farAway', nextRunDate: '2026-12-01', amountMinor: 100000 }),
  ]);

  it('merges EMIs and active rules, soonest first, leaving out lent loans and paused rules', () => {
    expect(items.map((i) => [i.key, i.kind])).toEqual([
      ['rule-youtube', 'bill'],
      ['rule-salary', 'income'],
      ['rule-sip', 'transfer'],
      ['loan-house', 'emi'],
      ['rule-farAway', 'bill'],
    ]);
  });

  it('counts only EMIs and bills due in the next 14 days (today included)', () => {
    expect(buildDueSoon(items, '2026-09-26')).toEqual({
      totalMinor: 2445000,
      emiMinor: 2400000,
      billMinor: 45000,
      count: 2,
      untilDate: '2026-10-09',
    });
    // From 21 Sep, 5 Oct is the 15th day, so the EMI on it isn't counted.
    expect(buildDueSoon(items, '2026-09-21').emiMinor).toBe(0);
  });

  it('marks the 14 days of the strip, counting overdue on today', () => {
    const days = buildDueDays(items, '2026-09-26');
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ date: '2026-09-26', emi: false, bill: false });
    expect(days.find((d) => d.date === '2026-10-01')).toEqual({ date: '2026-10-01', emi: false, bill: true });
    expect(days.find((d) => d.date === '2026-10-05')).toEqual({ date: '2026-10-05', emi: true, bill: false });
    // Income and transfers aren't money going out.
    expect(days.find((d) => d.date === '2026-10-03')).toEqual({
      date: '2026-10-03',
      emi: false,
      bill: false,
    });
    const overdue = buildDueItems([], [rule({ id: 'rent', nextRunDate: '2026-09-01' })]);
    expect(buildDueDays(overdue, '2026-09-26')[0].bill).toBe(true);
  });

  it('groups Coming up by day, totalling only money going out', () => {
    const groups = groupDueItems(items, '2026-09-26');
    expect(groups.map((g) => [g.date, g.items.map((i) => i.key), g.outMinor])).toEqual([
      ['2026-10-01', ['rule-youtube', 'rule-salary'], 45000],
      ['2026-10-03', ['rule-sip'], 0],
      ['2026-10-05', ['loan-house'], 2400000],
    ]);
  });

  it('falls back to the next few items when nothing is due within 14 days', () => {
    const later = buildDueItems(
      [],
      [rule({ id: 'a', nextRunDate: '2026-11-01' }), rule({ id: 'b', nextRunDate: '2026-12-01' })]
    );
    expect(groupDueItems(later, '2026-09-26').map((g) => g.date)).toEqual(['2026-11-01', '2026-12-01']);
    expect(groupDueItems([], '2026-09-26')).toEqual([]);
  });

  it('counts something already overdue as due now', () => {
    const overdue = buildDueItems(
      [],
      [rule({ id: 'rent', nextRunDate: '2026-09-01', amountMinor: 2000000 })]
    );
    expect(buildDueSoon(overdue, '2026-09-26').billMinor).toBe(2000000);
  });
});

describe('buildBudgetsSummary', () => {
  it('totals what was used against what was budgeted, and each budget’s share', () => {
    const b = (id: string, spent: number, limit: number) => ({
      id,
      categoryName: id,
      spentMinor: spent,
      effectiveLimitMinor: limit,
      remainingMinor: limit - spent,
      percentUsed: (spent / limit) * 100,
      overBudget: spent > limit,
    });
    const s = buildBudgetsSummary([b('food', 3000, 1000), b('fuel', 1000, 2000)]);
    expect(s).toMatchObject({ usedMinor: 4000, budgetedMinor: 3000, overCount: 1, shares: [0.75, 0.25] });
  });

  it('has no shares to split when nothing was spent', () => {
    expect(
      buildBudgetsSummary([
        {
          id: 'a',
          categoryName: 'a',
          spentMinor: 0,
          effectiveLimitMinor: 100,
          remainingMinor: 100,
          percentUsed: 0,
          overBudget: false,
        },
      ]).shares
    ).toEqual([0]);
  });
});

describe('buildPeopleState', () => {
  it('distinguishes nobody, all settled, and real balances', () => {
    expect(buildPeopleState([])).toEqual({ kind: 'none' });
    expect(buildPeopleState([{ balanceMinor: 0 }])).toEqual({ kind: 'settled', count: 1 });
    expect(buildPeopleState([{ balanceMinor: 50000 }, { balanceMinor: -20000 }])).toEqual({
      kind: 'balances',
      count: 2,
      owedToYouMinor: 50000,
      youOweMinor: 20000,
    });
  });
});

describe('buildHabitState', () => {
  it('marks each day kept or missed, and takes the streak from the latest day', () => {
    expect(
      buildHabitState([
        { streakDays: 0 },
        { streakDays: 1 },
        { streakDays: 2 },
        { streakDays: 3 },
        { streakDays: 4 },
      ])
    ).toEqual({ days: [false, true, true, true, true], streakDays: 4 });
  });
});
