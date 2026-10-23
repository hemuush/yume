/**
 * Containment and bounds in src/lib: a backup list that can't be read, an oversized file, a throwing widget
 * refresh or a malformed URI must not turn a finished action into an error, and the workbook export must
 * be honest about its total and its size ceiling.
 */
jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    readDirectoryAsync: jest.fn(),
    createFileAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    requestDirectoryPermissionsAsync: jest.fn(),
  },
}));
jest.mock('./backup', () => ({
  buildBackupSnapshot: jest.fn(async () => ({ formatVersion: 1, exportedAt: 'x', tables: {} })),
  summarizeSnapshot: () => null,
  isTooLargeForBackup: (bytes: number | null | undefined) => bytes != null && bytes > 150 * 1024 * 1024,
}));
jest.mock('@/db/settings', () => ({
  getLocalBackupFolderUri: jest.fn(),
  setLocalBackupFolderUri: jest.fn(),
  getLastLocalBackupAt: jest.fn(),
  setLastLocalBackupAt: jest.fn(async () => {}),
  getBackupFrequency: jest.fn(),
  BACKUP_FREQUENCY_MS: { weekly: 1, monthly: 2 },
  setLastLocalBackupResult: jest.fn(async () => {}),
  getDefaultCurrency: jest.fn(async () => 'INR'),
}));
const mockListTransactions = jest.fn();
jest.mock('@/db/ledger', () => ({
  listAccounts: jest.fn(async () => []),
  listCategories: jest.fn(async () => []),
  listTransactions: (...args: unknown[]) => mockListTransactions(...args),
}));
jest.mock('@/db/loans', () => ({ listLoans: jest.fn(async () => []) }));
jest.mock('@/db/people', () => ({ listPeople: jest.fn(async () => []) }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: jest.fn(async () => {}) }));
jest.mock('@/widgets/notifyWidgets', () => ({
  refreshAllWidgets: jest.fn(() => {
    throw new Error('widget host unavailable');
  }),
}));

import * as XLSX from 'xlsx-js-style';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { listLocalBackups, readLocalBackup } from './localBackup';
import { resyncAfterRestore } from './restoreSync';
import { buildExportWorkbook, generateExportWorkbookBytes, MAX_EXPORT_TRANSACTIONS } from './exportExcel';
const MAX_BACKUP_FILE_BYTES = 150 * 1024 * 1024;

const saf = StorageAccessFramework as jest.Mocked<typeof StorageAccessFramework>;

describe('local backup folder', () => {
  it('an inaccessible folder reports its error instead of pretending it is empty', async () => {
    saf.readDirectoryAsync.mockRejectedValueOnce(new Error('permission revoked'));
    await expect(listLocalBackups('content://gone')).rejects.toThrow('permission revoked');
  });

  it('a file whose URI is malformed is skipped, and does not break the list of the others', async () => {
    saf.readDirectoryAsync.mockResolvedValueOnce([
      'content://tree/%E0%A4%A/yume-backup-2026-01-02',
      'content://tree/yume-backup-2026-01-03.json',
    ]);
    saf.readAsStringAsync.mockResolvedValue(
      '{"formatVersion":1,"exportedAt":"2026-01-03T00:00:00.000Z","tables":{}}'
    );
    const files = await listLocalBackups('content://tree');
    expect(files.map((f) => f.uri)).toEqual(['content://tree/yume-backup-2026-01-03.json']);
  });

  it('refuses to parse a file bigger than any real backup', async () => {
    saf.readAsStringAsync.mockResolvedValueOnce({ length: MAX_BACKUP_FILE_BYTES + 1 } as unknown as string);
    await expect(readLocalBackup('content://huge')).rejects.toThrow('too large');
  });

  it('still reads a normal backup', async () => {
    saf.readAsStringAsync.mockResolvedValueOnce('{"formatVersion":1,"exportedAt":"x","tables":{}}');
    await expect(readLocalBackup('content://ok')).resolves.toEqual({
      formatVersion: 1,
      exportedAt: 'x',
      tables: {},
    });
  });
});

describe('after a restore', () => {
  it('a widget refresh that throws does not make the finished restore an error', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(resyncAfterRestore()).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('workbook export', () => {
  const base = {
    currency: 'INR',
    accounts: [
      {
        id: 'a1',
        name: 'SBI',
        type: 'bank',
        currency: 'INR',
        openingBalanceMinor: 0,
        currentBalanceMinor: 0,
        creditLimitMinor: null,
        statementDay: null,
        dueDay: null,
        interestRateAnnualBp: null,
        archived: false,
        createdAt: '2026-01-01',
      },
    ],
    categories: [],
    loans: [],
    people: [],
  } as any;
  const tx = (id: string, amountMinor: number, type: 'expense' | 'income') => ({
    id,
    type,
    accountId: 'a1',
    toAccountId: null,
    categoryId: null,
    amountMinor,
    date: '2026-03-01',
    note: '',
    paymentMode: null,
    loanPaymentId: null,
    splitId: null,
    isRefund: false,
    createdAt: '2026-03-01',
  });

  it("each Transactions total's stored value equals the sum of the column its formula adds up", () => {
    const wb = buildExportWorkbook({
      ...base,
      transactions: [tx('1', 30000, 'expense'), tx('2', 50000, 'income')],
    });
    const ws = wb.Sheets['Transactions'];
    // Newest first and same day: income row 2 (Money in, G), expense row 3 (Money out, H).
    expect(ws['G4'].f).toBe('SUBTOTAL(9,G2:G3)');
    expect(ws['G4'].v).toBe(500);
    expect(ws['H4'].f).toBe('SUBTOTAL(9,H2:H3)');
    expect(ws['H4'].v).toBe(300);
  });

  it('refuses a ledger past the ceiling instead of silently cutting it short', async () => {
    mockListTransactions.mockResolvedValueOnce(
      new Array(MAX_EXPORT_TRANSACTIONS + 1).fill(tx('x', 100, 'expense'))
    );
    await expect(generateExportWorkbookBytes()).rejects.toThrow('Use Backup instead');
    expect(mockListTransactions).toHaveBeenCalledWith({ limit: MAX_EXPORT_TRANSACTIONS + 1 });
  });

  it('exports a ledger at the ceiling or below as before', async () => {
    mockListTransactions.mockResolvedValueOnce([tx('1', 100, 'expense')]);
    const bytes = await generateExportWorkbookBytes();
    expect(XLSX.read(bytes, { type: 'array' }).SheetNames).toContain('Transactions');
  });
});
