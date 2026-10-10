/**
 * The This Month widget follows Home's month card: while "hide savings & investment amounts" is on, nothing
 * about savings reaches the widget (no figure, no arc, no Saved tile).
 */
import type React from 'react';
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { setDefaultCurrency, setHideSensitiveAmounts } from '@/db/settings';
import { toLocalIsoDate } from '@/lib/date';
import { getThisMonthWidgetData, getSuuWidgetData } from './data';
import { ThisMonthWidget } from './ThisMonthWidget';
import { PRIVATE_HEALTHY_LINES } from '@/features/home/suuLinePools';
import { createRecurringRule } from '@/db/recurring';

it('excludes sensitive spending and future repeating bills from hidden widget projections', async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  const now = new Date(2027, 0, 15);
  const bank = await createAccount({
    name: 'Privacy test',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 0,
  });
  const sensitive = await createCategory({ name: 'Private investments', kind: 'expense', isSensitive: true });
  await createTransaction({
    type: 'expense',
    accountId: bank.id,
    categoryId: sensitive.id,
    amountMinor: 999900,
    date: '2027-01-10',
  });
  await createRecurringRule({
    type: 'expense',
    accountId: bank.id,
    categoryId: sensitive.id,
    amountMinor: 123400,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: '2027-01-20',
  });
  await setHideSensitiveAmounts(true);
  const hidden = await getThisMonthWidgetData(now);
  expect(hidden.spentMinor).toBe(0);
  expect(hidden.slices.due ?? 0).toBe(0);
  expect(hidden.pace?.projectedMinor ?? 0).toBe(0);
  await setHideSensitiveAmounts(false);
  const visible = await getThisMonthWidgetData(now);
  expect(visible.spentMinor).toBe(999900);
  expect(visible.freeMinor).toBeLessThan(hidden.freeMinor);
  expect(visible.pace?.projectedMinor ?? 0).toBeGreaterThan(0);
});

function texts(node: unknown): string[] {
  if (node == null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(texts);
  const el = node as React.ReactElement<{ text?: string; label?: string; children?: unknown }>;
  if (typeof el.type !== 'function') return [];
  const out: string[] = [];
  if (typeof el.props.text === 'string') out.push(el.props.text);
  if (typeof el.props.label === 'string') out.push(el.props.label);
  const fn = el.type as ((props: unknown) => unknown) & { __name__?: string };
  return [...out, ...texts(el.props.children), ...(fn.__name__ ? [] : texts(fn(el.props)))];
}

describe('the This Month widget with savings hidden', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    const bank = await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 });
    const pot = await createAccount({
      name: 'Pot',
      type: 'savings',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
    const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    const date = toLocalIsoDate(new Date());
    const lastMonth = toLocalIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 0));
    // Last month spent more, so this month's spending is not "up" and Suu takes the savings-rate path.
    await createTransaction({
      type: 'expense',
      accountId: bank.id,
      categoryId: food,
      amountMinor: 5000000,
      date: lastMonth,
    });
    await createTransaction({
      type: 'income',
      accountId: bank.id,
      categoryId: salary,
      amountMinor: 10000000,
      date,
    });
    await createTransaction({
      type: 'expense',
      accountId: bank.id,
      categoryId: food,
      amountMinor: 1000000,
      date,
    });
    await createTransaction({
      type: 'transfer',
      accountId: bank.id,
      toAccountId: pot.id,
      amountMinor: 6000000,
      date,
    });
  });

  it('carries the savings figure and arc while hiding is off', async () => {
    await setHideSensitiveAmounts(false);
    const data = await getThisMonthWidgetData();
    expect(data.hideSavings).toBe(false);
    expect(data.savedMinor).toBe(6000000);
    expect(data.slices.saved).toBeCloseTo(0.6);
    expect(texts(ThisMonthWidget(data))).toContain('Saved');
  });

  it('drops the figure, the arc and the Saved tile while hiding is on, keeping Free honest', async () => {
    await setHideSensitiveAmounts(true);
    const data = await getThisMonthWidgetData();
    expect(data.hideSavings).toBe(true);
    expect(data.savedMinor).toBe(0);
    expect(data.slices.saved).toBe(0);
    expect(data.slices.free).toBeCloseTo(0.3);
    // As on Home's card: this month leaves ₹30,000, but last month went ₹50,000 over (spending, no income),
    // and that shortfall carries in.
    expect(data.freeMinor).toBe(3000000 - 5000000);
    const shown = texts(ThisMonthWidget(data));
    expect(shown).not.toContain('Saved');
    expect(shown).toContain('Free');
    expect(shown).toContain('30%');
    expect(shown).toContain('FREE');
  });

  it('builds the month it is given, not always the real current one', async () => {
    await setHideSensitiveAmounts(false);
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    // Warm the cache with the real month first: the shared comparison must not leak into another month.
    const current = await getThisMonthWidgetData(now);
    const previous = await getThisMonthWidgetData(lastMonth);
    expect(current.spentMinor).toBe(1000000);
    expect(previous.spentMinor).toBe(5000000);
    expect(previous.monthLabel).toBe(lastMonth.toLocaleDateString(undefined, { month: 'long' }));
  });

  it('leaves spending in savings/investment categories out of Spent while hiding is on, as Home does', async () => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() - 2, 15);
    const date = toLocalIsoDate(month);
    const bank = (await mockTestDb.getFirstAsync<{ id: string }>(
      `SELECT id FROM accounts WHERE name = 'Bank'`
    ))!.id;
    const food = (await mockTestDb.getFirstAsync<{ id: string }>(
      `SELECT id FROM categories WHERE name = 'Food'`
    ))!.id;
    const invest = (await createCategory({ name: 'Investments', kind: 'expense', isSensitive: true })).id;
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 200000,
      date,
    });
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: invest,
      amountMinor: 900000,
      date,
    });

    await setHideSensitiveAmounts(false);
    expect((await getThisMonthWidgetData(month)).spentMinor).toBe(1100000);
    await setHideSensitiveAmounts(true);
    expect((await getThisMonthWidgetData(month)).spentMinor).toBe(200000);
  });

  it("Suu's widget line stops naming a saved share while hiding is on", async () => {
    await setHideSensitiveAmounts(true);
    for (let i = 0; i < 30; i++) {
      const { line } = await getSuuWidgetData();
      expect(PRIVATE_HEALTHY_LINES).toContain(line.text);
    }
  });
});
