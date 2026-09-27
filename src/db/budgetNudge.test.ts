/**
 * Budget nudges against a real SQLite engine: one notification when a
 * budget passes 80% of its limit, one when it goes over — never twice for
 * the same budget in the same month, a subcategory's spending counts toward
 * its parent's budget, and the "Overspending alerts" switch turns them off.
 * (Mock call counts reset between tests — see jest.config.js.)
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
const mockNotifyBudget = jest.fn(async (_copy: { title: string; body: string }) => {});
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
  notifyBudget: (copy: { title: string; body: string }) => mockNotifyBudget(copy),
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createBudget, dueBudgetNudge } from '@/db/budgets';
import { setNotificationPrefs, getNotificationPrefs, resetSettingsCache } from '@/db/settings';
import { toLocalIsoDate } from '@/lib/date';

const today = toLocalIsoDate(new Date());
let bank: string;
let food: string;
let zomato: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  zomato = (await createCategory({ name: 'Zomato', kind: 'expense', parentId: food })).id;
  await createBudget({ categoryId: food, limitAmountMinor: 100000, rollover: false });
});

const spend = (categoryId: string, amountMinor: number) =>
  createTransaction({ type: 'expense', accountId: bank, categoryId, amountMinor, date: today });

describe('budget nudges', () => {
  it('say nothing below 80%', async () => {
    await spend(food, 50000);
    expect(mockNotifyBudget).not.toHaveBeenCalled();
  });

  it("nudge once at 80%, counting a subcategory's spending", async () => {
    await spend(zomato, 30000); // ₹800 of ₹1,000
    expect(mockNotifyBudget).toHaveBeenCalledTimes(1);
    expect(mockNotifyBudget.mock.calls[0][0].title).toBe('Food is at 80% of its budget');
    await spend(food, 5000);
    expect(mockNotifyBudget).toHaveBeenCalledTimes(1);
  });

  it('nudge once more on going over, then stay quiet', async () => {
    await spend(food, 20000); // ₹1,050
    expect(mockNotifyBudget).toHaveBeenCalledTimes(1);
    expect(mockNotifyBudget.mock.calls[0][0].title).toBe('Food went over budget');
    await spend(food, 1000);
    expect(mockNotifyBudget).toHaveBeenCalledTimes(1);
  });

  it('follow the Overspending alerts switch', async () => {
    const travel = (await createCategory({ name: 'Travel', kind: 'expense' })).id;
    await createBudget({ categoryId: travel, limitAmountMinor: 10000, rollover: false });
    await setNotificationPrefs({ ...(await getNotificationPrefs()), overspendAlerts: false });
    await spend(travel, 20000);
    expect(mockNotifyBudget).not.toHaveBeenCalled();
  });
});

describe('dueBudgetNudge', () => {
  const none = { near: false, over: false };
  it('picks the right nudge for where a budget is, and nothing already sent', () => {
    expect(dueBudgetNudge({ overBudget: false, percentUsed: 79 }, none)).toBeNull();
    expect(dueBudgetNudge({ overBudget: false, percentUsed: 80 }, none)).toBe('near');
    expect(dueBudgetNudge({ overBudget: false, percentUsed: 95 }, { near: true, over: false })).toBeNull();
    expect(dueBudgetNudge({ overBudget: true, percentUsed: 120 }, { near: true, over: false })).toBe('over');
    expect(dueBudgetNudge({ overBudget: true, percentUsed: 120 }, { near: true, over: true })).toBeNull();
  });
});
