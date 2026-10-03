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
    expect(data.freeMinor).toBe(3000000);
    const shown = texts(ThisMonthWidget(data));
    expect(shown).not.toContain('Saved');
    expect(shown).toContain('Free');
    expect(shown).toContain('30%');
    expect(shown).toContain('FREE');
  });

  it("Suu's widget line stops naming a saved share while hiding is on", async () => {
    await setHideSensitiveAmounts(true);
    for (let i = 0; i < 30; i++) {
      const { line } = await getSuuWidgetData();
      expect(PRIVATE_HEALTHY_LINES).toContain(line.text);
    }
  });
});
