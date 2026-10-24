import { createRealDataTestDb } from '@/test-support/realDataTestDb';
const mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
import { CREATE_TABLES_SQL } from './schema';
import { createAccount, getAccountBalance, deleteAccount, updateAccount } from './accounts';
import {
  createSavingsGoal,
  updateSavingsGoal,
  contributeToGoal,
  listSavingsGoals,
  archiveSavingsGoal,
  unarchiveSavingsGoal,
} from './savingsGoals';
import { getGoalReservationSummary, moveGoalReservation, releaseGoalReservation } from './goalReservations';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';

let accountId: string;
const input = (name: string, overrides = {}) => ({
  name,
  targetAmountMinor: 100000,
  targetDate: null,
  linkedAccountId: accountId,
  reservesAccount: true,
  ...overrides,
});
beforeEach(async () => {
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await mockDb.execAsync(
    'DELETE FROM savings_goals; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM settings;'
  );
  accountId = (
    await createAccount({ name: 'Savings', type: 'savings', currency: 'INR', openingBalanceMinor: 500000 })
  ).id;
});

it('shares one live account without duplicating money or creating ledger entries', async () => {
  const a = await createSavingsGoal(input('Emergency')),
    b = await createSavingsGoal(input('Travel'));
  await contributeToGoal(a.id, 250000);
  await contributeToGoal(b.id, 100000);
  expect(await getGoalReservationSummary(accountId)).toMatchObject({
    balanceMinor: 500000,
    reservedMinor: 350000,
    availableMinor: 150000,
    shortfallMinor: 0,
  });
  expect(await getAccountBalance(accountId)).toBe(500000);
  expect(await mockDb.getFirstAsync('SELECT COUNT(*) AS n FROM transactions')).toEqual({ n: 0 });
  expect((await listSavingsGoals()).map((g) => g.currentAmountMinor)).toEqual([250000, 100000]);
});

it('rejects over-allocation using the live balance and other goals', async () => {
  const a = await createSavingsGoal(input('A')),
    b = await createSavingsGoal(input('B'));
  await contributeToGoal(a.id, 400000);
  await expect(contributeToGoal(b.id, 100001)).rejects.toThrow('Not enough');
  await contributeToGoal(b.id, 100000);
  expect((await getGoalReservationSummary(accountId)).availableMinor).toBe(0);
});

it('keeps reservations and reports shortfalls after a withdrawal', async () => {
  const a = await createSavingsGoal(input('A'));
  await contributeToGoal(a.id, 400000);
  await mockDb.runAsync('UPDATE accounts SET opening_balance_minor = 200000 WHERE id = ?', [accountId]);
  expect(await getGoalReservationSummary(accountId)).toMatchObject({
    reservedMinor: 400000,
    availableMinor: 0,
    shortfallMinor: 200000,
  });
  await expect(contributeToGoal(a.id, 1)).rejects.toThrow('Not enough');
  await contributeToGoal(a.id, -200000);
  expect((await getGoalReservationSummary(accountId)).shortfallMinor).toBe(0);
});

it('moves allocations atomically even during a shortfall', async () => {
  const a = await createSavingsGoal(input('A')),
    b = await createSavingsGoal(input('B'));
  await contributeToGoal(a.id, 400000);
  await mockDb.runAsync('UPDATE accounts SET opening_balance_minor = 1 WHERE id = ?', [accountId]);
  await moveGoalReservation(a.id, b.id, 150000);
  expect((await listSavingsGoals()).map((g) => g.currentAmountMinor)).toEqual([250000, 150000]);
  await expect(moveGoalReservation(a.id, b.id, 250001)).rejects.toThrow('changed');
  expect((await getGoalReservationSummary(accountId)).reservedMinor).toBe(400000);
});

it('rejects cross-account moves and archived destinations', async () => {
  const a = await createSavingsGoal(input('A')),
    b = await createSavingsGoal(input('B'));
  await contributeToGoal(a.id, 1000);
  await archiveSavingsGoal(b.id);
  await expect(moveGoalReservation(a.id, b.id, 100)).rejects.toThrow('active');
  const other = (
    await createAccount({ name: 'Other', type: 'bank', currency: 'INR', openingBalanceMinor: 10000 })
  ).id;
  const c = await createSavingsGoal(input('C', { linkedAccountId: other }));
  await expect(moveGoalReservation(a.id, c.id, 100)).rejects.toThrow('same account');
  expect((await getGoalReservationSummary(accountId)).reservedMinor).toBe(1000);
});

