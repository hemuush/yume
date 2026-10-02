/**
 * Tracked (investment) accounts against a real SQLite engine: the value is
 * the latest update plus what moved after it, and gain is what's left once
 * you subtract what you put in and add back what you took out.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createTransaction,
  listAccounts,
  getAccountBalance,
  deleteAccount,
} from '@/db/ledger';
import { createSavingsGoal, listSavingsGoals } from '@/db/savingsGoals';
import { getNetWorthTrend } from '@/db/reports';
import { updateAccount } from '@/db/accounts';
import {
  addValuation,
  updateValuation,
  deleteValuation,
  restoreValuation,
  listValuations,
} from '@/db/valuations';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';

async function reset() {
  await mockTestDb.execAsync(`
    DELETE FROM account_valuations; DELETE FROM transactions; DELETE FROM savings_goals; DELETE FROM accounts;
  `);
}

async function sip(from: string, to: string, date: string, amountMinor = 150000) {
  await createTransaction({ type: 'transfer', accountId: from, toAccountId: to, amountMinor, date });
}

/** The worked example: ₹30,000 opening, seven ₹1,500 SIPs, an update on 28 Sep, one more SIP on 1 Oct. */
async function indexFund() {
  const bank = await createAccount({ name: 'Bank one', type: 'bank', openingBalanceMinor: 5_000_000 });
  const fund = await createAccount({
    name: 'Index fund',
    type: 'savings',
    openingBalanceMinor: 3_000_000,
    tracked: true,
  });
  for (const m of ['03', '04', '05', '06', '07', '08', '09']) await sip(bank.id, fund.id, `2026-${m}-01`);
  return { bank, fund };
}

async function tracked(id: string) {
  const a = (await listAccounts()).find((x) => x.id === id);
  if (!a?.investment) throw new Error('not tracked');
  return { account: a, inv: a.investment };
}

