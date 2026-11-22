/**
 * Hard backup tests on real SQLite: seeded random data round-trips exactly, restore is atomic, and a hostile
 * backup file either restores cleanly or throws leaving the current data untouched.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  buildBackupSnapshotOn,
  restoreFromSnapshotOn,
  BACKUP_FORMAT_VERSION,
  BackupSnapshot,
} from '@/lib/backup';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { createBudget } from '@/db/budgets';
import { createSavingsGoal } from '@/db/savingsGoals';
import { createPerson } from '@/db/people';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';

// mulberry32: deterministic, so a failure reproduces.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const norm = (snap: BackupSnapshot) =>
  Object.fromEntries(
    Object.entries(snap.tables).map(([t, rows]) => [
      t,
      rows.map((r) => JSON.stringify(Object.entries(r).sort())).sort(),
    ])
  );

async function seed(n: number) {
  const r = rng(n);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const accs: string[] = [];
  for (let i = 0; i < 4; i++)
    accs.push(
      (
        await createAccount({
          name: `Acc ${i} ’x’ é😀`,
          type: 'bank',
          currency: 'INR',
          openingBalanceMinor: Math.floor(r() * 1e6),
        })
      ).id
    );
  const cats = [
    (await createCategory({ name: 'Food', kind: 'expense' })).id,
    (await createCategory({ name: 'Pay', kind: 'income' })).id,
  ];
  for (let i = 0; i < 40; i++) {
    const k = pick(['expense', 'income', 'transfer']);
    const a = pick(accs);
    const to = accs.find((x) => x !== a)!;
    await createTransaction({
      type: k as any,
      accountId: a,
      toAccountId: k === 'transfer' ? to : undefined,
      categoryId: k === 'transfer' ? undefined : k === 'expense' ? cats[0] : cats[1],
      amountMinor: 1 + Math.floor(r() * 99999),
      date: `2026-0${1 + Math.floor(r() * 9)}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
      note: pick([
        `it${String.fromCharCode(39)}s`,
        'a"b',
        "x'); DROP TABLE accounts;--",
        '',
        '=1+1',
        '日本語',
      ]),
    } as any);
  }
  await createBudget({ categoryId: cats[0], limitAmountMinor: 12345, rollover: false } as any);
  await createSavingsGoal({ name: 'Trip', targetAmountMinor: 100000 } as any);
  await createPerson({ name: 'Sam' } as any);
}

const snap = () => buildBackupSnapshotOn(mockTestDb as any);
const restore = (s: unknown) => restoreFromSnapshotOn(mockTestDb as any, s as BackupSnapshot);

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

describe('backup round trip', () => {
  it.each([1, 2, 3])('seed %i: snapshot -> restore into a fresh db -> snapshot is identical', async (s) => {
    const db = createRealDataTestDb();
    await db.execAsync(CREATE_TABLES_SQL);
    // seed() writes through the mocked getDb, so wipe it and seed the shared db, then restore into `db`.
    await mockTestDb.execAsync('PRAGMA foreign_keys = OFF;');
    for (const t of [
      'person_ledger_entries',
      'people',
      'budgets',
      'savings_goals',
      'transactions',
      'categories',
      'accounts',
    ])
      await mockTestDb.runAsync(`DELETE FROM ${t}`);
    await mockTestDb.execAsync('PRAGMA foreign_keys = ON;');
    await seed(s);
    const a = await snap();
    expect(a.tables.transactions.length).toBe(40);

    const res = await restoreFromSnapshotOn(db as any, JSON.parse(JSON.stringify(a)));
    expect(res.skippedColumns).toEqual([]);
    const b = await buildBackupSnapshotOn(db as any);
    expect(norm(b)).toEqual(norm(a));
  });

  it('is atomic: a hostile row in the last table leaves existing data untouched', async () => {
    const before = await snap();
    const bad = JSON.parse(JSON.stringify(before));
    bad.tables.settings.push({ key: 'x', value: 'y' }, { key: 'x', value: 'dup' }); // PK clash fails last
    bad.tables.accounts[0].name = 'CHANGED';
    await expect(restore(bad)).rejects.toThrow();
    expect(norm(await snap())).toEqual(norm(before));
    const fk = await mockTestDb.getFirstAsync<any>('PRAGMA foreign_keys');
    expect(fk.foreign_keys).toBe(1);
  });
});

describe('hostile backup files never half-restore', () => {
  let base: BackupSnapshot;
  beforeAll(async () => {
    base = await snap();
  });
  const clone = (): any => JSON.parse(JSON.stringify(base));

  async function expectRejectedUnchanged(mutate: (s: any) => void) {
    const before = norm(await snap());
    const s = clone();
    mutate(s);
    await expect(restore(s)).rejects.toThrow();
    expect(norm(await snap())).toEqual(before);
  }

  it.each([
    ['null', () => null],
    ['string', () => 'x'],
    ['array', () => []],
    ['tables array', (s: any) => ({ ...s, tables: [] })],
    ['tables missing transactions', (s: any) => ({ ...s, tables: { accounts: s.tables.accounts } })],
    ['string formatVersion', (s: any) => ({ ...s, formatVersion: '6' })],
    ['NaN formatVersion', (s: any) => ({ ...s, formatVersion: NaN })],
    ['zero formatVersion', (s: any) => ({ ...s, formatVersion: 0 })],
    ['future formatVersion', (s: any) => ({ ...s, formatVersion: BACKUP_FORMAT_VERSION + 1 })],
    ['huge formatVersion', (s: any) => ({ ...s, formatVersion: 2 ** 60 })],
  ])('rejects bad shape: %s', async (_n, f) => {
    const before = norm(await snap());
    await expect(restore((f as any)(clone()))).rejects.toThrow();
    expect(norm(await snap())).toEqual(before);
  });

  it('rejects a table that is not an array of plain objects', async () => {
    await expectRejectedUnchanged((s) => (s.tables.categories = 'nope'));
    await expectRejectedUnchanged((s) => (s.tables.categories = [1, 2]));
    await expectRejectedUnchanged((s) => (s.tables.categories = [[]]));
    await expectRejectedUnchanged((s) => (s.tables.categories = [null]));
  });

  it.each([
    ['beyond safe integer', 2 ** 60],
    ['fraction', 1.5],
    ['NaN string', 'NaN'],
    ['text', '12abc'],
    ['1e400 (Infinity)', 1e400],
  ])('rejects bad _minor amount: %s', async (_n, v) => {
    await expectRejectedUnchanged((s) => (s.tables.transactions[0].amount_minor = v));
  });

  it('rejects invalid dates', async () => {
    for (const d of ['2026-13-01', '2026-02-30', 'not a date', '', 20260101, '2026-1-1'])
      await expectRejectedUnchanged((s) => (s.tables.transactions[0].date = d));
  });

  it('rejects dangling foreign keys', async () => {
    await expectRejectedUnchanged((s) => (s.tables.transactions[0].account_id = 'ghost'));
    await expectRejectedUnchanged((s) => (s.tables.transactions[0].category_id = 'ghost'));
  });

  it('rejects duplicate ids', async () => {
    await expectRejectedUnchanged((s) => s.tables.accounts.push({ ...s.tables.accounts[0] }));
    await expectRejectedUnchanged((s) => s.tables.transactions.push({ ...s.tables.transactions[0] }));
  });

  it('rejects an amount above MAX_AMOUNT_MINOR and leaves data untouched', async () => {
    await expectRejectedUnchanged((s) => (s.tables.transactions[0].amount_minor = MAX_AMOUNT_MINOR + 1));
  });

  it('ignores unknown tables and columns, reports the columns, and treats pollution keys as data', async () => {
    const s = clone();
    s.tables.evil = [{ a: 1 }];
    s.tables.accounts[0].bogus_col = 'x';
    s.tables.accounts[0]['x"; DROP TABLE accounts; --'] = 'x';
    const payload = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted2":true}},"id":"zz"}'
    );
    s.tables.people.push({ ...base.tables.people[0], ...payload, id: 'proto-person' });
    s.tables.__proto__ = [{ polluted: 1 }];
    const res = await restore(s);
    expect(res.skippedColumns).toEqual(
      expect.arrayContaining(['accounts.bogus_col', 'accounts.x"; DROP TABLE accounts; --'])
    );
    expect(({} as any).polluted).toBeUndefined();
    expect(({} as any).polluted2).toBeUndefined();
    const t = await mockTestDb.getFirstAsync('SELECT name FROM sqlite_master WHERE name = ?', ['accounts']);
    expect(t).toBeTruthy();
    expect((await snap()).tables.accounts.length).toBe(base.tables.accounts.length);
    await restore(base);
  });

  it('missing optional tables restore cleanly and report what was emptied', async () => {
    const s = clone();
    delete s.tables.budgets;
    const res = await restore(s);
    expect(res.emptiedTables).toEqual(expect.arrayContaining(['budgets']));
    expect((await snap()).tables.budgets).toEqual([]);
    await restore(base);
  });

  it('keeps SQL metacharacters and a 5MB string as plain data', async () => {
    const s = clone();
    const big = 'é'.repeat((5 * 1024 * 1024) / 2);
    s.tables.transactions[0].note = big;
    s.tables.transactions[1].note = '\'; DELETE FROM transactions; -- " ? :a $b';
    await restore(s);
    const out = await snap();
    expect(out.tables.transactions.find((r) => r.id === s.tables.transactions[0].id)!.note).toBe(big);
    expect(out.tables.transactions.length).toBe(base.tables.transactions.length);
    await restore(base);
  });
});
