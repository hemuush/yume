/**
 * A credit card's bill, from its own entries in a real database: what it
 * owed at the end of the statement day, what's been paid in since, what's
 * been spent since, and what's left. Plus how that bill reaches Plan's
 * Coming up and Home's Needs you. All figures are made up.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
  notifyBudget: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, listAccounts, updateAccount } from '@/db/ledger';
import { getCardCycle, listCardCycles } from './cardCycles';
import { buildDueItems } from '@/features/plan/planOverview';
import { buildNeedsYouItems } from '@/features/home/needsYou';

let bank: string;
let card: string;
let food: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

beforeEach(async () => {
  for (const table of ['deleted_entries', 'transactions', 'categories', 'accounts']) {
    await mockTestDb.runAsync(`DELETE FROM ${table}`);
  }
  bank = (
    await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 5_000_000 })
  ).id;
  card = (
    await createAccount({
      name: 'Millennia',
      type: 'credit_card',
      currency: 'INR',
      openingBalanceMinor: 0,
      creditLimitMinor: 10_000_000,
      statementDay: 5,
      dueDay: 25,
    })
  ).id;
  food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
});

const spend = (amountMinor: number, date: string) =>
  createTransaction({ type: 'expense', accountId: card, categoryId: food, amountMinor, date });
const pay = (amountMinor: number, date: string) =>
  createTransaction({ type: 'transfer', accountId: bank, toAccountId: card, amountMinor, date });

async function cardAccount() {
  return (await listAccounts()).find((a) => a.id === card)!;
}

describe('getCardCycle', () => {
  it('works out the statement, what was paid since, and what is left', async () => {
    await spend(900_000, '2026-08-20'); // last cycle
    await spend(330_000, '2026-09-05'); // on the statement day: still last cycle
    await pay(800_000, '2026-09-10'); // paid after the statement
    await spend(842_000, '2026-09-18'); // this cycle
    const cycle = (await getCardCycle(await cardAccount(), '2026-09-22'))!;
    expect(cycle).toMatchObject({
      statementDate: '2026-09-05',
      statementMinor: 1_230_000,
      paidSinceMinor: 800_000,
      leftToPayMinor: 430_000,
      spentThisCycleMinor: 842_000,
      dueDate: '2026-09-25',
      daysUntilDue: 3,
      accountName: 'Millennia',
    });
  });

  it('is nothing left once the statement is paid in full', async () => {
    await spend(500_000, '2026-08-28');
    await pay(500_000, '2026-09-12');
    const cycle = (await getCardCycle(await cardAccount(), '2026-09-22'))!;
    expect(cycle.leftToPayMinor).toBe(0);
  });

  it('is null for a card without both days, and for any other account', async () => {
    await updateAccount(card, {
      name: 'Millennia',
      type: 'credit_card',
      openingBalanceMinor: 0,
      creditLimitMinor: 10_000_000,
      statementDay: null,
      dueDay: null,
    });
    expect(await getCardCycle(await cardAccount(), '2026-09-22')).toBeNull();
    const bankAccount = (await listAccounts()).find((a) => a.id === bank)!;
    expect(await getCardCycle(bankAccount, '2026-09-22')).toBeNull();
    expect(await listCardCycles('2026-09-22')).toEqual([]);
  });

  it('keeps the days when a card is edited, and clears them if it stops being a card', async () => {
    await updateAccount(card, {
      name: 'Millennia',
      type: 'credit_card',
      openingBalanceMinor: 0,
      statementDay: 12,
      dueDay: 2,
    });
    expect(await cardAccount()).toMatchObject({ statementDay: 12, dueDay: 2 });
    await updateAccount(card, {
      name: 'Millennia',
      type: 'bank',
      openingBalanceMinor: 0,
      statementDay: 12,
      dueDay: 2,
    });
    expect(await cardAccount()).toMatchObject({ statementDay: null, dueDay: null });
  });
});

it('turns away a card day outside 1 to 31, or only one of the two', async () => {
  await expect(
    updateAccount(card, {
      name: 'Millennia',
      type: 'credit_card',
      openingBalanceMinor: 0,
      statementDay: 32,
      dueDay: 5,
    })
  ).rejects.toThrow('1 to 31');
  await expect(
    updateAccount(card, {
      name: 'Millennia',
      type: 'credit_card',
      openingBalanceMinor: 0,
      statementDay: 5,
      dueDay: null,
    })
  ).rejects.toThrow('or neither');
});

describe('the bill in Coming up and Needs you', () => {
  const bill = { accountId: 'c1', accountName: 'Millennia', dueDate: '2026-09-25', leftToPayMinor: 430_000 };

  it('joins Coming up as a bill that opens Pay bill, only while something is left', () => {
    const items = buildDueItems([], [], [bill, { ...bill, accountId: 'c2', leftToPayMinor: 0 }]);
    expect(items).toEqual([
      {
        key: 'card-c1',
        title: 'Millennia bill',
        kind: 'bill',
        dueDate: '2026-09-25',
        amountMinor: 430_000,
        route: '/add-transaction?type=transfer&toAccountId=c1&amount=430000',
      },
    ]);
  });

  const needs = (today: string, cardBills = [bill]) =>
    buildNeedsYouItems({
      nextDue: null,
      budgets: [],
      backup: { folderUri: 'x', lastResult: { ok: true }, snoozedUntil: null },
      transactionCount: 0,
      cardBills,
      today,
      now: new Date(),
    }).filter((i) => i.action === 'payCard');

  it('shows in Needs you in the last 5 days, and once it is late', () => {
    expect(needs('2026-09-19')).toHaveLength(0);
    expect(needs('2026-09-20')[0]).toMatchObject({ detail: 'Due in 5 days', tone: 'warn' });
    expect(needs('2026-09-24')[0]).toMatchObject({ detail: 'Due tomorrow', tone: 'warn' });
    expect(needs('2026-09-25')[0]).toMatchObject({ detail: 'Due today', tone: 'urgent' });
    expect(needs('2026-09-27')[0]).toMatchObject({
      detail: 'Overdue by 2 days',
      tone: 'urgent',
      payCard: { accountId: 'c1', amountMinor: 430_000 },
    });
  });

  it('never shows a paid bill', () => {
    expect(needs('2026-09-24', [{ ...bill, leftToPayMinor: 0 }])).toHaveLength(0);
  });

  it('comes back on the day after being dismissed while it was only "soon"', () => {
    expect(needs('2026-09-24')[0].key).not.toBe(needs('2026-09-25')[0].key);
  });
});
