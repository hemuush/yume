import { buildNeedsYouItems, splitDismissed, NeedsYouInput, BACKUP_NUDGE_MIN_TRANSACTIONS } from './needsYou';

const base = (over: Partial<NeedsYouInput> = {}): NeedsYouInput => ({
  nextDue: null,
  budgets: [],
  backup: { folderUri: 'content://folder', lastResult: { ok: true }, snoozedUntil: null },
  transactionCount: 50,
  today: '2026-09-25',
  now: new Date(2026, 8, 25, 12),
  ...over,
});

const emi = (dueDate: string) => ({ counterparty: 'Home loan', dueDate, emiAmountMinor: 987000 });
const budget = (id: string, pct: number) => ({
  budget: { id },
  categoryName: id,
  percentUsed: pct,
  overBudget: pct > 100,
});

describe('buildNeedsYouItems', () => {
  it('is empty when nothing needs the user', () => {
    expect(buildNeedsYouItems(base())).toEqual([]);
  });

  it('points a charge that looks monthly at Recurring, once per category', () => {
    const items = buildNeedsYouItems(
      base({ monthlyPatterns: [{ key: 'sub-wifi', categoryName: 'Wifi', amountMinor: 64900 }] })
    );
    expect(items).toEqual([
      {
        key: 'looks-monthly-sub-wifi',
        tone: 'info',
        title: 'Wifi looks monthly',
        detail: 'Set it up once in Recurring',
        amountMinor: 64900,
        action: 'recurring',
      },
    ]);
  });

  it('shows an EMI due today or overdue as urgent', () => {
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-25') }))[0]).toMatchObject({
      key: 'emi-2026-09-25-due',
      tone: 'urgent',
      detail: 'Due today',
      amountMinor: 987000,
      action: 'loans',
    });
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-24') }))[0].detail).toBe('Overdue by 1 day');
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-20') }))[0].detail).toBe('Overdue by 5 days');
  });

  it('warns about an EMI in the next three days, gives a heads-up within two weeks, and ignores later ones', () => {
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-26') }))[0]).toMatchObject({
      key: 'emi-2026-09-26-soon',
      tone: 'warn',
      detail: 'Due tomorrow',
    });
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-10-04') }))[0]).toMatchObject({
      key: 'emi-2026-10-04-upcoming',
      tone: 'info',
      detail: 'Due in 9 days',
    });
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-10-10') }))).toEqual([]);
  });

  it('counts days by calendar date across a month boundary', () => {
    const items = buildNeedsYouItems(base({ today: '2026-10-01', nextDue: emi('2026-09-30') }));
    expect(items[0].detail).toBe('Overdue by 1 day');
  });

  it('flags budgets at 90% or more, fullest first, and says when one is over', () => {
    const items = buildNeedsYouItems(
      base({ budgets: [budget('Food', 92.4), budget('Fuel', 40), budget('Shopping', 130)] })
    );
    expect(items.map((i) => [i.title, i.detail])).toEqual([
      ['Shopping budget', 'Over its limit'],
      ['Food budget', '92% used'],
    ]);
    expect(buildNeedsYouItems(base({ budgets: [budget('Food', 89.9)] }))).toEqual([]);
  });

  it('flags a failed backup, but not a working one', () => {
    const failed = base({
      backup: { folderUri: 'content://f', lastResult: { ok: false }, snoozedUntil: null },
    });
    expect(buildNeedsYouItems(failed)[0]).toMatchObject({ key: 'backup-failed', tone: 'urgent' });
    expect(buildNeedsYouItems(base())).toEqual([]);
  });

  it('reminds about backups only once there is data worth losing, and respects a snooze', () => {
    const none = (count: number, snoozedUntil: string | null = null) =>
      base({ transactionCount: count, backup: { folderUri: null, lastResult: null, snoozedUntil } });
    expect(buildNeedsYouItems(none(BACKUP_NUDGE_MIN_TRANSACTIONS - 1))).toEqual([]);
    expect(buildNeedsYouItems(none(BACKUP_NUDGE_MIN_TRANSACTIONS))[0]).toMatchObject({
      key: 'backup-none',
      snoozable: true,
    });
    expect(buildNeedsYouItems(none(50, new Date(2026, 9, 25).toISOString()))).toEqual([]); // snoozed a month
    expect(buildNeedsYouItems(none(50, new Date(2026, 8, 1).toISOString()))).toHaveLength(1); // snooze over
  });

  it('orders urgent before warnings before info', () => {
    const items = buildNeedsYouItems(
      base({
        nextDue: emi('2026-09-25'),
        budgets: [budget('Food', 95), budget('Fuel', 99)],
        backup: { folderUri: 'content://f', lastResult: { ok: false }, snoozedUntil: null },
      })
    );
    expect(items.map((i) => i.key)).toEqual([
      'emi-2026-09-25-due',
      'backup-failed',
      'budget-Fuel-near',
      'budget-Food-near',
    ]);
  });

  it('flags a budget running well ahead of the even-spending pace', () => {
    // 60% gone by the 10th, when even spending would be at a third.
    const [item] = buildNeedsYouItems(base({ today: '2026-09-10', budgets: [budget('Fuel', 60)] }));
    expect(item).toMatchObject({ key: 'budget-Fuel-ahead', detail: '60% used · ahead of pace' });
    expect(buildNeedsYouItems(base({ today: '2026-09-25', budgets: [budget('Fuel', 60)] }))).toEqual([]);
  });

  it('points to Tidy up and to a category well up on last month', () => {
    const items = buildNeedsYouItems(
      base({ tidyCount: 9, growing: { categoryId: 'food', name: 'Food', pctChange: 331.4 } })
    );
    expect(items.map((i) => [i.key, i.title, i.detail, i.action])).toEqual([
      ['tidy-9', 'Tidy up', '9 things to check', 'tidy'],
      ['grow-food-2026-09', 'Food is up 331%', 'Against last month so far', 'reports'],
    ]);
  });

  it('keys each item by its situation, so a dismissed one returns when things change', () => {
    const near = buildNeedsYouItems(base({ budgets: [budget('Food', 95)] }));
    const over = buildNeedsYouItems(base({ budgets: [budget('Food', 120)] }));
    expect(splitDismissed(near, [near[0].key]).shown).toEqual([]);
    expect(splitDismissed(over, [near[0].key]).shown).toHaveLength(1);
  });
});

describe('splitDismissed', () => {
  it('separates dismissed items from the ones still showing', () => {
    const items = buildNeedsYouItems(base({ tidyCount: 2, budgets: [budget('Food', 95)] }));
    const { shown, dismissed } = splitDismissed(items, ['tidy-2']);
    expect(shown.map((i) => i.key)).toEqual(['budget-Food-near']);
    expect(dismissed.map((i) => i.key)).toEqual(['tidy-2']);
  });
});
