/**
 * A goal that follows its account, against a real SQLite engine: progress
 * is the account's balance (opening balance, entries and transfers), money
 * added by hand is kept aside and comes back when it stops following, it
 * can't take "+ Add money", and the What-if rate is the account's recent
 * growth rather than its whole balance.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createTransaction, getAccountMonthlyGrowth } from '@/db/ledger';
import {
  createSavingsGoal,
  updateSavingsGoal,
  contributeToGoal,
  listSavingsGoals,
  goalsFollowingAccount,
  deleteSavingsGoal,
} from '@/db/savingsGoals';

describe('a goal that follows its account', () => {
  let bankId: string;
  let potId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    bankId = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 900000 })
    ).id;
    potId = (
      await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 2000000 })
    ).id;
  });

  const goalNamed = async (name: string) => (await listSavingsGoals(true)).find((g) => g.name === name)!;

  it("shows the account's balance, and moves with a transfer in", async () => {
    await createSavingsGoal({
      name: 'Rainy day',
      targetAmountMinor: 5000000,
      targetDate: null,
      linkedAccountId: potId,
      tracksAccount: true,
    });
    let goal = await goalNamed('Rainy day');
    expect(goal.tracksAccount).toBe(true);
    expect(goal.currentAmountMinor).toBe(2000000);

    await createTransaction({
      type: 'transfer',
      accountId: bankId,
      toAccountId: potId,
      amountMinor: 300000,
      date: '2026-09-10',
    });
    goal = await goalNamed('Rainy day');
    expect(goal.currentAmountMinor).toBe(2300000);

    // Money leaving the account moves it back down.
    await createTransaction({
      type: 'transfer',
      accountId: potId,
      toAccountId: bankId,
      amountMinor: 100000,
      date: '2026-09-14',
    });
    goal = await goalNamed('Rainy day');
    expect(goal.currentAmountMinor).toBe(2200000);
  });

  it("can't take money by hand while following", async () => {
    const goal = await goalNamed('Rainy day');
    await expect(contributeToGoal(goal.id, 10000)).rejects.toThrow(/follows its account/);
  });

  it('keeps money added by hand aside, and brings it back when it stops following', async () => {
    const made = await createSavingsGoal({
      name: 'Bike',
      targetAmountMinor: 1000000,
      targetDate: null,
      linkedAccountId: potId,
    });
    expect(made.tracksAccount).toBe(false);
    await contributeToGoal(made.id, 120000);

    const base = { name: 'Bike', targetAmountMinor: 1000000, targetDate: null, linkedAccountId: potId };
    await updateSavingsGoal(made.id, { ...base, tracksAccount: true });
    expect((await goalNamed('Bike')).currentAmountMinor).toBe(2200000);

    await updateSavingsGoal(made.id, { ...base, tracksAccount: false });
    const back = await goalNamed('Bike');
    expect(back.tracksAccount).toBe(false);
    expect(back.currentAmountMinor).toBe(120000);
  });

  it('never follows without an account', async () => {
    const made = await createSavingsGoal({
      name: 'Loose',
      targetAmountMinor: 100000,
      targetDate: null,
      linkedAccountId: null,
      tracksAccount: true,
    });
    expect(made.tracksAccount).toBe(false);
    expect(made.currentAmountMinor).toBe(0);
  });

  it("never shows below zero when the account's balance is negative", async () => {
    const overdrawn = (await createAccount({ name: 'Overdrawn', type: 'bank', currency: 'INR' })).id;
    await createTransaction({
      type: 'transfer',
      accountId: overdrawn,
      toAccountId: bankId,
      amountMinor: 5000,
      date: '2026-09-01',
    });
    const made = await createSavingsGoal({
      name: 'Deep end',
      targetAmountMinor: 100000,
      targetDate: null,
      linkedAccountId: overdrawn,
      tracksAccount: true,
    });
    expect(made.currentAmountMinor).toBe(0);
    await deleteSavingsGoal(made.id);
  });

  it('names the other goals already following an account, but not the one being edited', async () => {
    const rainy = await goalNamed('Rainy day');
    expect(await goalsFollowingAccount(potId)).toEqual(['Rainy day']);
    expect(await goalsFollowingAccount(potId, rainy.id)).toEqual([]);
    expect(await goalsFollowingAccount(bankId)).toEqual([]);
  });

  it('can be deleted even with a balance, since it holds no money of its own', async () => {
    const made = await createSavingsGoal({
      name: 'Temporary',
      targetAmountMinor: 100000,
      targetDate: null,
      linkedAccountId: potId,
      tracksAccount: true,
    });
    await expect(deleteSavingsGoal(made.id)).resolves.toBeTruthy();
  });

  it("grows at the account's recent monthly rate, not its whole balance", async () => {
    // In the last 90 days before 30 Sep: +₹3,000 in, −₹1,000 out.
    const perMonth = await getAccountMonthlyGrowth(potId, 90, '2026-09-30');
    expect(perMonth).toBe(Math.round(200000 / (90 / 30.44)));
    // The opening ₹20,000 is not growth.
    expect(perMonth).toBeLessThan(2000000);
    // An account that only shrank isn't saving.
    const shrinking = (await createAccount({ name: 'Leaky', type: 'bank', currency: 'INR' })).id;
    await createTransaction({
      type: 'transfer',
      accountId: shrinking,
      toAccountId: bankId,
      amountMinor: 10000,
      date: '2026-09-20',
    });
    expect(await getAccountMonthlyGrowth(shrinking, 90, '2026-09-30')).toBe(0);
  });
});
