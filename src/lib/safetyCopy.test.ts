/**
 * The restore safety copy, against a real SQLite engine and an in-memory
 * stand-in for the phone's file system that can be made to fail:
 *   - restore → undo gives back exactly the original data; undo → undo gives
 *     back the restored data
 *   - if the copy can't be saved, nothing is replaced (unless the user
 *     chooses "restore anyway"), and an existing copy is untouched
 *   - a restore that fails (damaged file) keeps the previous safety copy
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));
jest.mock('@/lib/notifications', () => ({ notifyOverspend: async () => {} }));

// In-memory files: name → contents. `mockFs.failWrite` / `failMove` simulate a full disk.
const mockFs = { files: new Map<string, string>(), failWrite: false, failMove: false };
jest.mock('expo-file-system', () => {
  class File {
    name: string;
    constructor(_dir: unknown, name: string) {
      this.name = name;
    }
    get exists() {
      return mockFs.files.has(this.name);
    }
    create() {
      if (mockFs.files.has(this.name)) throw new Error('already exists');
      mockFs.files.set(this.name, '');
    }
    write(content: string) {
      if (mockFs.failWrite) throw new Error('No space left on device');
      mockFs.files.set(this.name, content);
    }
    async text() {
      const v = mockFs.files.get(this.name);
      if (v == null) throw new Error('missing');
      return v;
    }
    delete() {
      mockFs.files.delete(this.name);
    }
    async move(dest: File, opts?: { overwrite?: boolean }) {
      if (mockFs.failMove) throw new Error('move failed');
      if (mockFs.files.has(dest.name) && !opts?.overwrite) throw new Error('exists');
      mockFs.files.set(dest.name, mockFs.files.get(this.name)!);
      mockFs.files.delete(this.name);
    }
  }
  return { File, Paths: { document: 'documents' } };
});

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, listTransactions } from '@/db/ledger';
import { buildBackupSnapshot, BackupSnapshot } from './backup';
import { restoreKeepingSafetyCopy, undoLastRestore, getSafetyCopyInfo, SafetyCopyError } from './safetyCopy';

const notes = async () => (await listTransactions()).map((t) => t.note).sort();

describe('restore safety copy', () => {
  let otherPhone: BackupSnapshot;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const bank = (
      await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    // "Another backup": taken with just one transaction in it…
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 1000,
      date: '2026-09-01',
      note: 'Old lunch',
    });
    otherPhone = await buildBackupSnapshot();
    // …then today's data grows past it.
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 2000,
      date: '2026-09-20',
      note: 'Today dinner',
    });
  });

  beforeEach(() => {
    mockFs.failWrite = false;
    mockFs.failMove = false;
  });

  it('has no safety copy before any restore', async () => {
    mockFs.files.clear();
    expect(await getSafetyCopyInfo()).toBeNull();
  });

  it('keeps a copy of the current data, restores, and undo puts the original back exactly', async () => {
    expect(await notes()).toEqual(['Old lunch', 'Today dinner']);
    const before = await buildBackupSnapshot();

    const result = await restoreKeepingSafetyCopy(otherPhone);
    expect(result.undoAvailable).toBe(true);
    expect(await notes()).toEqual(['Old lunch']);
    expect(await getSafetyCopyInfo()).toMatchObject({ transactions: 2, accounts: 1 });

    await undoLastRestore();
    expect(await notes()).toEqual(['Old lunch', 'Today dinner']);
    const after = await buildBackupSnapshot();
    for (const table of ['accounts', 'categories', 'transactions']) {
      expect(after.tables[table]).toEqual(before.tables[table]);
    }
  });

  it('undo can itself be undone — neither version is ever lost', async () => {
    // After the previous test the copy holds the restored (one-transaction) state.
    expect(await getSafetyCopyInfo()).toMatchObject({ transactions: 1 });
    await undoLastRestore();
    expect(await notes()).toEqual(['Old lunch']);
    await undoLastRestore();
    expect(await notes()).toEqual(['Old lunch', 'Today dinner']);
  });

  it("if the copy can't be saved, nothing is replaced and the existing copy is untouched", async () => {
    const copyBefore = await getSafetyCopyInfo();
    mockFs.failWrite = true;
    await expect(restoreKeepingSafetyCopy(otherPhone)).rejects.toBeInstanceOf(SafetyCopyError);
    expect(await notes()).toEqual(['Old lunch', 'Today dinner']);
    expect(await getSafetyCopyInfo()).toEqual(copyBefore);
    expect(mockFs.files.has('yume-safety-copy.pending.json')).toBe(false);
  });

  it('"restore anyway" goes ahead without a new copy, keeping the older one', async () => {
    const copyBefore = await getSafetyCopyInfo();
    mockFs.failWrite = true;
    await restoreKeepingSafetyCopy(otherPhone, { withoutCopy: true });
    expect(await notes()).toEqual(['Old lunch']);
    expect(await getSafetyCopyInfo()).toEqual(copyBefore);
    mockFs.failWrite = false;
    await undoLastRestore(); // back to where the older copy points
  });

  it('a restore that fails (damaged file) keeps both the data and the previous safety copy', async () => {
    const dataBefore = await notes();
    const copyBefore = await getSafetyCopyInfo();
    const damaged = JSON.parse(JSON.stringify(otherPhone));
    damaged.tables.accounts = []; // transactions now point at a missing account
    await expect(restoreKeepingSafetyCopy(damaged)).rejects.toThrow('Nothing was changed');
    expect(await notes()).toEqual(dataBefore);
    expect(await getSafetyCopyInfo()).toEqual(copyBefore);
    expect(mockFs.files.has('yume-safety-copy.pending.json')).toBe(false);
  });

  it('if the new copy cannot be put in place after a successful restore, it says undo is not available', async () => {
    mockFs.failMove = true;
    const result = await restoreKeepingSafetyCopy(otherPhone);
    expect(result.undoAvailable).toBe(false);
    expect(await notes()).toEqual(['Old lunch']);
  });

  it('a corrupt safety copy file reads as none, and undo says so', async () => {
    mockFs.files.set('yume-safety-copy.json', '{not json');
    expect(await getSafetyCopyInfo()).toBeNull();
    await expect(undoLastRestore()).rejects.toThrow('no earlier data');
  });
});
