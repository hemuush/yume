/**
 * An investment's kind and funding account, and the rule marker on entries a recurring rule posts: validated on
 * save, kept or cleared on edit, added to older databases, and carried through a backup.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  ...jest.requireActual('@/db/client'),
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { runMigrations } from '@/db/client';
import { createAccount, updateAccount, listAccounts } from '@/db/accounts';
import { createCategory, createTransaction, listTransactions } from '@/db/ledger';
import { createRecurringRule, runDueRecurringRules } from '@/db/recurring';
import { buildBackupSnapshot, restoreFromSnapshot, BACKUP_FORMAT_VERSION } from '@/lib/backup';

let bank: string;
let card: string;
let usd: string;

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'HDFC', type: 'bank', currency: 'INR' })).id;
  card = (await createAccount({ name: 'Card', type: 'credit_card', currency: 'INR' })).id;
  usd = (await createAccount({ name: 'Wise', type: 'bank', currency: 'USD' })).id;
});

const find = async (id: string) => (await listAccounts(true)).find((a) => a.id === id)!;

describe('investment kind and funding account', () => {
  it('saves both on a tracked savings account and reads them back', async () => {
    const fund = await createAccount({
      name: 'Nifty 50',
      type: 'savings',
      tracked: true,
      investmentKind: 'mutual_fund',
      fundingAccountId: bank,
    });
    const read = await find(fund.id);
    expect(read.investment?.kind).toBe('mutual_fund');
    expect(read.investment?.fundingAccountId).toBe(bank);
  });

  it('ignores both on an account that is not tracked', async () => {
    const plain = await createAccount({
      name: 'Rainy day',
      type: 'savings',
      investmentKind: 'gold',
      fundingAccountId: bank,
    });
    expect((await find(plain.id)).investment).toBeUndefined();
    const row = await mockTestDb.getFirstAsync<{
      investment_kind: string | null;
      funding_account_id: string | null;
    }>('SELECT investment_kind, funding_account_id FROM accounts WHERE id = ?', [plain.id]);
    expect(row).toEqual({ investment_kind: null, funding_account_id: null });
  });

  it('refuses a funding account that is a card, another currency, or an unknown id', async () => {
    const base = { name: 'X', type: 'savings' as const, tracked: true };
    await expect(createAccount({ ...base, fundingAccountId: card })).rejects.toThrow('bank, cash or wallet');
    await expect(createAccount({ ...base, fundingAccountId: usd })).rejects.toThrow(
      'same as this investment'
    );
    await expect(createAccount({ ...base, fundingAccountId: 'nope' })).rejects.toThrow('no longer exists');
    await expect(createAccount({ ...base, investmentKind: 'crypto' as never })).rejects.toThrow('valid kind');
  });

  it('refuses an investment as its own or another investment’s funding', async () => {
    const a = await createAccount({ name: 'A', type: 'savings', tracked: true });
    const b = await createAccount({ name: 'B', type: 'savings', tracked: true, fundingAccountId: bank });
    await expect(
      updateAccount(a.id, { name: 'A', type: 'savings', openingBalanceMinor: 0, fundingAccountId: a.id })
    ).rejects.toThrow('from itself');
    await expect(
      updateAccount(a.id, { name: 'A', type: 'savings', openingBalanceMinor: 0, fundingAccountId: b.id })
    ).rejects.toThrow('bank, cash or wallet');
  });

  it('keeps them on an edit that leaves them out, changes them when given, and clears them when untracked', async () => {
    const fund = await createAccount({
      name: 'Gold',
      type: 'savings',
      tracked: true,
      investmentKind: 'gold',
      fundingAccountId: bank,
    });
    const keep = { name: 'Gold', type: 'savings' as const, openingBalanceMinor: 0 };
    await updateAccount(fund.id, keep);
    expect((await find(fund.id)).investment).toMatchObject({ kind: 'gold', fundingAccountId: bank });
    await updateAccount(fund.id, { ...keep, investmentKind: 'stocks', fundingAccountId: null });
    expect((await find(fund.id)).investment).toMatchObject({ kind: 'stocks', fundingAccountId: null });
    await updateAccount(fund.id, { ...keep, tracked: false });
    const row = await mockTestDb.getFirstAsync<{ investment_kind: string | null }>(
      'SELECT investment_kind FROM accounts WHERE id = ?',
      [fund.id]
    );
    expect(row?.investment_kind).toBeNull();
  });

  it('clears the funding link when that account is deleted', async () => {
    const temp = await createAccount({ name: 'Temp', type: 'bank' });
    const fund = await createAccount({
      name: 'F',
      type: 'savings',
      tracked: true,
      fundingAccountId: temp.id,
    });
    await mockTestDb.runAsync('DELETE FROM accounts WHERE id = ?', [temp.id]);
    expect((await find(fund.id)).investment?.fundingAccountId).toBeNull();
  });
});

describe('the rule marker', () => {
  it('is set on an entry a recurring rule posts and empty on one made by hand', async () => {
    const fund = await createAccount({ name: 'SIP fund', type: 'savings', tracked: true });
    const cat = (await createCategory({ name: 'Misc', kind: 'expense' })).id;
    const rule = await createRecurringRule({
      type: 'transfer',
      accountId: bank,
      toAccountId: fund.id,
      amountMinor: 500000,
      note: 'SIP',
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: '2026-03-05',
    });
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: cat,
      amountMinor: 100,
      date: '2026-03-06',
    });
    await runDueRecurringRules('2026-03-10');
    const all = await listTransactions({});
    const posted = all.find((t) => t.toAccountId === fund.id)!;
    expect(posted.ruleId).toBe(rule.id);
    expect(all.find((t) => t.type === 'expense')!.ruleId).toBeNull();
  });
});

describe('older installs and backups', () => {
  it('adds the new columns to a database made before them, and is safe to run twice', async () => {
    const db = createRealDataTestDb();
    await db.execAsync(
      `CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR',
         opening_balance_minor INTEGER NOT NULL DEFAULT 0, credit_limit_minor INTEGER, statement_day INTEGER, due_day INTEGER,
         interest_rate_annual_bp INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
       CREATE TABLE transactions (id TEXT PRIMARY KEY, type TEXT NOT NULL, account_id TEXT NOT NULL, amount_minor INTEGER NOT NULL, date TEXT NOT NULL);`
    );
    await runMigrations(db).catch(() => {});
    const cols = async (t: string) =>
      (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols('accounts')).toEqual(expect.arrayContaining(['investment_kind', 'funding_account_id']));
    expect(await cols('transactions')).toContain('rule_id');
  });

  it('round-trips the links and the marker through a backup, now format 5', async () => {
    expect(BACKUP_FORMAT_VERSION).toBe(5);
    const snapshot = await buildBackupSnapshot();
    expect(snapshot.formatVersion).toBe(5);
    const withFund = snapshot.tables.accounts.find((a) => a.investment_kind === 'mutual_fund');
    expect(withFund).toBeDefined();
    await restoreFromSnapshot(snapshot);
    expect((await listAccounts(true)).find((a) => a.name === 'Gold')).toBeDefined();
    expect((await listTransactions({})).some((t) => t.ruleId)).toBe(true);
  });

  it('restores an older backup that has none of the new fields', async () => {
    const snapshot = await buildBackupSnapshot();
    const old = {
      ...snapshot,
      formatVersion: 4,
      tables: {
        ...snapshot.tables,
        accounts: snapshot.tables.accounts.map(
          ({ investment_kind: _k, funding_account_id: _f, ...rest }) => rest
        ),
        transactions: snapshot.tables.transactions.map(({ rule_id: _r, ...rest }) => rest),
      },
    };
    const result = await restoreFromSnapshot(old);
    expect(result.skippedColumns).toEqual([]);
    expect((await listAccounts(true)).every((a) => !a.investment?.kind)).toBe(true);
  });
});
