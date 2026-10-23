/** The PDF pipeline around the layout: data in, one Print call with whole A4 pages, the temp file cleaned up. */
const mockPrint = jest.fn();
jest.mock('expo-print', () => ({ printToFileAsync: (...a: unknown[]) => mockPrint(...a) }));
jest.mock('expo-asset', () => ({
  Asset: { loadAsync: async () => [{ localUri: 'file://asset', uri: 'asset' }] },
}));
const mockFiles: { uri: string; deleted: boolean }[] = [];
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    deleted = false;
    constructor(uri: string) {
      this.uri = uri;
      mockFiles.push(this);
    }
    get exists() {
      return !this.deleted;
    }
    async bytes() {
      return new Uint8Array([37, 80, 68, 70]);
    }
    delete() {
      this.deleted = true;
    }
  },
}));
const mockInput = jest.fn();
jest.mock('./report/loadReportInput', () => ({ loadReportInput: () => mockInput() }));

import { generateReportPdf, MAX_PDF_ENTRIES } from './exportPdf';
import { sampleLedger } from '@/test-support/reportFixture';

const colors = { primary: '#8FCBFF', secondary: '#8FE8C8', dot: '#F0876A' };
const sept = { kind: 'month', year: 2026, month: 9 } as const;

beforeEach(() => {
  mockFiles.length = 0;
  mockInput.mockResolvedValue(sampleLedger(60));
  mockPrint.mockResolvedValue({ uri: 'file://printed.pdf', numberOfPages: 3 });
});

it('prints the whole report as A4 points and returns its bytes', async () => {
  const { bytes, pageCount } = await generateReportPdf(sept, colors);
  expect(Array.from(bytes)).toEqual([37, 80, 68, 70]);
  expect(pageCount).toBeGreaterThanOrEqual(1);
  const opts = mockPrint.mock.calls[0][0];
  expect(opts).toMatchObject({ width: 595, height: 842 });
  expect(opts.html).toContain('September 2026');
  expect(opts.html).toContain(`Page 1 of ${pageCount}`);
});

it('removes the printed file afterwards', async () => {
  await generateReportPdf(sept, colors);
  const printed = mockFiles.find((f) => f.uri === 'file://printed.pdf')!;
  expect(printed.deleted).toBe(true);
});

it('refuses a period with no entries before printing anything', async () => {
  await expect(generateReportPdf({ kind: 'month', year: 1999, month: 1 }, colors)).rejects.toThrow(
    'no entries'
  );
  expect(mockPrint).not.toHaveBeenCalled();
});

it('refuses a period too long for one PDF and points to a shorter one or Excel', async () => {
  mockInput.mockResolvedValue(sampleLedger(MAX_PDF_ENTRIES + 10));
  await expect(generateReportPdf({ kind: 'all' }, colors)).rejects.toThrow('Choose a shorter period');
  expect(mockPrint).not.toHaveBeenCalled();
});
