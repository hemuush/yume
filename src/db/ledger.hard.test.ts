/**
 * Hard ledger tests: a seeded random operation sequence checked after every step against an independent model,
 * plus rejected amounts, concurrent double operations and hostile text. Real SQLite, serialised like client.ts.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockRaw = createRealDataTestDb();
let mockChain: Promise<unknown> = Promise.resolve();
function mockSerialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = mockChain.then(fn, fn);
  mockChain = run.then(
    () => {},
    () => {}
  );
  return run;
}
const mockTestDb = {
  getFirstAsync: <T>(sql: string, p?: any[]) => mockSerialize(() => mockRaw.getFirstAsync<T>(sql, p)),
  getAllAsync: <T>(sql: string, p?: any[]) => mockSerialize(() => mockRaw.getAllAsync<T>(sql, p)),
  runAsync: (sql: string, p?: any[]) => mockSerialize(() => mockRaw.runAsync(sql, p)),
  execAsync: (sql: string) => mockSerialize(() => mockRaw.execAsync(sql)),
  withTransactionAsync: (fn: (tx: typeof mockRaw) => Promise<void>) =>
    mockSerialize(() => mockRaw.withTransactionAsync(fn)),
  exclusiveAsync: <T>(fn: (db: typeof mockRaw) => Promise<T>) => mockSerialize(() => fn(mockRaw)),
};
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
  restoreAccount,
  getAccountBalance,
  createCategory,
  archiveCategory,
  deleteCategory,
  restoreCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
} from '@/db/ledger';
import { saveSplit, deleteSplit, restoreSplit } from '@/db/splits';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';

const one = <T>(sql: string, p: any[] = []) => mockTestDb.getFirstAsync<T>(sql, p);
const all = <T>(sql: string, p: any[] = []) => mockTestDb.getAllAsync<T>(sql, p);

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});
beforeEach(async () => {
  for (const sql of [
    'DELETE FROM transactions',
    'DELETE FROM deleted_entries',
    'DELETE FROM budgets',
    'DELETE FROM accounts',
    'DELETE FROM categories WHERE is_system = 0',
  ])
    await mockTestDb.runAsync(sql, []);
});

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type MTx = {
  type: 'expense' | 'income' | 'transfer';
  acct: string;
  to?: string;
  cat?: string;
  amt: number;
  split?: string;
};
type MAcct = { opening: number; type: string; archived: boolean };

const DATES = ['2025-01-05', '2025-02-10', '2025-03-15', '2025-04-20', '2025-05-25'];

describe('random ledger operation sequences match an independent model', () => {
  it.each([1, 7, 42, 1337, 99991])(
    'seed %i',
    async (seed) => {
      const r = rng(seed);
      const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
      const accts = new Map<string, MAcct>();
      const txs = new Map<string, MTx>();
      const catsLive = new Map<string, 'expense' | 'income'>(); // not deleted
      const delTx: { snap: any; id: string; tx: MTx }[] = [];
      const delSplit: { snaps: any[]; ids: string[]; txs: MTx[] }[] = [];
      const delAcct: { snap: any; id: string; a: MAcct }[] = [];
      const delCat: { snaps: any[]; id: string; kind: 'expense' | 'income' }[] = [];
      let n = 0;
      const amount = () => 1 + Math.floor(r() * 5_000_00) + (r() < 0.3 ? 0 : 0); // paise-level integers

      const mkAcct = async (type: 'bank' | 'cash' | 'savings') => {
        const opening = Math.floor(r() * 1_000_000) - 200_000;
        const a = await createAccount({
          name: `A${n++}`,
          type,
          currency: 'INR',
          openingBalanceMinor: opening,
        });
        accts.set(a.id, { opening, type, archived: false });
      };
      const mkCat = async (kind: 'expense' | 'income') => {
        const c = await createCategory({ name: `C${n++}`, kind });
        catsLive.set(c.id, kind);
      };
      await mkAcct('bank');
      await mkAcct('cash');
      await mkAcct('savings');
      await mkCat('expense');
      await mkCat('income');

      const spendable = () => [...accts].filter(([, a]) => a.type !== 'savings').map(([id]) => id);
      const catOf = (kind: string) => [...catsLive].filter(([, k]) => k === kind).map(([id]) => id);
      const used = (acct: string) => [...txs.values()].some((t) => t.acct === acct || t.to === acct);
      const live = (id: string) => accts.has(id);

      const expected = (id: string) => {
        const a = accts.get(id)!;
        let b = a.opening;
        for (const t of txs.values()) {
          if (t.type === 'income' && t.acct === id) b += t.amt;
          if (t.type === 'expense' && t.acct === id) b -= t.amt;
          if (t.type === 'transfer') {
            if (t.to === id) b += t.amt;
            if (t.acct === id) b -= t.amt;
          }
        }
        return b;
      };

      const check = async (step: string) => {
        let sum = 0;
        for (const id of accts.keys()) {
          const got = await getAccountBalance(id);
          if (got !== expected(id))
            throw new Error(`seed ${seed} ${step}: balance ${got} != ${expected(id)} for ${id}`);
          sum += got;
        }
        let flow = 0;
        for (const a of accts.values()) flow += a.opening;
        for (const t of txs.values()) flow += t.type === 'income' ? t.amt : t.type === 'expense' ? -t.amt : 0;
        if (sum !== flow)
          throw new Error(`seed ${seed} ${step}: sum ${sum} != ${flow} (transfers must conserve)`);
        const c = await one<{ n: number }>('SELECT COUNT(*) AS n FROM transactions');
        if (c?.n !== txs.size) throw new Error(`seed ${seed} ${step}: ${c?.n} rows != ${txs.size}`);
      };

      for (let step = 0; step < 260; step++) {
        const op = Math.floor(r() * 16);
        const label = `${step}/op${op}`;
        const date = pick(DATES);
        if (op <= 2) {
          const type = pick(['expense', 'income', 'transfer'] as const);
          const sp = spendable();
          if (type === 'transfer') {
            const ids = [...accts.keys()];
            const from = pick(ids);
            const to = pick(ids);
            const amt = amount();
            if (from === to) {
              await expect(
                createTransaction({ type, accountId: from, toAccountId: to, amountMinor: amt, date })
              ).rejects.toThrow(/same account/);
            } else {
              const t = await createTransaction({
                type,
                accountId: from,
                toAccountId: to,
                amountMinor: amt,
                date,
              });
              txs.set(t.id, { type, acct: from, to, amt });
            }
          } else {
            const cats = catOf(type);
            const savings = pick([...accts].filter(([, a]) => a.type === 'savings').map(([id]) => id));
            if (r() < 0.15 && savings && cats.length) {
              await expect(
                createTransaction({ type, accountId: savings, categoryId: cats[0], amountMinor: 100, date })
              ).rejects.toThrow(/Savings accounts/);
            } else if (sp.length && cats.length) {
              const acct = pick(sp);
              const cat = pick(cats);
              const amt = amount();
              const t = await createTransaction({
                type,
                accountId: acct,
                categoryId: cat,
                amountMinor: amt,
                date,
              });
              txs.set(t.id, { type, acct, cat, amt });
            }
          }
        } else if (op === 3 || op === 4) {
          const plain = [...txs].filter(([, t]) => !t.split && t.type !== 'transfer');
          if (plain.length) {
            const [id, t] = pick(plain);
            const sp = spendable();
            const acct = pick(sp);
            const amt = amount();
            await updateTransaction(id, {
              type: t.type,
              accountId: acct,
              categoryId: t.cat,
              amountMinor: amt,
              date,
            });
            txs.set(id, { ...t, acct, amt });
          }
        } else if (op === 5 || op === 6) {
          const plain = [...txs].filter(([, t]) => !t.split);
          if (plain.length) {
            const [id, t] = pick(plain);
            const snap = await deleteTransaction(id, { keep: r() < 0.5 });
            txs.delete(id);
            delTx.push({ snap, id, tx: t });
            await expect(deleteTransaction(id)).rejects.toThrow(/already deleted/);
          }
        } else if (op === 7) {
          const ok = delTx.filter(
            (d) => live(d.tx.acct) && (!d.tx.to || live(d.tx.to)) && (!d.tx.cat || catsLive.has(d.tx.cat))
          );
          if (ok.length) {
            const d = pick(ok);
            delTx.splice(delTx.indexOf(d), 1);
            await restoreTransaction(d.snap);
            txs.set(d.id, d.tx);
          }
        } else if (op === 8) {
          const sp = spendable();
          const cats = catOf('expense');
          if (sp.length && cats.length) {
            const acct = pick(sp);
            const parts = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({
              categoryId: pick(cats),
              amountMinor: amount(),
            }));
            const sid = await saveSplit({ accountId: acct, date, parts });
            const rows = await all<{ id: string; amount_minor: number }>(
              'SELECT id, amount_minor FROM transactions WHERE split_id = ?',
              [sid]
            );
            expect(rows).toHaveLength(parts.length);
            for (const row of rows)
              txs.set(row.id, {
                type: 'expense',
                acct,
                cat: parts[0].categoryId,
                amt: row.amount_minor,
                split: sid,
              });
          }
        } else if (op === 9) {
          const sids = [...new Set([...txs.values()].map((t) => t.split).filter(Boolean))] as string[];
          if (sids.length) {
            const sid = pick(sids);
            const snaps = await deleteSplit(sid);
            const ids: string[] = [];
            const gone: MTx[] = [];
            for (const [id, t] of [...txs])
              if (t.split === sid) {
                ids.push(id);
                gone.push(t);
                txs.delete(id);
              }
            expect(snaps).toHaveLength(ids.length);
            delSplit.push({ snaps, ids, txs: gone });
          }
        } else if (op === 10) {
          const ok = delSplit.filter((d) => d.txs.every((t) => live(t.acct)));
          if (ok.length) {
            const d = pick(ok);
            delSplit.splice(delSplit.indexOf(d), 1);
            await restoreSplit(d.snaps);
            d.ids.forEach((id, i) => txs.set(id, d.txs[i]));
          }
        } else if (op === 11) {
          const roll = r();
          if (roll < 0.3) await mkAcct(pick(['bank', 'cash', 'savings'] as const));
          else if (roll < 0.6) {
            const [id, a] = pick([...accts]);
            const opening = Math.floor(r() * 1_000_000);
            await updateAccount(id, { name: `U${n++}`, type: a.type as any, openingBalanceMinor: opening });
            accts.set(id, { ...a, opening });
          } else if (roll < 0.8) {
            const [id, a] = pick([...accts]);
            if (a.archived) await unarchiveAccount(id);
            else await archiveAccount(id);
            accts.set(id, { ...a, archived: !a.archived });
          } else {
            const [id, a] = pick([...accts]);
            if (used(id)) await expect(deleteAccount(id)).rejects.toThrow(/against it/);
            else {
              const snap = await deleteAccount(id);
              accts.delete(id);
              delAcct.push({ snap, id, a });
            }
          }
        } else if (op === 12) {
          if (delAcct.length) {
            const d = pick(delAcct);
            delAcct.splice(delAcct.indexOf(d), 1);
            await restoreAccount(d.snap);
            accts.set(d.id, d.a);
          }
        } else if (op === 13) {
          // archived categories keep their entries, so balances must not move
          const [id] = pick([...catsLive]);
          await archiveCategory(id);
        } else if (op === 14) {
          const [id, kind] = pick([...catsLive]);
          const inUse = [...txs.values()].some((t) => t.cat === id);
          if (inUse) await expect(deleteCategory(id)).rejects.toThrow(/against it/);
          else {
            const snaps = await deleteCategory(id);
            catsLive.delete(id);
            delCat.push({ snaps, id, kind });
          }
        } else if (op === 15) {
          if (delCat.length) {
            const d = pick(delCat);
            delCat.splice(delCat.indexOf(d), 1);
            try {
              await restoreCategory(d.snaps);
              catsLive.set(d.id, d.kind);
            } catch (e) {
              // an active same-named category appeared meanwhile: acceptable only for that reason
              expect(String(e)).toMatch(/already an active category|already a category/);
              catsLive.delete(d.id);
            }
          }
        }
        // Archived categories can't be reused by the model's pickers cleanly, so keep at least one live of each kind.
        if (!catOf('expense').length) await mkCat('expense');
        if (!catOf('income').length) await mkCat('income');
        await check(label);
      }
    },
    120_000
  );
});

describe('amount validation', () => {
  let bank: string;
  let cat: string;
  beforeEach(async () => {
    bank = (await createAccount({ name: 'B', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    cat = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  });
  const mk = (amountMinor: number) =>
    createTransaction({ type: 'expense', accountId: bank, categoryId: cat, amountMinor, date: '2025-01-01' });

  it.each([
    0,
    -1,
    -0.5,
    1.5,
    100.01,
    NaN,
    Infinity,
    -Infinity,
    MAX_AMOUNT_MINOR + 1,
    MAX_AMOUNT_MINOR + 0.5,
    Number.MAX_SAFE_INTEGER,
  ])('rejects %p and writes nothing', async (amt) => {
    await expect(mk(amt)).rejects.toThrow();
    expect((await one<{ n: number }>('SELECT COUNT(*) AS n FROM transactions'))?.n).toBe(0);
  });
  it('accepts exactly 1 paisa and exactly MAX_AMOUNT_MINOR', async () => {
    await mk(1);
    await mk(MAX_AMOUNT_MINOR);
    expect(await getAccountBalance(bank)).toBe(-(MAX_AMOUNT_MINOR + 1));
  });
  it('update rejects bad amounts and leaves the entry untouched', async () => {
    const t = await mk(500);
    for (const amt of [0, 1.5, MAX_AMOUNT_MINOR + 1]) {
      await expect(
        updateTransaction(t.id, {
          type: 'expense',
          accountId: bank,
          categoryId: cat,
          amountMinor: amt,
          date: '2025-01-01',
        })
      ).rejects.toThrow();
    }
    expect(await getAccountBalance(bank)).toBe(-500);
  });
  it('rejects an invalid date and a missing category', async () => {
    await expect(
      createTransaction({
        type: 'expense',
        accountId: bank,
        categoryId: cat,
        amountMinor: 1,
        date: '2025-13-40',
      })
    ).rejects.toThrow();
    await expect(
      createTransaction({ type: 'expense', accountId: bank, amountMinor: 1, date: '2025-01-01' })
    ).rejects.toThrow(/category/);
  });
});

describe('concurrent double operations', () => {
  it('double delete deletes once, double restore leaves one row, balances exact', async () => {
    const bank = (
      await createAccount({ name: 'B', type: 'bank', currency: 'INR', openingBalanceMinor: 1000 })
    ).id;
    const cat = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    const t = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: cat,
      amountMinor: 250,
      date: '2025-01-01',
    });
    const del = await Promise.allSettled([deleteTransaction(t.id), deleteTransaction(t.id)]);
    expect(del.filter((d) => d.status === 'fulfilled')).toHaveLength(1);
    expect(await getAccountBalance(bank)).toBe(1000);
    const snap = (del.find((d) => d.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
    const res = await Promise.allSettled([restoreTransaction(snap), restoreTransaction(snap)]);
    expect(res.filter((d) => d.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect((await one<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE id = ?', [t.id]))?.n).toBe(
      1
    );
    expect(await getAccountBalance(bank)).toBe(750);
  });

  it('many parallel creates and a parallel account delete never lose or double-count money', async () => {
    const a = (await createAccount({ name: 'A', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    const b = (await createAccount({ name: 'B', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })).id;
    const cat = (await createCategory({ name: 'Inc', kind: 'income' })).id;
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 2
          ? createTransaction({
              type: 'transfer',
              accountId: a,
              toAccountId: b,
              amountMinor: 3,
              date: '2025-01-01',
            })
          : createTransaction({
              type: 'income',
              accountId: a,
              categoryId: cat,
              amountMinor: 7,
              date: '2025-01-01',
            })
      )
    );
    expect((await getAccountBalance(a)) + (await getAccountBalance(b))).toBe(70);
    const dels = await Promise.allSettled([deleteAccount(a), deleteAccount(a)]);
    expect(dels.every((d) => d.status === 'rejected')).toBe(true); // it has history
    const empty = (await createAccount({ name: 'E', type: 'cash', currency: 'INR' })).id;
    const two = await Promise.allSettled([deleteAccount(empty), deleteAccount(empty)]);
    expect(two.filter((d) => d.status === 'fulfilled')).toHaveLength(1);
    const snap = (two.find((d) => d.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
    await restoreAccount(snap);
    expect(await getAccountBalance(empty)).toBe(0);
  });

  it('archive and category double operations stay consistent', async () => {
    const c = (await createCategory({ name: 'Gone', kind: 'expense' })).id;
    const r = await Promise.allSettled([deleteCategory(c), deleteCategory(c)]);
    const ok = r.filter((x) => x.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    expect(ok.length).toBeGreaterThanOrEqual(1);
    await restoreCategory(ok[0].value);
    expect((await one<{ n: number }>('SELECT COUNT(*) AS n FROM categories WHERE id = ?', [c]))?.n).toBe(1);
  });
});

describe('hostile text', () => {
  it('long, emoji, SQL-metacharacter and case-variant names and notes round-trip exactly', async () => {
    const nasty = [
      'x'.repeat(5000),
      '👨‍👩‍👧‍👦🏳️‍🌈💸 café ñ 日本語',
      "Robert'); DROP TABLE transactions;--",
      '%_\\" ; -- /* */ ? :name $1 \u0000end',
      'line1\nline2\ttab',
    ];
    const cat = (await createCategory({ name: 'Misc', kind: 'expense' })).id;
    for (const s of nasty) {
      const acc = await createAccount({ name: s, type: 'bank', currency: 'INR', openingBalanceMinor: 0 });
      const row = await one<{ name: string }>('SELECT name FROM accounts WHERE id = ?', [acc.id]);
      expect(row?.name).toBe(s.trim());
      const t = await createTransaction({
        type: 'expense',
        accountId: acc.id,
        categoryId: cat,
        amountMinor: 5,
        date: '2025-01-01',
        note: s,
      });
      const back = await one<{ note: string }>('SELECT note FROM transactions WHERE id = ?', [t.id]);
      expect(back?.note).toBe(s);
      const c = await createCategory({ name: s, kind: 'income' });
      expect((await one<{ name: string }>('SELECT name FROM categories WHERE id = ?', [c.id]))?.name).toBe(
        s.trim()
      );
    }
    expect((await one<{ n: number }>('SELECT COUNT(*) AS n FROM transactions'))?.n).toBe(nasty.length);
  });

  it('duplicate account names (any case) are allowed, duplicate active category names are not', async () => {
    const a1 = await createAccount({ name: 'Wallet', type: 'cash', currency: 'INR' });
    const a2 = await createAccount({ name: 'wallet', type: 'cash', currency: 'INR' });
    const a3 = await createAccount({ name: 'WALLET', type: 'cash', currency: 'INR' });
    expect(new Set([a1.id, a2.id, a3.id]).size).toBe(3);
    await createCategory({ name: 'Snacks', kind: 'expense' });
    await expect(createCategory({ name: 'sNaCkS', kind: 'expense' })).rejects.toThrow(/already a category/);
    await createCategory({ name: 'snacks', kind: 'income' }); // other kind is fine
  });

  it('blank and whitespace-only names are rejected', async () => {
    await expect(createAccount({ name: '   ', type: 'cash', currency: 'INR' })).rejects.toThrow();
    await expect(createCategory({ name: '\t ', kind: 'expense' })).rejects.toThrow();
  });
});
