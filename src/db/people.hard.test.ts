/** People ledger: random lent/borrowed/settled sequences with paise against a signed-sum reference (real SQLite). */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

let mockDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
jest.mock('./spendAlerts', () => ({ queueSpendAlerts: jest.fn(async () => {}) }));

import { CREATE_TABLES_SQL } from './schema';
import { createAccount, createCategory } from './ledger';
import {
  createPerson,
  addLedgerEntry,
  listPeople,
  getPersonLedger,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  undoPersonTransaction,
  deleteLedgerEntry,
  restoreLedgerEntry,
} from './people';
import { queueSpendAlerts } from './spendAlerts';
import { toLocalIsoDate } from '@/lib/date';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let accountId: string;
let categoryId: string;
const today = toLocalIsoDate(new Date());

beforeEach(async () => {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  accountId = (await createAccount({ name: 'Bank', type: 'bank', openingBalanceMinor: 100_000_000 })).id;
  categoryId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  (queueSpendAlerts as jest.Mock).mockClear();
});

const balanceOf = async (id: string) => (await listPeople()).find((p) => p.id === id)!.balanceMinor;
const sum = async (id: string) => (await getPersonLedger(id)).reduce((s, e) => s + e.amountMinor, 0);
const accountBalance = async () =>
  (await mockDb.getFirstAsync<{ b: number }>(
    `SELECT 100000000 + COALESCE(SUM(CASE type WHEN 'income' THEN amount_minor WHEN 'expense' THEN -amount_minor END),0) AS b FROM transactions`
  ))!.b;

describe('balance is the signed sum of entries', () => {
  it.each([1, 2, 3, 4, 5, 6])('random sequence, seed %i', async (seed) => {
    const r = rng(seed);
    const people = [await createPerson({ name: 'Asha' }), await createPerson({ name: 'Ravi' })];
    const expected = [0, 0];
    let expectedAccount = 100_000_000;
    const txIds: { tx: string; p: number; amt: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const pi = r() < 0.5 ? 0 : 1;
      const amt = 1 + Math.floor(r() * 250_000); // paise
      const date = `2026-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`;
      const kind = Math.floor(r() * 4);
      if (kind === 0) {
        await recordMoneyGivenToPerson({
          personId: people[pi].id,
          accountId,
          categoryId,
          amountMinor: amt,
          date,
        });
        expected[pi] += amt;
        expectedAccount -= amt;
      } else if (kind === 1) {
        await recordMoneyReceivedFromPerson({
          personId: people[pi].id,
          accountId,
          categoryId,
          amountMinor: amt,
          date,
        });
        expected[pi] -= amt;
        expectedAccount += amt;
      } else {
        const signed = kind === 2 ? amt : -amt;
        await addLedgerEntry({ personId: people[pi].id, amountMinor: signed, date, note: 'adj' });
        expected[pi] += signed;
      }
    }
    for (let i = 0; i < 2; i++) {
      expect(await balanceOf(people[i].id)).toBe(expected[i]);
      expect(await sum(people[i].id)).toBe(expected[i]);
    }
    expect(await accountBalance()).toBe(expectedAccount);
    void txIds;
  });

  it('settle-up with an equal and opposite entry zeroes the balance', async () => {
    const p = await createPerson({ name: 'Asha' });
    for (const a of [1, 99, 12345, 7, 100_001])
      await addLedgerEntry({ personId: p.id, amountMinor: a, date: '2026-03-03' });
    await addLedgerEntry({ personId: p.id, amountMinor: -300, date: '2026-03-04' });
    const bal = await balanceOf(p.id);
    expect(bal).toBe(1 + 99 + 12345 + 7 + 100_001 - 300);
    await addLedgerEntry({ personId: p.id, amountMinor: -bal, date: '2026-03-05', note: 'settled' });
    expect(await balanceOf(p.id)).toBe(0);
    // Settling through a real payment-back moves money and zeroes it too.
    await recordMoneyGivenToPerson({
      personId: p.id,
      accountId,
      categoryId,
      amountMinor: 1050,
      date: '2026-04-01',
    });
    await recordMoneyReceivedFromPerson({
      personId: p.id,
      accountId,
      categoryId,
      amountMinor: 1050,
      date: '2026-04-02',
    });
    expect(await balanceOf(p.id)).toBe(0);
  });

  it('borrowed (you owe) goes negative, with paise', async () => {
    const p = await createPerson({ name: 'Ravi' });
    await recordMoneyReceivedFromPerson({
      personId: p.id,
      accountId,
      categoryId,
      amountMinor: 12_345,
      date: '2026-02-02',
    });
    expect(await balanceOf(p.id)).toBe(-12_345);
  });
});

