/**
 * Exercises buildExportWorkbook with representative data and round-trips
 * the result through XLSX.write -> XLSX.read, the same pipeline the real
 * export uses (write -> Uint8Array -> file -> share). A broken cell
 * reference, an invalid style object, or a malformed range would throw or
 * produce a workbook Excel can't open — round-tripping through the same
 * library that will eventually parse it in Excel is the closest thing to a
 * real integration check available without a device.
 */
import * as XLSX from 'xlsx-js-style';
import { buildExportWorkbook, ExportData } from './exportExcel';
import { Account, Category, Loan, Transaction } from '@/types';
import { PersonWithBalance } from '@/db/people';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
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
    ...overrides,
  };
}

function category(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    name: 'Food & Dining',
    kind: 'expense',
    parentId: null,
    icon: 'silverware-fork-knife',
    color: '#F97316',
    archived: false,
    sortOrder: 0,
    isSensitive: false,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId: 'cat-1',
    amountMinor: 10000,
    date: '2026-03-01',
    note: '',
    tags: [],
    paymentMode: null,
    loanPaymentId: null,
    createdAt: '2026-03-01',
    ...overrides,
  };
}

describe('buildExportWorkbook', () => {
  const data: ExportData = {
    currency: 'INR',
    accounts: [
      account({ id: 'acc-1', name: 'SBI', currentBalanceMinor: 500000 }),
      account({ id: 'acc-2', name: 'HDFC Savings', type: 'savings', currentBalanceMinor: -20000 }),
    ],
    categories: [
      category({ id: 'cat-1', name: 'Food & Dining', kind: 'expense' }),
      category({ id: 'cat-2', name: 'Zomato', kind: 'expense', parentId: 'cat-1' }),
      category({ id: 'cat-3', name: 'Salary', kind: 'income' }),
    ],
    transactions: [
      transaction({
        id: 'tx-1',
        type: 'expense',
        categoryId: 'cat-1',
        amountMinor: 30000,
        date: '2026-03-01',
        note: 'Lunch',
      }),
      transaction({
        id: 'tx-2',
        type: 'expense',
        categoryId: 'cat-2',
        amountMinor: 45000,
        date: '2026-03-02',
        note: 'Zomato order',
      }),
      transaction({
        id: 'tx-3',
        type: 'income',
        categoryId: 'cat-3',
        amountMinor: 500000,
        date: '2026-03-03',
        note: 'March salary',
      }),
      transaction({
        id: 'tx-4',
        type: 'transfer',
        categoryId: null,
        accountId: 'acc-1',
        toAccountId: 'acc-2',
        amountMinor: 20000,
        date: '2026-03-04',
      }),
    ],
    loans: [
      {
        id: 'loan-1',
        direction: 'borrowed',
        counterparty: 'HDFC Home Loan',
        principalMinor: 220000000,
        interestRateAnnualBp: 850,
        tenureMonths: 240,
        startDate: '2025-01-01',
        emiAmountMinor: 1900000,
        outstandingPrincipalMinor: 210000000,
        status: 'active',
        linkedAccountId: 'acc-1',
        rateType: 'fixed',
        personId: null,
        notes: '',
        createdAt: '2025-01-01',
        nextDueDate: '2026-04-01',
        assetLabel: 'Home',
        assetValueMinor: 350000000,
      } as Loan,
    ],
    people: [
      {
        id: 'p1',
        name: 'Abhinav',
        notes: '',
        archived: false,
        createdAt: '2026-01-01',
        balanceMinor: 5000,
        lastActivityDate: '2026-03-01',
      } as PersonWithBalance,
    ],
  };

  it('produces a workbook with every expected sheet', () => {
    const wb = buildExportWorkbook(data);
    expect(wb.SheetNames).toEqual([
      'Summary',
      'Transactions',
      'Accounts',
      'Categories',
      'Loans',
      'Friends & Family',
    ]);
  });

  it('omits the Loans/Friends & Family sheets when there is nothing to show, without breaking anything else', () => {
    const wb = buildExportWorkbook({ ...data, loans: [], people: [] });
    expect(wb.SheetNames).toEqual(['Summary', 'Transactions', 'Accounts', 'Categories']);
  });

  it('writes real numeric amounts (not pre-formatted text) so Excel can sort/filter/sum them', () => {
    const wb = buildExportWorkbook(data);
    const ws = wb.Sheets['Transactions'];
    // Row 1 (0-indexed) is the most recent transaction after sorting desc: tx-4 (transfer, 2026-03-04).
    const amountCell = ws['F2'];
    expect(amountCell.t).toBe('n');
    expect(amountCell.v).toBe(200); // 20000 minor units -> 200 major
  });

  it("rolls a subcategory's spend into its parent in the Categories sheet, matching the app's own Reports rollup", () => {
    const wb = buildExportWorkbook(data);
    const ws = wb.Sheets['Categories'];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const foodRow = rows.find((r) => r[0] === 'Food & Dining');
    expect(foodRow).toBeDefined();
    expect(foodRow![2]).toBe(750); // 30000 (Food & Dining) + 45000 (Zomato) = 75000 minor -> 750 major
    expect(rows.some((r) => r[0] === 'Zomato')).toBe(false);
  });

  it('the Transactions total row is a SUBTOTAL formula, not a hardcoded value', () => {
    const wb = buildExportWorkbook(data);
    const ws = wb.Sheets['Transactions'];
    const totalCell = ws['F6']; // header + 4 data rows -> total on row 6 (1-indexed)
    expect(totalCell.f).toMatch(/^SUBTOTAL\(9,/);
  });

  it('round-trips through XLSX.write -> XLSX.read without throwing, and preserves sheet structure', () => {
    const wb = buildExportWorkbook(data);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as any;
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    expect(arr.length).toBeGreaterThan(0);
    const reread = XLSX.read(arr, { type: 'array' });
    expect(reread.SheetNames).toEqual(wb.SheetNames);
    const txRows = XLSX.utils.sheet_to_json<any[]>(reread.Sheets['Transactions'], { header: 1 });
    // header + 4 data rows + 1 total row
    expect(txRows.length).toBe(6);
  });

  it('handles a completely empty dataset without throwing', () => {
    const empty: ExportData = {
      currency: 'INR',
      accounts: [],
      categories: [],
      transactions: [],
      loans: [],
      people: [],
    };
    expect(() => buildExportWorkbook(empty)).not.toThrow();
    const wb = buildExportWorkbook(empty);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    expect(bytes).toBeTruthy();
  });
});
