/**
 * A card's minimum due and a holding's units, yearly rate and maturity: validated on save, kept or cleared on
 * edit, added to older databases, and carried through a backup.
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
import { createAccount, updateAccount, listAccounts, setHoldingUnits } from '@/db/accounts';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

const find = async (id: string) => (await listAccounts(true)).find((a) => a.id === id)!;

describe('card minimum due', () => {
  it('saves a share and a floor on a card and reads them back', async () => {
    const card = await createAccount({
      name: 'Regalia',
      type: 'credit_card',
      statementDay: 5,
      dueDay: 25,
      minDueBp: 500,
      minDueFloorMinor: 20_000,
    });
    const read = await find(card.id);
    expect(read.minDueBp).toBe(500);
    expect(read.minDueFloorMinor).toBe(20_000);
  });

  it('keeps none on an account that is not a card, and clears them when the type changes', async () => {
    const bank = await createAccount({ name: 'HDFC', type: 'bank', minDueBp: 500 });
    expect((await find(bank.id)).minDueBp).toBeNull();
    const card = await createAccount({ name: 'Card', type: 'credit_card', minDueBp: 500 });
    await updateAccount(card.id, { name: 'Card', type: 'bank', openingBalanceMinor: 0 });
    expect((await find(card.id)).minDueBp).toBeNull();
  });

  it('can be edited and cleared', async () => {
    const card = await createAccount({ name: 'Edit me', type: 'credit_card', minDueBp: 500 });
    await updateAccount(card.id, {
      name: 'Edit me',
      type: 'credit_card',
      openingBalanceMinor: 0,
      minDueBp: 300,
      minDueFloorMinor: 10_000,
    });
    expect(await find(card.id)).toMatchObject({ minDueBp: 300, minDueFloorMinor: 10_000 });
    await updateAccount(card.id, { name: 'Edit me', type: 'credit_card', openingBalanceMinor: 0 });
    expect((await find(card.id)).minDueBp).toBeNull();
  });

  it('refuses a share over 100% or a negative floor', async () => {
    await expect(createAccount({ name: 'x', type: 'credit_card', minDueBp: 10_001 })).rejects.toThrow(
      /0% and 100%/
    );
    await expect(createAccount({ name: 'x', type: 'credit_card', minDueFloorMinor: -1 })).rejects.toThrow(
      /floor/
    );
  });
});

describe('holding units, rate and maturity', () => {
  it('saves them on a tracked account and reads them back', async () => {
    const fd = await createAccount({
      name: 'SBI FD',
      type: 'savings',
      tracked: true,
      investmentKind: 'fixed_deposit',
      rateBp: 710,
      maturityDate: '2027-03-01',
      units: 12.5,
    });
    const read = await find(fd.id);
    expect(read.interestRateAnnualBp).toBe(710);
    expect(read.investment).toMatchObject({ maturityDate: '2027-03-01', units: 12.5 });
  });

  it('ignores them on an account that is not tracked', async () => {
    const plain = await createAccount({
      name: 'Rainy day',
      type: 'savings',
      rateBp: 710,
      maturityDate: '2027-03-01',
      units: 3,
    });
    const read = await find(plain.id);
    expect(read.investment).toBeUndefined();
    expect(read.interestRateAnnualBp).toBeNull();
  });

  it('keeps them when an edit omits them, and changes or clears them when given', async () => {
    const fd = await createAccount({
      name: 'Keep',
      type: 'savings',
      tracked: true,
      investmentKind: 'fixed_deposit',
      rateBp: 700,
      maturityDate: '2027-03-01',
    });
    const base = { name: 'Keep', type: 'savings' as const, openingBalanceMinor: 0, tracked: true };
    await updateAccount(fd.id, { ...base, investmentKind: 'fixed_deposit' });
    expect(await find(fd.id)).toMatchObject({
      interestRateAnnualBp: 700,
      investment: expect.objectContaining({ maturityDate: '2027-03-01' }),
    });
    await updateAccount(fd.id, { ...base, investmentKind: 'fixed_deposit', rateBp: 650, maturityDate: null });
    const read = await find(fd.id);
    expect(read.interestRateAnnualBp).toBe(650);
    expect(read.investment?.maturityDate).toBeNull();
  });

  it('remembers units after a value update and clears them with null', async () => {
    const fund = await createAccount({ name: 'Units', type: 'savings', tracked: true });
    await setHoldingUnits(fund.id, 123.456);
    expect((await find(fund.id)).investment?.units).toBe(123.456);
    await setHoldingUnits(fund.id, null);
    expect((await find(fund.id)).investment?.units).toBeNull();
  });

  it('refuses a rate over 100%, a bad date or negative units', async () => {
    const make = (extra: object) => createAccount({ name: 'x', type: 'savings', tracked: true, ...extra });
    await expect(make({ rateBp: 10_001 })).rejects.toThrow(/rate/i);
    await expect(make({ maturityDate: '1 March' })).rejects.toThrow(/date/i);
    await expect(make({ units: -1 })).rejects.toThrow(/units/i);
  });
});

describe('older databases and backups', () => {
  it('adds the new columns to a database made before them, and is safe to run twice', async () => {
    const db = createRealDataTestDb();
    await db.execAsync(
      `CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR',
         opening_balance_minor INTEGER NOT NULL DEFAULT 0, credit_limit_minor INTEGER, statement_day INTEGER, due_day INTEGER,
         interest_rate_annual_bp INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
       CREATE TABLE transactions (id TEXT PRIMARY KEY, type TEXT NOT NULL, account_id TEXT NOT NULL, amount_minor INTEGER NOT NULL, date TEXT NOT NULL);`
    );
    await runMigrations(db).catch(() => {});
    await runMigrations(db).catch(() => {});
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(accounts)')).map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(['min_due_bp', 'min_due_floor_minor', 'units', 'maturity_date'])
    );
  });

  it('round-trips them through a backup', async () => {
    await createAccount({
      name: 'Backed card',
      type: 'credit_card',
      minDueBp: 300,
      minDueFloorMinor: 15_000,
    });
    await createAccount({
      name: 'Backed FD',
      type: 'savings',
      tracked: true,
      investmentKind: 'fixed_deposit',
      rateBp: 640,
      maturityDate: '2028-01-15',
      units: 7.25,
    });
    const snapshot = await buildBackupSnapshot();
    expect(snapshot.tables.accounts.some((a) => a.min_due_bp === 300)).toBe(true);
    expect(snapshot.tables.accounts.some((a) => a.maturity_date === '2028-01-15' && a.units === 7.25)).toBe(
      true
    );
    await restoreFromSnapshot(snapshot);
    const after = await listAccounts(true);
    expect(after.find((a) => a.name === 'Backed card')).toMatchObject({
      minDueBp: 300,
      minDueFloorMinor: 15_000,
    });
    expect(after.find((a) => a.name === 'Backed FD')).toMatchObject({
      interestRateAnnualBp: 640,
      investment: expect.objectContaining({ maturityDate: '2028-01-15', units: 7.25 }),
    });
  });
});
