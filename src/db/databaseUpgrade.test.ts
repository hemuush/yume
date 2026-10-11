const mockFiles = new Set<string>();
const mockCopies: string[] = [];
let mockFailCopy: string | null = null;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  Directory: class {
    exists = true;
  },
  File: class {
    name: string;
    constructor(_parent: unknown, name: string) {
      this.name = name;
    }
    get exists() {
      return mockFiles.has(this.name);
    }
    copy(target: { name: string }) {
      mockCopies.push(target.name);
      mockFiles.add(target.name);
      if (target.name === mockFailCopy) throw new Error('disk full');
    }
    delete() {
      mockFiles.delete(this.name);
    }
  },
}));
import { migrateDbFilename, getDb } from './client';
import { openDatabaseAsync } from 'expo-sqlite';

beforeEach(() => {
  mockFiles.clear();
  mockCopies.length = 0;
  mockFailCopy = null;
  for (const name of ['flynse.db', 'flynse.db-wal', 'flynse.db-shm']) mockFiles.add(name);
});

it('copies the main database last and preserves every original file', async () => {
  await migrateDbFilename();
  expect(mockCopies).toEqual(['yume.db-wal', 'yume.db-shm', 'yume.db']);
  expect([...mockFiles]).toEqual(expect.arrayContaining(['flynse.db', 'flynse.db-wal', 'flynse.db-shm']));
});

it('blocks startup on a failed sidecar copy instead of opening an empty database', async () => {
  mockFailCopy = 'yume.db-shm';
  await expect(getDb()).rejects.toThrow('original database is kept');
  expect(openDatabaseAsync).not.toHaveBeenCalled();
  expect([...mockFiles].sort()).toEqual(['flynse.db', 'flynse.db-shm', 'flynse.db-wal']);
  mockFailCopy = null;
  await migrateDbFilename();
  expect(mockFiles.has('yume.db')).toBe(true);
});

it('never replaces an already-created Yume database', async () => {
  mockFiles.add('yume.db');
  await migrateDbFilename();
  expect(mockCopies).toEqual([]);
});
