import { buildNeedsYouItems, NeedsYouInput, BACKUP_NUDGE_MIN_TRANSACTIONS } from './needsYou';

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

  it('shows an EMI due today or overdue, but not one still ahead', () => {
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-25') }))[0]).toMatchObject({
      key: 'emi',
      tone: 'urgent',
      detail: 'Due today',
      amountMinor: 987000,
      action: 'loans',
    });
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-24') }))[0].detail).toBe('Overdue by 1 day');
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-20') }))[0].detail).toBe('Overdue by 5 days');
    expect(buildNeedsYouItems(base({ nextDue: emi('2026-09-26') }))).toEqual([]);
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

  it('orders urgent before warnings before info, and caps at three', () => {
    const items = buildNeedsYouItems(
      base({
        nextDue: emi('2026-09-25'),
        budgets: [budget('Food', 95), budget('Fuel', 99)],
        backup: { folderUri: 'content://f', lastResult: { ok: false }, snoozedUntil: null },
      })
    );
    expect(items.map((i) => i.key)).toEqual(['emi', 'backup-failed', 'budget-Fuel']);
  });
});