describe('tracked accounts', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
  });
  beforeEach(reset);

  it('has no investment summary unless tracked', async () => {
    const bank = await createAccount({ name: 'Bank', type: 'bank' });
    const plain = await createAccount({ name: 'Plain pot', type: 'savings' });
    const accounts = await listAccounts();
    expect(accounts.find((a) => a.id === bank.id)?.investment).toBeUndefined();
    expect(accounts.find((a) => a.id === plain.id)?.investment).toBeUndefined();
  });

  it('only a savings account can be tracked', async () => {
    const bank = await createAccount({ name: 'Bank', type: 'bank', tracked: true });
    expect((await listAccounts()).find((a) => a.id === bank.id)?.investment).toBeUndefined();
  });

  it('shows the ledger balance and no gain before the first update', async () => {
    const { fund } = await indexFund();
    const { account, inv } = await tracked(fund.id);
    expect(account.currentBalanceMinor).toBe(3_000_000 + 7 * 150000);
    expect(inv.investedMinor).toBe(3_000_000 + 7 * 150000);
    expect(inv.gainMinor).toBeNull();
    expect(inv.valuedAt).toBeNull();
  });

  it('values it as the latest update plus what went in since (the worked example)', async () => {
    const { bank, fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_306_000 });
    await sip(bank.id, fund.id, '2026-10-01');
    const { account, inv } = await tracked(fund.id);
    expect(account.currentBalanceMinor).toBe(4_456_000);
    expect(inv.investedMinor).toBe(4_200_000);
    expect(inv.takenOutMinor).toBe(0);
    expect(inv.gainMinor).toBe(256_000);
    expect(inv.valuedAt).toBe('2026-09-28');
    expect(inv.lastValueMinor).toBe(4_306_000);
    expect(await getAccountBalance(fund.id)).toBe(4_456_000);
  });

  it('shows a loss as a negative gain', async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 3_900_000 });
    const { inv } = await tracked(fund.id);
    expect(inv.gainMinor).toBe(3_900_000 - 4_050_000);
  });

  it('keeps the gain when you take money out', async () => {
    const { bank, fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_306_000 });
    await sip(bank.id, fund.id, '2026-10-01');
    await createTransaction({
      type: 'transfer',
      accountId: fund.id,
      toAccountId: bank.id,
      amountMinor: 1_000_000,
      date: '2026-10-02',
    });
    const { account, inv } = await tracked(fund.id);
    expect(account.currentBalanceMinor).toBe(3_456_000);
    expect(inv.takenOutMinor).toBe(1_000_000);
    expect(inv.investedMinor).toBe(4_200_000);
    expect(inv.gainMinor).toBe(256_000);
  });

  it('uses the newest dated update, however it was entered', async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    await addValuation(fund.id, { date: '2026-08-15', valueMinor: 4_000_000 });
    const { account, inv } = await tracked(fund.id);
    expect(inv.valuedAt).toBe('2026-09-28');
    expect(account.currentBalanceMinor).toBe(4_300_000);
  });

  it('replaces the update when the same date is saved twice', async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_310_000 });
    expect(await listValuations(fund.id)).toHaveLength(1);
    expect((await tracked(fund.id)).account.currentBalanceMinor).toBe(4_310_000);
  });

  it('lists updates newest first with the gain as of each date', async () => {
    const { bank, fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-06-30', valueMinor: 3_700_000 });
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_306_000 });
    await sip(bank.id, fund.id, '2026-10-01');
    const list = await listValuations(fund.id);
    expect(list.map((v) => v.date)).toEqual(['2026-09-28', '2026-06-30']);
    expect(list[0]).toMatchObject({ investedMinor: 4_050_000, gainMinor: 256_000 });
    expect(list[1]).toMatchObject({ investedMinor: 3_600_000, gainMinor: 100_000 });
  });

  it('edits and deletes an update, and undoes the delete', async () => {
    const { fund } = await indexFund();
    const v = await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    await updateValuation(v.id, { date: '2026-09-28', valueMinor: 4_100_000 });
    expect((await tracked(fund.id)).account.currentBalanceMinor).toBe(4_100_000);
    const snapshot = await deleteValuation(v.id);
    expect((await tracked(fund.id)).inv.gainMinor).toBeNull();
    await restoreValuation(snapshot);
    expect((await tracked(fund.id)).account.currentBalanceMinor).toBe(4_100_000);
  });

  it('rejects a bad value, a bad date and an untracked account', async () => {
    const { fund } = await indexFund();
    await expect(addValuation(fund.id, { date: '2026-09-28', valueMinor: -1 })).rejects.toThrow();
    await expect(addValuation(fund.id, { date: 'yesterday', valueMinor: 100 })).rejects.toThrow();
    const plain = await createAccount({ name: 'Plain', type: 'savings' });
    await expect(addValuation(plain.id, { date: '2026-09-28', valueMinor: 100 })).rejects.toThrow(/Track/);
  });

  it('can be switched off and on again, keeping its updates', async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    await updateAccount(fund.id, {
      name: 'Index fund',
      type: 'savings',
      openingBalanceMinor: 3_000_000,
      tracked: false,
    });
    expect((await listAccounts()).find((a) => a.id === fund.id)?.investment).toBeUndefined();
    expect(await getAccountBalance(fund.id)).toBe(4_050_000);
    // Leaving `tracked` out keeps whatever it is now.
    const back = await updateAccount(fund.id, {
      name: 'Index fund',
      type: 'savings',
      openingBalanceMinor: 3_000_000,
    });
    expect(back.investment).toBeUndefined();
    const again = await updateAccount(fund.id, {
      name: 'Index fund',
      type: 'savings',
      openingBalanceMinor: 3_000_000,
      tracked: true,
    });
    expect(again.currentBalanceMinor).toBe(4_300_000);
  });

  it("won't delete an account that has value updates", async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    await expect(deleteAccount(fund.id)).rejects.toThrow(/archive/);
  });

  it('counts the value toward a goal that follows the account', async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    await createSavingsGoal({
      name: 'House',
      targetAmountMinor: 10_000_000,
      targetDate: null,
      linkedAccountId: fund.id,
      tracksAccount: true,
    });
    const goals = await listSavingsGoals();
    expect(goals[0].currentAmountMinor).toBe(4_300_000);
  });

  it('puts the value, not the cost, into net worth history', async () => {
    const fund = await createAccount({
      name: 'Index fund',
      type: 'savings',
      openingBalanceMinor: 100_000,
      tracked: true,
    });
    await addValuation(fund.id, { date: '2026-08-15', valueMinor: 150_000 });
    const trend = await getNetWorthTrend(4, new Date(2026, 9, 2));
    expect(trend.map((p) => p.netWorthMinor)).toEqual([100_000, 150_000, 150_000, 150_000]);
  });

  it('survives a backup round trip', async () => {
    const { fund } = await indexFund();
    await addValuation(fund.id, { date: '2026-09-28', valueMinor: 4_300_000 });
    const snapshot = await buildBackupSnapshot();
    expect(snapshot.tables.account_valuations).toHaveLength(1);
    await reset();
    await restoreFromSnapshot(snapshot);
    const { account, inv } = await tracked(fund.id);
    expect(account.currentBalanceMinor).toBe(4_300_000);
    expect(inv.gainMinor).toBe(250_000);
  });

  it('restores an older backup that has no valuations or tracked flag', async () => {
    const { fund } = await indexFund();
    const snapshot = await buildBackupSnapshot();
    delete snapshot.tables.account_valuations;
    snapshot.tables.accounts = snapshot.tables.accounts.map(({ tracked: _t, ...rest }) => rest);
    await restoreFromSnapshot(snapshot);
    const account = (await listAccounts()).find((a) => a.id === fund.id);
    expect(account?.investment).toBeUndefined();
    expect(account?.currentBalanceMinor).toBe(4_050_000);
  });
});
