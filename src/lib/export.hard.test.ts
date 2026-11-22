/**
 * Hard export tests: spreadsheet formula-injection text stays text through a real write/read, the PDF html
 * escapes hostile text, empty data does not throw, and paise export exactly.
 */
import * as XLSX from 'xlsx-js-style';
import { buildExportWorkbook, ExportData } from './exportExcel';
import { buildReportHtml, ReportStyle } from './report/pdfHtml';
import { computeReport } from './report/reportData';
import { REPORT_ASSETS } from './report/embeddedAssets';
import { sampleLedger } from '@/test-support/reportFixture';
import type { Account, Category, Transaction } from '@/types';

const acc = {
  id: 'a1',
  name: 'SBI',
  type: 'bank',
  currency: 'INR',
  openingBalanceMinor: 0,
  currentBalanceMinor: 12345,
  creditLimitMinor: null,
  statementDay: null,
  dueDay: null,
  interestRateAnnualBp: null,
  archived: false,
  createdAt: '2026-01-01',
} as Account;
const cat = {
  id: 'c1',
  name: 'Food',
  kind: 'expense',
  parentId: null,
  icon: 'x',
  color: '#F97316',
  archived: false,
  sortOrder: 0,
  isSensitive: false,
  isSystem: false,
} as Category;
const tx = (o: Partial<Transaction>) =>
  ({
    id: 't',
    type: 'expense',
    accountId: 'a1',
    toAccountId: null,
    categoryId: 'c1',
    amountMinor: 100,
    date: '2026-03-01',
    note: '',
    paymentMode: null,
    loanPaymentId: null,
    splitId: null,
    isRefund: false,
    createdAt: '2026-03-01',
    ...o,
  }) as Transaction;

const roundTrip = (wb: XLSX.WorkBook) =>
  XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });

describe('excel export', () => {
  const notes = [
    '=1+1',
    '+1',
    '-1',
    '@SUM(A1)',
    '\tx',
    '\rx',
    '=HYPERLINK("http://e","x")',
    "=cmd|' /C calc'!A0",
  ];
  const data: ExportData = {
    currency: 'INR',
    accounts: [acc],
    categories: [cat],
    transactions: notes.map((note, i) => tx({ id: `t${i}`, note, amountMinor: 1 })),
    loans: [],
    people: [],
  };

  it('keeps formula-looking notes as text cells, never formulas', () => {
    const wb = roundTrip(buildExportWorkbook(data));
    const ws = wb.Sheets['Transactions'];
    const hits = Object.entries(ws).filter(
      ([k, c]: [string, any]) => !k.startsWith('!') && notes.includes(c.v)
    );
    expect(hits.length).toBe(notes.length);
    for (const [, c] of hits as [string, any][]) {
      expect(c.t).toBe('s');
      expect(c.f).toBeUndefined();
    }
  });

  it('empty data exports do not throw and still write', () => {
    const empty: ExportData = {
      currency: 'INR',
      accounts: [],
      categories: [],
      transactions: [],
      loans: [],
      people: [],
    };
    expect(() => roundTrip(buildExportWorkbook(empty))).not.toThrow();
    expect(() =>
      roundTrip(buildExportWorkbook(empty, { kind: 'month', year: 2026, month: 0 }))
    ).not.toThrow();
  });

  it('exports paise exactly, not rounded', () => {
    const d = {
      ...data,
      transactions: [tx({ amountMinor: 123456789, note: 'p' }), tx({ id: 'u', amountMinor: 1 })],
    };
    const ws = roundTrip(buildExportWorkbook(d)).Sheets['Transactions'];
    const values = Object.entries(ws)
      .filter(([k]) => !k.startsWith('!'))
      .map(([, c]: any) => c.v);
    expect(values).toContain(1234567.89);
    expect(values).toContain(0.01);
  });

  it('survives a very long name and unicode', () => {
    const d = { ...data, accounts: [{ ...acc, name: 'é😀'.repeat(5000) }] };
    expect(() => roundTrip(buildExportWorkbook(d))).not.toThrow();
  });
});

describe('pdf html', () => {
  const style: ReportStyle = {
    primary: '#8FCBFF',
    secondary: '#8FE8C8',
    dot: '#F0876A',
    today: '2026-10-23',
    assets: REPORT_ASSETS,
  };
  const ledger = sampleLedger(10);

  it('escapes hostile titles, notes and names', () => {
    const r = computeReport({ ...ledger, period: { kind: 'all' }, today: '2026-10-23' });
    const evil = '<script>alert(1)</script> "q" \'s\' <img onerror=x> é😀 日本語';
    r.entries = r.entries.map((e) => ({ ...e, title: evil, sub: evil }) as any);
    const { html } = buildReportHtml(r, style);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('日本語');
  });

  it('copes with a very long unbroken name and with empty data', () => {
    const long = 'W'.repeat(100000);
    const r = computeReport({ ...ledger, period: { kind: 'all' }, today: '2026-10-23' });
    r.entries = r.entries.map((e) => ({ ...e, title: long }));
    expect(() => buildReportHtml(r, style)).not.toThrow();
    const e = computeReport({
      accounts: [],
      categories: [],
      transactions: [],
      loans: [],
      people: [],
      currency: 'INR',
      period: { kind: 'all' },
      today: '2026-10-23',
    } as any);
    const { html, pageCount } = buildReportHtml(e, style);
    expect(pageCount).toBeGreaterThan(0);
    expect(html).toContain('Page 1 of ' + pageCount);
  });

  it('shows paise exactly', () => {
    const l = {
      ...ledger,
      transactions: [tx({ amountMinor: 123457, type: 'expense', date: '2026-10-01' })],
      accounts: [acc],
      categories: [cat],
      loans: [],
      people: [],
    };
    const { html } = buildReportHtml(
      computeReport({ ...l, period: { kind: 'all' }, today: '2026-10-23' }),
      style
    );
    expect(html).toContain('1,234.57');
  });
});