describe('invalid input', () => {
  it('rejects zero, fractional, NaN, huge and malformed-date entries', async () => {
    const p = await createPerson({ name: 'Asha' });
    for (const amountMinor of [0, 1.5, NaN, Infinity, 2 ** 60]) {
      await expect(addLedgerEntry({ personId: p.id, amountMinor, date: '2026-01-01' })).rejects.toThrow();
    }
    for (const date of ['', '2026-13-01', '2026-02-30', 'yesterday', '2026-1-1']) {
      await expect(addLedgerEntry({ personId: p.id, amountMinor: 5, date })).rejects.toThrow();
    }
    expect(await sum(p.id)).toBe(0);
  });
  it('rejects a person with an empty or duplicate name (case/space-insensitive)', async () => {
    await createPerson({ name: 'Asha' });
    await expect(createPerson({ name: '  ' })).rejects.toThrow();
    await expect(createPerson({ name: ' aSHa ' })).rejects.toThrow();
  });
  it('an entry for a missing person fails and leaves nothing behind', async () => {
    await expect(addLedgerEntry({ personId: 'nope', amountMinor: 5, date: '2026-01-01' })).rejects.toThrow();
    await expect(
      recordMoneyGivenToPerson({
        personId: 'nope',
        accountId,
        categoryId,
        amountMinor: 500,
        date: '2026-01-01',
      })
    ).rejects.toThrow();
    expect(await accountBalance()).toBe(100_000_000);
  });
});

describe('undo and delete', () => {
  it('undoPersonTransaction removes the entry and the transaction together', async () => {
    const p = await createPerson({ name: 'Asha' });
    await recordMoneyGivenToPerson({
      personId: p.id,
      accountId,
      categoryId,
      amountMinor: 777,
      date: '2026-05-05',
    });
    await recordMoneyGivenToPerson({
      personId: p.id,
      accountId,
      categoryId,
      amountMinor: 33,
      date: '2026-05-06',
    });
    const [e] = (await getPersonLedger(p.id)).filter((x) => x.amountMinor === 777);
    await undoPersonTransaction(e.transactionId!);
    expect(await balanceOf(p.id)).toBe(33);
    expect(await accountBalance()).toBe(100_000_000 - 33);
    await expect(undoPersonTransaction(e.transactionId!)).rejects.toThrow();
  });
  it('undo refuses a transaction that is not a Friends & Family one', async () => {
    await mockDb.runAsync(
      "INSERT INTO transactions (id,type,account_id,category_id,amount_minor,date) VALUES ('x','expense',?,?,5,'2026-01-01')",
      [accountId, categoryId]
    );
    await expect(undoPersonTransaction('x')).rejects.toThrow();
    expect(await mockDb.getFirstAsync('SELECT id FROM transactions WHERE id = ?', ['x'])).toBeTruthy();
  });
  it('delete then restore round-trips balance and account, for linked and plain entries', async () => {
    const p = await createPerson({ name: 'Asha' });
    await recordMoneyGivenToPerson({
      personId: p.id,
      accountId,
      categoryId,
      amountMinor: 4_250,
      date: '2026-05-05',
    });
    await addLedgerEntry({ personId: p.id, amountMinor: 1_999, date: '2026-05-06' });
    const before = { bal: await balanceOf(p.id), acc: await accountBalance() };
    for (const e of await getPersonLedger(p.id)) {
      const snaps = await deleteLedgerEntry(e.id);
      expect(await balanceOf(p.id)).toBe(before.bal - e.amountMinor);
      await restoreLedgerEntry(snaps);
      expect({ bal: await balanceOf(p.id), acc: await accountBalance() }).toEqual(before);
    }
    await expect(deleteLedgerEntry('missing')).rejects.toThrow();
  });
  it('random deletes keep the balance equal to the sum of what is left', async () => {
    const r = rng(42);
    const p = await createPerson({ name: 'Asha' });
    for (let i = 0; i < 25; i++) {
      const amt = 1 + Math.floor(r() * 9999);
      if (r() < 0.5)
        await recordMoneyGivenToPerson({
          personId: p.id,
          accountId,
          categoryId,
          amountMinor: amt,
          date: '2026-06-01',
        });
      else await addLedgerEntry({ personId: p.id, amountMinor: r() < 0.5 ? amt : -amt, date: '2026-06-02' });
    }
    for (let i = 0; i < 12; i++) {
      const list = await getPersonLedger(p.id);
      await deleteLedgerEntry(list[Math.floor(r() * list.length)].id);
      expect(await balanceOf(p.id)).toBe(await sum(p.id));
    }
    // Every remaining transaction still has its ledger entry and vice versa.
    const orphans = await mockDb.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions t WHERE NOT EXISTS (SELECT 1 FROM person_ledger_entries e WHERE e.transaction_id = t.id)`
    );
    expect(orphans!.n).toBe(0);
  });
  it('an archived person is hidden unless asked for, and keeps its balance', async () => {
    const p = await createPerson({ name: 'Asha' });
    await addLedgerEntry({ personId: p.id, amountMinor: 50, date: '2026-01-01' });
    await mockDb.runAsync('UPDATE people SET archived = 1 WHERE id = ?', [p.id]);
    expect((await listPeople()).length).toBe(0);
    expect((await listPeople(true))[0].balanceMinor).toBe(50);
  });
});

describe('alerts', () => {
  it('backdated entries never queue current-month spend alerts; this-month ones do', async () => {
    const p = await createPerson({ name: 'Asha' });
    const base = { personId: p.id, accountId, categoryId, amountMinor: 123 };
    for (const date of ['2020-01-05', '2025-12-31', '2026-01-01'])
      await recordMoneyGivenToPerson({ ...base, date });
    expect(queueSpendAlerts).not.toHaveBeenCalled();
    await recordMoneyReceivedFromPerson({ ...base, date: today });
    expect(queueSpendAlerts).not.toHaveBeenCalled(); // income never alerts
    await recordMoneyGivenToPerson({ ...base, date: today });
    expect(queueSpendAlerts).toHaveBeenCalledTimes(1);
  });
});