it('preserves or explicitly releases archived reservations', async () => {
  const a = await createSavingsGoal(input('A'));
  await contributeToGoal(a.id, 100000);
  await archiveSavingsGoal(a.id);
  expect((await getGoalReservationSummary(accountId)).reservedMinor).toBe(100000);
  await expect(contributeToGoal(a.id, 1)).rejects.toThrow('Unarchive');
  await contributeToGoal(a.id, -10000);
  await unarchiveSavingsGoal(a.id);
  await archiveSavingsGoal(a.id, true);
  expect((await getGoalReservationSummary(accountId)).reservedMinor).toBe(0);
});

it('keeps legacy manual progress separate through explicit mode changes', async () => {
  const a = await createSavingsGoal(input('A', { reservesAccount: false }));
  await contributeToGoal(a.id, 10000);
  await updateSavingsGoal(a.id, input('A'));
  await contributeToGoal(a.id, 20000);
  await expect(updateSavingsGoal(a.id, input('A', { reservesAccount: false }))).rejects.toThrow('Release');
  await releaseGoalReservation(a.id);
  await updateSavingsGoal(a.id, input('A', { reservesAccount: false }));
  expect((await listSavingsGoals())[0].currentAmountMinor).toBe(10000);
});

it('does not mix whole-account followers with shared reservations', async () => {
  const a = await createSavingsGoal(input('A', { reservesAccount: false, tracksAccount: true }));
  await expect(createSavingsGoal(input('B'))).rejects.toThrow('whole account');
  await updateSavingsGoal(a.id, input('A'));
  await contributeToGoal(a.id, 10000);
  await expect(
    createSavingsGoal(input('B', { reservesAccount: false, tracksAccount: true }))
  ).rejects.toThrow('reserved money');
});

it('protects reservation accounts from deletion and retyping', async () => {
  await createSavingsGoal(input('A'));
  await expect(deleteAccount(accountId)).rejects.toThrow('reservation goals');
  await expect(
    updateAccount(accountId, { name: 'Card', type: 'credit_card', openingBalanceMinor: 500000 })
  ).rejects.toThrow('reservation goals');
});

it('rejects cards, tracked investments, archived and foreign-currency accounts', async () => {
  for (const overrides of [
    { type: 'credit_card' },
    { type: 'savings', tracked: true },
    { currency: 'USD' },
  ]) {
    const a = await createAccount({
      name: 'Invalid',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 10000,
      ...overrides,
    } as Parameters<typeof createAccount>[0]);
    await expect(createSavingsGoal(input('A', { linkedAccountId: a.id }))).rejects.toThrow();
  }
  await mockDb.runAsync('UPDATE accounts SET archived = 1 WHERE id = ?', [accountId]);
  await expect(createSavingsGoal(input('A'))).rejects.toThrow('active');
});

it('rejects fractional amounts, over-release and self moves', async () => {
  const a = await createSavingsGoal(input('A'));
  await expect(contributeToGoal(a.id, 0.5)).rejects.toThrow();
  await expect(contributeToGoal(a.id, -1)).rejects.toThrow();
  await expect(moveGoalReservation(a.id, a.id, 1)).rejects.toThrow();
});

it('round-trips reservation amounts through backup, accepts v1 and rejects malformed reservations', async () => {
  const a = await createSavingsGoal(input('A'));
  await contributeToGoal(a.id, 120000);
  const snapshot = await buildBackupSnapshot();
  expect(snapshot.formatVersion).toBe(5);
  await releaseGoalReservation(a.id);
  await restoreFromSnapshot(snapshot);
  expect((await getGoalReservationSummary(accountId)).reservedMinor).toBe(120000);
  const invalid = JSON.parse(JSON.stringify(snapshot));
  invalid.tables.savings_goals[0].reserved_amount_minor = -1;
  await expect(restoreFromSnapshot(invalid)).rejects.toThrow('invalid goal reservations');
  expect((await getGoalReservationSummary(accountId)).reservedMinor).toBe(120000);
  const legacy = JSON.parse(JSON.stringify(snapshot));
  legacy.formatVersion = 1;
  delete legacy.tables.savings_goals[0].reserve_account;
  delete legacy.tables.savings_goals[0].reserved_amount_minor;
  await restoreFromSnapshot(legacy);
  expect((await listSavingsGoals())[0].reservesAccount).toBe(false);
});

it('includes a negative account balance in the reservation shortfall', async () => {
  const a = await createSavingsGoal(input('A'));
  await contributeToGoal(a.id, 100000);
  await mockDb.runAsync('UPDATE accounts SET opening_balance_minor = -10000 WHERE id = ?', [accountId]);
  expect(await getGoalReservationSummary(accountId)).toMatchObject({
    availableMinor: 0,
    shortfallMinor: 110000,
    reservedMinor: 100000,
  });
});
