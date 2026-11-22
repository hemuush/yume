/**
 * Hard recurring-rule scheduling on real SQLite: month-end clamping, long offline catch-up, idempotence,
 * pauses, end dates, all frequencies. Posting works on date strings, so the process zone must not matter;
 * the zone is switched per test and restored afterwards.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listTransactions } from '@/db/ledger';
import {
  createRecurringRule,
  listRecurringRules,
  setRecurringRuleActive,
  runDueRecurringRules,
} from '@/db/recurring';
import type { RecurrenceFrequency } from '@/types';

describe('recurring rules, hard time cases', () => {
  const originalTz = process.env.TZ;
  let accountId: string;
  let categoryId: string;
  let seq = 0;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 100000000 })
    ).id;
    categoryId = (await createCategory({ name: 'Bills', kind: 'expense' })).id;
  });
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  async function make(
    nextRunDate: string,
    frequency: RecurrenceFrequency,
    extra: { intervalCount?: number; endDate?: string | null } = {}
  ) {
    const note = `hard-${++seq}`;
    const rule = await createRecurringRule({
      type: 'expense',
      accountId,
      categoryId,
      amountMinor: 1000,
      note,
      frequency,
      intervalCount: extra.intervalCount ?? 1,
      nextRunDate,
      endDate: extra.endDate ?? null,
    });
    return { rule, note };
  }
  const datesOf = async (note: string) =>
    (await listTransactions({ limit: 100000 }))
      .filter((t) => t.note === note)
      .map((t) => t.date)
      .sort();
  const ruleOf = async (id: string) => (await listRecurringRules()).find((r) => r.id === id)!;

  it.each(['America/New_York', 'Asia/Kolkata', 'Pacific/Auckland', 'Europe/London'])(
    'a 31st monthly rule posts the clamped month ends through leap and century years (%s)',
    async (zone) => {
      process.env.TZ = zone;
      const { rule, note } = await make('2027-12-31', 'monthly');
      expect(await runDueRecurringRules('2028-06-30')).toBeGreaterThanOrEqual(7);
      expect(await datesOf(note)).toEqual([
        '2027-12-31',
        '2028-01-31',
        '2028-02-29',
        '2028-03-31',
        '2028-04-30',
        '2028-05-31',
        '2028-06-30',
      ]);
      expect((await ruleOf(rule.id)).nextRunDate).toBe('2028-07-31');
    }
  );

  it('2100 is not a leap year: a 29th/30th/31st rule lands on Feb 28', async () => {
    for (const day of ['29', '30', '31']) {
      const { note } = await make(`2100-01-${day}`, 'monthly');
      await runDueRecurringRules('2100-03-31');
      const dates = await datesOf(note);
      expect(dates[1]).toBe('2100-02-28');
      expect(dates[2]).toBe(`2100-03-${day}`);
    }
  });

  it('a Feb 29 yearly rule runs on Feb 28 in non-leap years and returns to the 29th in 2028', async () => {
    const { note } = await make('2024-02-29', 'yearly');
    await runDueRecurringRules('2028-03-01');
    expect(await datesOf(note)).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('a year of offline weeks posts every occurrence exactly once, and a rerun posts none', async () => {
    const { rule, note } = await make('2030-01-02', 'weekly');
    await runDueRecurringRules('2030-12-31');
    const dates = await datesOf(note);
    expect(dates).toHaveLength(52);
    expect(new Set(dates).size).toBe(52);
    expect(dates[51]).toBe('2030-12-25');
    expect((await ruleOf(rule.id)).nextRunDate).toBe('2031-01-01');
    expect(await runDueRecurringRules('2030-12-31')).toBe(0);
    expect(await datesOf(note)).toHaveLength(52);
    // Going back in time (clock change) does not re-post or undo.
    expect(await runDueRecurringRules('2030-06-01')).toBe(0);
  });

  it('biweekly steps 14 days across the year boundary', async () => {
    const { note } = await make('2031-12-17', 'weekly', { intervalCount: 2 });
    await runDueRecurringRules('2032-02-01');
    expect(await datesOf(note)).toEqual(['2031-12-17', '2031-12-31', '2032-01-14', '2032-01-28']);
  });

  it('a rule starting in the past catches up from its start date; a future rule posts nothing', async () => {
    const past = await make('2032-03-15', 'monthly');
    const future = await make('2033-01-01', 'monthly');
    await runDueRecurringRules('2032-06-14');
    expect(await datesOf(past.note)).toEqual(['2032-03-15', '2032-04-15', '2032-05-15']);
    expect(await datesOf(future.note)).toEqual([]);
    expect((await ruleOf(future.rule.id)).nextRunDate).toBe('2033-01-01');
  });

  it('a paused rule posts nothing while paused; after resuming it catches up without double posting', async () => {
    const { rule, note } = await make('2034-01-10', 'monthly');
    await runDueRecurringRules('2034-01-10');
    expect(await datesOf(note)).toEqual(['2034-01-10']);
    await setRecurringRuleActive(rule.id, false);
    await runDueRecurringRules('2034-05-10');
    expect(await datesOf(note)).toEqual(['2034-01-10']);
    await setRecurringRuleActive(rule.id, true);
    await runDueRecurringRules('2034-05-10');
    const dates = await datesOf(note);
    expect(dates).toEqual(['2034-01-10', '2034-02-10', '2034-03-10', '2034-04-10', '2034-05-10']);
    expect((await ruleOf(rule.id)).nextRunDate).toBe('2034-06-10');
  });

  it('end date: last occurrence on the end date still posts, then the rule deactivates', async () => {
    const onEnd = await make('2035-01-31', 'monthly', { endDate: '2035-03-31' });
    await runDueRecurringRules('2036-01-01');
    expect(await datesOf(onEnd.note)).toEqual(['2035-01-31', '2035-02-28', '2035-03-31']);
    expect((await ruleOf(onEnd.rule.id)).active).toBe(false);

    const before = await make('2035-01-31', 'monthly', { endDate: '2035-03-30' });
    await runDueRecurringRules('2036-01-01');
    expect(await datesOf(before.note)).toEqual(['2035-01-31', '2035-02-28']);
    expect((await ruleOf(before.rule.id)).active).toBe(false);

    const single = await make('2037-05-05', 'daily', { endDate: '2037-05-05' });
    await runDueRecurringRules('2037-05-20');
    expect(await datesOf(single.note)).toEqual(['2037-05-05']);
    expect((await ruleOf(single.rule.id)).active).toBe(false);
  });

  it('a run stopping the day before an occurrence leaves it pending, and the next day posts it once', async () => {
    const { rule, note } = await make('2038-02-28', 'monthly');
    await runDueRecurringRules('2038-02-27');
    expect(await datesOf(note)).toEqual([]);
    await runDueRecurringRules('2038-02-28');
    await runDueRecurringRules('2038-02-28');
    expect(await datesOf(note)).toEqual(['2038-02-28']);
    expect((await ruleOf(rule.id)).nextRunDate).toBe('2038-03-28');
  });

  it('concurrent runs share one pass and post each occurrence once', async () => {
    const { note } = await make('2039-01-01', 'daily');
    const [a, b] = await Promise.all([
      runDueRecurringRules('2039-01-10'),
      runDueRecurringRules('2039-01-10'),
    ]);
    expect(a).toBe(b);
    expect(await datesOf(note)).toHaveLength(10);
  });
});
