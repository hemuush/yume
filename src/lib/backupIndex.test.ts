/**
 * The phone's backup index: remembered across reads, one file added at a
 * time, and anything unreadable treated as "nothing remembered" rather than
 * an error, since it's only a speed-up.
 */
const mockFs = { files: new Map<string, string>(), failWrite: false };
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
      mockFs.files.set(this.name, '');
    }
    write(content: string) {
      if (mockFs.failWrite) throw new Error('No space left on device');
      mockFs.files.set(this.name, content);
    }
    async text() {
      return mockFs.files.get(this.name) ?? '';
    }
  }
  return { File, Paths: { document: 'documents' } };
});

import { readBackupIndex, writeBackupIndex, rememberBackupFile } from './backupIndex';

const info = { exportedAt: '2026-09-25T10:00:00Z', sizeBytes: 100, summary: null };

beforeEach(() => {
  mockFs.files.clear();
  mockFs.failWrite = false;
});

describe('backup index', () => {
  it('is empty before anything is remembered', async () => {
    expect(await readBackupIndex()).toEqual({});
  });

  it('remembers files one at a time', async () => {
    await rememberBackupFile('a', info);
    await rememberBackupFile('b', { ...info, sizeBytes: 200 });
    expect(await readBackupIndex()).toEqual({ a: info, b: { ...info, sizeBytes: 200 } });
    writeBackupIndex({ b: info });
    expect(Object.keys(await readBackupIndex())).toEqual(['b']);
  });

  it('treats a damaged index as empty', async () => {
    mockFs.files.set('backup-index.json', '{broken');
    expect(await readBackupIndex()).toEqual({});
    mockFs.files.set('backup-index.json', '[1,2]');
    expect(await readBackupIndex()).toEqual({});
  });

  it('never throws when the phone is full', async () => {
    mockFs.failWrite = true;
    expect(() => writeBackupIndex({ a: info })).not.toThrow();
    await expect(rememberBackupFile('a', info)).resolves.toBeUndefined();
  });
});
