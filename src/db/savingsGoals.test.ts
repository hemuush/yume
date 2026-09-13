/**
 * Savings goals against a real SQLite engine: validation, contribution
 * clamping, the archive-vs-delete split (mirrors deleteAccount/deleteLoan),
 * and the delete/undo round trip.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount } from '@/db/ledger';
import {
  createSavingsGoal,
  updateSavingsGoal,
  contributeToGoal,
  archiveSavingsGoal,
  unarchiveSavingsGoal,
  deleteSavingsGoal,
  restoreSavingsGoal,
  listSavingsGoals,
} from '@/db/savingsGoals';

describe('savings goals', () => {
  let accountId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    accountId = (
      await createAccount({ name: 'Savings', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
  });

  it('creates a goal starting at zero saved, and rejects invalid input', async () => {
    const goal = await createSavingsGoal({
      name: 'Emergency Fund',
      targetAmountMinor: 10000000,
      targetDate: null,
      linkedAccountId: accountId,
    });
    expect(goal.currentAmountMinor).toBe(0);
    expect(goal.archived).toBe(false);
    expect(goal.linkedAccountId).toBe(accountId);

    await expect(
      createSavingsGoal({ name: '  ', targetAmountMinor: 1000, targetDate: null, linkedAccountId: null })
    ).rejects.toThrow('name is required');
    await expect(
      createSavingsGoal({ name: 'Bad target', targetAmountMinor: 0, targetDate: null, linkedAccountId: null })
    ).rejects.toThrow('positive amount');
  });

  it('contributeToGoal adds and subtracts, clamped so it never goes negative', async () => {
    const goal = await createSavingsGoal({
      name: 'Goa Trip',
      targetAmountMinor: 4000000,
      targetDate: '2026-12-31',
      linkedAccountId: null,
    });
    await contributeToGoal(goal.id, 720000);
    let current = (await listSavingsGoals()).find((g) => g.id === goal.id)!;
    expect(current.currentAmountMinor).toBe(720000);

    await contributeToGoal(goal.id, -300000);
    current = (await listSavingsGoals()).find((g) => g.id === goal.id)!;
    expect(current.currentAmountMinor).toBe(420000);

    // A large withdrawal clamps at 0, never goes negative.
    await contributeToGoal(goal.id, -999999999);
    const clamped = (await listSavingsGoals()).find((g) => g.id === goal.id)!;
    expect(clamped.currentAmountMinor).toBe(0);
  });

  it('contributeToGoal rejects a zero amount and an unknown id', async () => {
    const goal = await createSavingsGoal({
      name: 'New Laptop',
      targetAmountMinor: 8000000,
      targetDate: null,
      linkedAccountId: null,
    });
    await expect(contributeToGoal(goal.id, 0)).rejects.toThrow('Enter an amount');
    await expect(contributeToGoal('not-a-real-id', 1000)).rejects.toThrow('no longer exists');
  });

  it('updateSavingsGoal changes name/target/date/linked account without touching progress', async () => {
    const goal = await createSavingsGoal({
      name: 'Old Name',
      targetAmountMinor: 1000000,
      targetDate: null,
      linkedAccountId: null,
    });
    await contributeToGoal(goal.id, 200000);
    await updateSavingsGoal(goal.id, {
      name: 'New Name',
      targetAmountMinor: 1500000,
      targetDate: '2027-01-01',
      linkedAccountId: accountId,
    });
    const updated = (await listSavingsGoals()).find((g) => g.id === goal.id)!;
    expect(updated.name).toBe('New Name');
    expect(updated.targetAmountMinor).toBe(1500000);
    expect(updated.targetDate).toBe('2027-01-01');
    expect(updated.linkedAccountId).toBe(accountId);
    expect(updated.currentAmountMinor).toBe(200000);
  });

  it('archive hides a goal from the default list but keeps it reachable, unarchive brings it back', async () => {
    const goal = await createSavingsGoal({
      name: 'Archive Me',
      targetAmountMinor: 500000,
      targetDate: null,
      linkedAccountId: null,
    });
    await archiveSavingsGoal(goal.id);
    expect((await listSavingsGoals()).some((g) => g.id === goal.id)).toBe(false);
    expect((await listSavingsGoals(true)).some((g) => g.id === goal.id)).toBe(true);

    await unarchiveSavingsGoal(goal.id);
    expect((await listSavingsGoals()).some((g) => g.id === goal.id)).toBe(true);
  });

  it('blocks deleting a goal with real progress — archive is the only option once funded', async () => {
    const goal = await createSavingsGoal({
      name: 'Funded Goal',
      targetAmountMinor: 500000,
      targetDate: null,
      linkedAccountId: null,
    });
    await contributeToGoal(goal.id, 10000);
    await expect(deleteSavingsGoal(goal.id)).rejects.toThrow('archive it instead');
  });

  it('deletes an unfunded goal and restores it via the undo snapshot, unchanged', async () => {
    const goal = await createSavingsGoal({
      name: 'Never Funded',
      targetAmountMinor: 300000,
      targetDate: null,
      linkedAccountId: null,
    });
    const snapshot = await deleteSavingsGoal(goal.id);
    expect((await listSavingsGoals(true)).some((g) => g.id === goal.id)).toBe(false);

    await restoreSavingsGoal(snapshot);
    const restored = (await listSavingsGoals()).find((g) => g.id === goal.id)!;
    expect(restored.name).toBe('Never Funded');
    expect(restored.currentAmountMinor).toBe(0);
  });

  it('deleteSavingsGoal on an already-deleted id throws instead of returning a bogus snapshot', async () => {
    const goal = await createSavingsGoal({
      name: 'Delete Twice',
      targetAmountMinor: 300000,
      targetDate: null,
      linkedAccountId: null,
    });
    await deleteSavingsGoal(goal.id);
    await expect(deleteSavingsGoal(goal.id)).rejects.toThrow('already deleted');
  });
});
