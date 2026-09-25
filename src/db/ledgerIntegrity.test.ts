/**
 * Ledger / recurring / restore integrity fixes, against a real SQLite engine:
 *   - transfers between accounts in different currencies are rejected
 *     everywhere a transfer can be written (manual, edit, recurring rule)
 *   - editing a transaction keeps the payment mode the edit screen doesn't show
 *   - listAccounts' single grouped query matches getAccountBalance exactly
 *   - listPeople's single grouped query matches the per-person sums
 *   - a category's transaction list can roll up its subcategories
 *   - recurring catch-up commits each occurrence with the rule's advance, so
 *     a failure part-way never re-posts earlier occurrences, and concurrent
 *     calls share one run
 *   - restore rejects damaged / incomplete files with the data untouched,
 *     and keeps this phone's own settings
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  scheduleLoanDueReminder: async () => {},
  cancelLoanDueReminder: async () => {},
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  getTransactionById,
  getAccountBalance,
  listAccounts,
  listTransactions,
} from '@/db/ledger';
import {
  createRecurringRule,
  runDueRecurringRules,
  listRecurringRules,
  setRecurringRuleActive,
} from '@/db/recurring';
import { createPerson, addLedgerEntry, listPeople, getPersonLedger } from '@/db/people';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';
import { setDefaultCurrency, setAppLockEnabled, setLocalBackupFolderUri } from '@/db/settings';

describe('ledger integrity', () => {
  let inrBank: string;
  let inrCash: string;
  let usdBank: string;
  let foodId: string;
  let zomatoId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    inrBank = (
      await createAccount({ name: 'INR Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 500000 })
    ).id;
    inrCash = (
      await createAccount({ name: 'INR Cash', type: 'cash', currency: 'INR', openingBalanceMinor: 10000 })
    ).id;
    usdBank = (
      await createAccount({ name: 'USD Bank', type: 'bank', currency: 'USD', openingBalanceMinor: 0 })
    ).id;
    foodId = (await createCategory({ name: 'Food & Dining', kind: 'expense' })).id;
    zomatoId = (await createCategory({ name: 'Zomato', kind: 'expense', parentId: foodId })).id;
  });

  describe('cross-currency transfers', () => {
    it('are rejected when created', async () => {
      await expect(
        createTransaction({
          type: 'transfer',
          accountId: inrBank,
          toAccountId: usdBank,
          amountMinor: 1000,
          date: '2026-01-01',
        })
      ).rejects.toThrow('different currencies');
    });

    it('are rejected when an existing transfer is edited onto a different-currency account', async () => {
      const tx = await createTransaction({
        type: 'transfer',
        accountId: inrBank,
        toAccountId: inrCash,
        amountMinor: 1000,
        date: '2026-01-02',
      });
      await expect(
        updateTransaction(tx.id, {
          type: 'transfer',
          accountId: inrBank,
          toAccountId: usdBank,
          amountMinor: 1000,
          date: '2026-01-02',
        })
      ).rejects.toThrow('different currencies');
    });

    it('are rejected when saved as a recurring rule', async () => {
      await expect(
        createRecurringRule({
          type: 'transfer',
          accountId: inrBank,
          toAccountId: usdBank,
          amountMinor: 1000,
          frequency: 'monthly',
          intervalCount: 1,
          nextRunDate: '2026-01-01',
        })
      ).rejects.toThrow('different currencies');
    });

    it('same-currency transfers still work exactly as before', async () => {
      const before = await getAccountBalance(inrCash);
      await createTransaction({
        type: 'transfer',
        accountId: inrBank,
        toAccountId: inrCash,
        amountMinor: 2500,
        date: '2026-01-03',
      });
      expect(await getAccountBalance(inrCash)).toBe(before + 2500);
    });
  });

  it('editing a transaction keeps the payment mode the edit screen does not show', async () => {
    const tx = await createTransaction({
      type: 'expense',
      accountId: inrBank,
      categoryId: foodId,
      amountMinor: 45000,
      date: '2026-01-05',
      paymentMode: 'upi',
    });
    await updateTransaction(tx.id, {
      type: 'expense',
      accountId: inrBank,
      categoryId: foodId,
      amountMinor: 50000,
      date: '2026-01-05',
      note: 'edited',
    });
    const edited = await getTransactionById(tx.id);
    expect(edited!.amountMinor).toBe(50000);
    expect(edited!.paymentMode).toBe('upi');

    // An explicit value (including null) still overwrites it.
    await updateTransaction(tx.id, {
      type: 'expense',
      accountId: inrBank,
      categoryId: foodId,
      amountMinor: 50000,
      date: '2026-01-05',
      paymentMode: null,
    });
    expect((await getTransactionById(tx.id))!.paymentMode).toBeNull();
  });

  it("listAccounts' grouped balance matches getAccountBalance for every account, archived included", async () => {
    await createTransaction({
      type: 'expense',
      accountId: inrCash,
      categoryId: zomatoId,
      amountMinor: 700,
      date: '2026-01-06',
    });
    const accounts = await listAccounts(true);
    expect(accounts.length).toBeGreaterThanOrEqual(3);
    for (const acc of accounts) {
      expect(acc.currentBalanceMinor).toBe(await getAccountBalance(acc.id));
    }
  });

  it("listPeople's grouped balances match each person's own ledger", async () => {
    const asha = await createPerson({ name: 'Asha' });
    const ravi = await createPerson({ name: 'Ravi' });
    await createPerson({ name: 'Nobody Yet' });
    await addLedgerEntry({ personId: asha.id, amountMinor: 30000, date: '2026-01-02' });
    await addLedgerEntry({ personId: asha.id, amountMinor: -10000, date: '2026-01-09' });
    await addLedgerEntry({ personId: ravi.id, amountMinor: -5000, date: '2026-01-04' });

    const people = await listPeople();
    for (const p of people) {
      const ledger = await getPersonLedger(p.id);
      expect(p.balanceMinor).toBe(ledger.reduce((s, e) => s + e.amountMinor, 0));
      expect(p.lastActivityDate).toBe(
        ledger.length
          ? ledger
              .map((e) => e.date)
              .sort()
              .pop()
          : null
      );
    }
    expect(people.find((p) => p.name === 'Asha')!.balanceMinor).toBe(20000);
    expect(people.find((p) => p.name === 'Nobody Yet')!.balanceMinor).toBe(0);
  });

  it("a category's transaction list can roll up its subcategories; without the flag it stays exact-match", async () => {
    const range = { fromDate: '2026-01-01', toDate: '2026-01-31' };
    const exact = await listTransactions({ categoryId: foodId, ...range });
    const rolled = await listTransactions({ categoryId: foodId, includeSubcategories: true, ...range });
    expect(exact.every((t) => t.categoryId === foodId)).toBe(true);
    expect(rolled.some((t) => t.categoryId === zomatoId)).toBe(true);
    expect(rolled.length).toBe(exact.length + rolled.filter((t) => t.categoryId === zomatoId).length);
    // A leaf category is unaffected by the flag.
    const leafRolled = await listTransactions({ categoryId: zomatoId, includeSubcategories: true, ...range });
    const leafExact = await listTransactions({ categoryId: zomatoId, ...range });
    expect(leafRolled.map((t) => t.id)).toEqual(leafExact.map((t) => t.id));
  });

  describe('recurring catch-up atomicity', () => {
    it('a failure part-way keeps what was posted, advances past it, and never re-posts it', async () => {
      const quiet = jest.spyOn(console, 'error').mockImplementation(() => {}); // the simulated failure is logged by design
      const rule = await createRecurringRule({
        type: 'expense',
        accountId: inrBank,
        categoryId: foodId,
        amountMinor: 1200,
        note: 'Atomic Rule',
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2034-01-01',
      });
      // Make the third occurrence fail mid-catch-up, as a crash or a bad
      // write would.
      await mockTestDb.execAsync(`
        CREATE TRIGGER fail_march BEFORE INSERT ON transactions
        WHEN NEW.note = 'Atomic Rule' AND NEW.date = '2034-03-01'
        BEGIN SELECT RAISE(ABORT, 'simulated failure'); END;
      `);
      await runDueRecurringRules('2034-05-01');

      const posted = () =>
        listTransactions({ limit: 10000 }).then((txs) =>
          txs
            .filter((t) => t.note === 'Atomic Rule')
            .map((t) => t.date)
            .sort()
        );
      expect(await posted()).toEqual(['2034-01-01', '2034-02-01']);
      let [stored] = (await listRecurringRules()).filter((r) => r.id === rule.id);
      expect(stored.active).toBe(false); // deactivated, as before
      expect(stored.nextRunDate).toBe('2034-03-01'); // but advanced past what it already posted

      // The user fixes whatever was wrong and turns the rule back on: it
      // resumes at March instead of re-posting January and February.
      await mockTestDb.execAsync('DROP TRIGGER fail_march');
      await setRecurringRuleActive(rule.id, true);
      await runDueRecurringRules('2034-05-01');
      expect(await posted()).toEqual(['2034-01-01', '2034-02-01', '2034-03-01', '2034-04-01', '2034-05-01']);
      [stored] = (await listRecurringRules()).filter((r) => r.id === rule.id);
      expect(stored.nextRunDate).toBe('2034-06-01');
      await setRecurringRuleActive(rule.id, false);
      quiet.mockRestore();
    });

    it('two catch-ups started at once share one run instead of posting every occurrence twice', async () => {
      const rule = await createRecurringRule({
        type: 'expense',
        accountId: inrBank,
        categoryId: foodId,
        amountMinor: 900,
        note: 'Concurrent Rule',
        frequency: 'monthly',
        intervalCount: 1,
        nextRunDate: '2035-01-01',
      });
      const [a, b] = await Promise.all([
        runDueRecurringRules('2035-03-01'),
        runDueRecurringRules('2035-03-01'),
      ]);
      expect(a).toBe(b);
      const dates = (await listTransactions({ limit: 10000 }))
        .filter((t) => t.note === 'Concurrent Rule')
        .map((t) => t.date)
        .sort();
      expect(dates).toEqual(['2035-01-01', '2035-02-01', '2035-03-01']);
      await setRecurringRuleActive(rule.id, false);
    });
  });

  describe('restore integrity', () => {
    const countRows = async () =>
      (await mockTestDb.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions'))!.n;

    it('rejects a file whose records point at data missing from it, leaving current data untouched', async () => {
      const snapshot = await buildBackupSnapshot();
      const before = await countRows();
      const broken = JSON.parse(JSON.stringify(snapshot));
      broken.tables.accounts = []; // every transaction now points at a missing account
      await expect(restoreFromSnapshot(broken)).rejects.toThrow('Nothing was changed');
      expect(await countRows()).toBe(before);
      // Foreign keys are back on afterwards.
      const fk = await mockTestDb.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
      expect(fk!.foreign_keys).toBe(1);
    });

    it('rejects a damaged table section before deleting anything', async () => {
      const snapshot = await buildBackupSnapshot();
      const before = await countRows();
      const damaged = JSON.parse(JSON.stringify(snapshot));
      damaged.tables.transactions = { not: 'an array' };
      await expect(restoreFromSnapshot(damaged)).rejects.toThrow('damaged');
      expect(await countRows()).toBe(before);
    });

    it("keeps this phone's own settings (backup folder, app lock) instead of the backup's copies", async () => {
      await setLocalBackupFolderUri('content://old-phone/folder');
      await setAppLockEnabled(false);
      const fromOldPhone = await buildBackupSnapshot();

      await setLocalBackupFolderUri('content://this-phone/folder');
      await setAppLockEnabled(true);
      await restoreFromSnapshot(fromOldPhone);

      const setting = async (key: string) =>
        (await mockTestDb.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]))
          ?.value;
      expect(await setting('local_backup_folder_uri')).toBe('content://this-phone/folder');
      expect(await setting('app_lock_enabled')).toBe('1');
      // Everything else in the file still comes back.
      expect(await setting('default_currency')).toBe('INR');
    });

    it("on a fresh install the backup's app-lock preference comes back, but never its folder grant", async () => {
      await setLocalBackupFolderUri('content://old-phone/folder');
      await setAppLockEnabled(true);
      const fromOldPhone = await buildBackupSnapshot();

      // A fresh install has none of these rows yet.
      await mockTestDb.runAsync(
        `DELETE FROM settings WHERE key IN ('app_lock_enabled', 'local_backup_folder_uri', 'last_local_backup_at', 'last_local_backup_result')`
      );
      await restoreFromSnapshot(fromOldPhone);

      const setting = async (key: string) =>
        (await mockTestDb.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]))
          ?.value;
      expect(await setting('app_lock_enabled')).toBe('1');
      expect(await setting('local_backup_folder_uri')).toBeUndefined();
    });

    it('a valid snapshot still round-trips completely', async () => {
      const snapshot = await buildBackupSnapshot();
      const before = await countRows();
      const { skippedColumns } = await restoreFromSnapshot(snapshot);
      expect(skippedColumns).toEqual([]);
      expect(await countRows()).toBe(before);
    });
  });
});
