/**
 * Round-trips buildExportWorkbook output through XLSX.write -> XLSX.read, the real export pipeline.
 * A broken cell ref, bad style or malformed range would throw: the closest check to Excel without a device.
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
    isSystem: false,
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
    paymentMode: null,
    loanPaymentId: null,
    splitId: null,
    isRefund: false,
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
        name: 'Kabir',
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
      'Months',
      'Loans',
      'Friends & Family',
    ]);
  });

  it('adds Invested and Gain columns to the Accounts sheet only when an account is tracked', () => {
    const plain = XLSX.utils.sheet_to_json<string[]>(buildExportWorkbook(data).Sheets['Accounts'], {
      header: 1,
    });
    expect(plain[0]).toEqual(['Account', 'Type', 'Balance', 'Currency']);

    const tracked = buildExportWorkbook({
      ...data,
      accounts: [
        ...data.accounts,
        account({
          id: 'acc-3',
          name: 'Index fund',
          type: 'savings',
          currentBalanceMinor: 4456000,
          investment: {
            investedMinor: 4200000,
            takenOutMinor: 0,
            gainMinor: 256000,
            valuedAt: '2026-09-28',
            lastValueMinor: 4306000,
          },
        }),
      ],
    });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(tracked.Sheets['Accounts'], { header: 1 });
    expect(rows[0]).toEqual([
      'Account',
      'Type',
      'Balance',
      'Currency',
      'Invested',
      'Gain',
      'Kind',
      'Money comes from',
    ]);
    const fund = rows.find((r) => r[0] === 'Index fund');
    expect(fund?.slice(1)).toEqual(['investment', 44560, 'INR', 42000, 2560, '', '']);
  });

  it('omits the Loans/Friends & Family sheets when there is nothing to show, without breaking anything else', () => {
    const wb = buildExportWorkbook({ ...data, loans: [], people: [] });
    expect(wb.SheetNames).toEqual(['Summary', 'Transactions', 'Accounts', 'Categories', 'Months']);
  });

  it('writes real numeric amounts (not pre-formatted text) so Excel can sort/filter/sum them', () => {
    const wb = buildExportWorkbook(data);
    const ws = wb.Sheets['Transactions'];
    // Row 1 (0-indexed) is the most recent transaction after sorting desc: tx-4 (transfer, 2026-03-04).
    const amountCell = ws['I2']; // the Transfer column
    expect(amountCell.t).toBe('n');
    expect(amountCell.v).toBe(200); // 20000 minor units -> 200 major
  });

  it("rolls a subcategory's spend into its parent in the Categories sheet, matching the app's own Reports rollup", () => {
    const wb = buildExportWorkbook(data);
    const ws = wb.Sheets['Categories'];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    // Column 0 is the colour-swatch column (no text), so the name is column 1.
    const foodRow = rows.find((r) => r[1] === 'Food & Dining');
    expect(foodRow).toBeDefined();
    expect(foodRow![3]).toBe(750); // 30000 (Food & Dining) + 45000 (Zomato) = 75000 minor -> 750 major
    expect(rows.some((r) => r[1] === 'Zomato')).toBe(false);
  });

  it('takes a refund off its spending category in the Categories sheet, as Reports does', () => {
    const wb = buildExportWorkbook({
      ...data,
      transactions: [
        ...data.transactions,
        transaction({ id: 'tx-r', type: 'income', isRefund: true, categoryId: 'cat-2', amountMinor: 15000 }),
      ],
    });
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Categories'], { header: 1 });
    const foodRow = rows.find((r) => r[1] === 'Food & Dining');
    // 300 + 450 spent, 150 back: 600 across the two entries (the refund isn't an entry of its own).
    expect(foodRow!.slice(2)).toEqual(['expense', 600, 2, 1]);
  });

  it('adds up only the default currency in the totals, while still listing every entry', () => {
    const wb = buildExportWorkbook({
      ...data,
      accounts: [
        ...data.accounts,
        account({ id: 'usd', name: 'Chase', currency: 'USD', currentBalanceMinor: 99900 }),
      ],
      transactions: [
        ...data.transactions,
        transaction({ id: 'tx-usd', accountId: 'usd', categoryId: 'cat-1', amountMinor: 70000 }),
      ],
    });
    const cats = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Categories'], { header: 1 });
    expect(cats.find((r) => r[1] === 'Food & Dining')![3]).toBe(750);
    const summary = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Summary'], { header: 1 });
    const flat = summary.flat();
    expect(flat).toContain(750); // Total expense, INR only
    expect(flat).toContain(4800); // Combined balance: 5,000 − 200, not counting the USD account
    const txs = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Transactions'], { header: 1 });
    expect(txs.some((r) => r[2] === 'Chase')).toBe(true);
    const foreignRow = txs.find((r) => r[2] === 'Chase')!;
    expect(foreignRow[10]).toBe('USD');
    const rowIndex = txs.indexOf(foreignRow) + 1;
    expect(wb.Sheets['Transactions'][`H${rowIndex}`].s.numFmt).toContain('$');
    const total = wb.Sheets['Transactions'][`H${txs.length}`];
    expect(total.f).toBeUndefined();
    expect(total.v).toBe('');
  });

  it('the Transactions total row is a SUBTOTAL formula, not a hardcoded value', () => {
    const wb = buildExportWorkbook(data);
    const ws = wb.Sheets['Transactions'];
    // header + 4 data rows -> totals on row 6 (1-indexed): Money in, Money out and Transfer each sum their column.
    expect(ws['G6'].f).toBe('SUBTOTAL(9,G2:G5)');
    expect(ws['H6'].f).toBe('SUBTOTAL(9,H2:H5)');
    expect(ws['I6'].f).toBe('SUBTOTAL(9,I2:I5)');
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

it('exports account-based transactions without a payment-method column', () => {
  const workbook = buildExportWorkbook({
    currency: 'INR',
    accounts: [],
    categories: [],
    transactions: [],
    loans: [],
    people: [],
  });
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Transactions, { header: 1 });
  expect(rows[0]).toContain('Account');
  expect(rows[0]).not.toContain('Payment Mode');
});

describe('a period export', () => {
  const ledger: ExportData = {
    currency: 'INR',
    accounts: [account({ id: 'acc-1', name: 'SBI' })],
    categories: [
      category({ id: 'cat-1', name: 'Food & Dining' }),
      category({ id: 'cat-2', name: 'Zomato', parentId: 'cat-1' }),
    ],
    transactions: [
      transaction({ id: 'a', date: '2026-08-31', amountMinor: 11100 }),
      transaction({ id: 'b', date: '2026-09-01', amountMinor: 20000, categoryId: 'cat-2', note: 'Pizza' }),
      transaction({ id: 'c', date: '2026-09-30', amountMinor: 5000 }),
      transaction({ id: 'r', date: '2026-09-15', amountMinor: 1000, type: 'income', isRefund: true }),
      transaction({ id: 'd', date: '2025-09-10', amountMinor: 99900 }),
    ],
    loans: [],
    people: [],
  };
  const sept = { kind: 'month', year: 2026, month: 9 } as const;

  it('lists only that month, with the title naming it and no month-by-month sheet', () => {
    const wb = buildExportWorkbook(ledger, sept);
    expect(wb.SheetNames).not.toContain('Months');
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Transactions'], { header: 1 });
    expect(rows).toHaveLength(1 + 3 + 1); // header, three September entries, totals
    expect(wb.Sheets['Summary']['A1'].v).toBe('Yume — September 2026');
  });

  it('writes real dates and splits Category from Subcategory', () => {
    const ws = buildExportWorkbook(ledger, sept).Sheets['Transactions'];
    expect(ws['A2'].t).toBe('d');
    expect(ws['A2'].z).toBe('yyyy-mm-dd');
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const pizza = rows.find((r) => r[9] === 'Pizza')!;
    expect(pizza[4]).toBe('Food & Dining');
    expect(pizza[5]).toBe('Zomato');
  });

  it('keeps refunds as negative money out so the column adds up to spending', () => {
    const ws = buildExportWorkbook(ledger, sept).Sheets['Transactions'];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const out = rows.slice(1, 4).map((r) => r[7]);
    expect(out.reduce((a: number, b: number) => a + b, 0)).toBe(240); // 200 + 50 − 10
    expect(ws['H5'].f).toBe('SUBTOTAL(9,H2:H4)');
    expect(ws['H5'].v).toBe(240);
  });

  it('adds a month-by-month sheet for a year or all time', () => {
    const wb = buildExportWorkbook(ledger, { kind: 'year', year: 2026 });
    expect(wb.SheetNames).toContain('Months');
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Months'], { header: 1 });
    expect(rows.map((r) => r[0])).toEqual(['Month', 'Aug 2026', 'Sep 2026']);
    expect(rows[2].slice(1)).toEqual([0, 240, -240, 2]);
    expect(buildExportWorkbook(ledger).SheetNames).toContain('Months');
  });

  it('survives a write and read with dates intact', () => {
    const wb = buildExportWorkbook(ledger, sept);
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true }) as ArrayBuffer;
    const back = XLSX.read(new Uint8Array(bytes), { type: 'array', cellDates: true });
    expect(back.Sheets['Transactions']['A2'].t).toBe('d');
  });
});

describe('investing entries and holdings in the export', () => {
  const ledger: ExportData = {
    currency: 'INR',
    accounts: [
      account({ id: 'acc-1', name: 'SBI' }),
      account({
        id: 'fund',
        name: 'Nifty 50',
        type: 'savings',
        currentBalanceMinor: 100000,
        investment: {
          investedMinor: 90000,
          takenOutMinor: 0,
          gainMinor: 10000,
          valuedAt: '2026-03-10',
          lastValueMinor: 100000,
          kind: 'mutual_fund',
          fundingAccountId: 'acc-1',
        },
      }),
    ],
    categories: [],
    transactions: [
      transaction({
        id: 'in',
        type: 'transfer',
        categoryId: null,
        toAccountId: 'fund',
        date: '2026-03-05',
        ruleId: 'r1',
      }),
      transaction({
        id: 'lump',
        type: 'transfer',
        categoryId: null,
        toAccountId: 'fund',
        date: '2026-03-04',
      }),
      transaction({
        id: 'out',
        type: 'transfer',
        categoryId: null,
        accountId: 'fund',
        toAccountId: 'acc-1',
        date: '2026-03-03',
      }),
      transaction({
        id: 'plain',
        type: 'transfer',
        categoryId: null,
        accountId: 'acc-1',
        toAccountId: 'acc-1x',
        date: '2026-03-02',
      }),
    ],
    loans: [],
    people: [],
  };

  it('writes SIP, Invested and Withdrawn in the Type column and Transfer for the rest', () => {
    const rows = XLSX.utils.sheet_to_json<any[]>(buildExportWorkbook(ledger).Sheets['Transactions'], {
      header: 1,
    });
    expect(rows.slice(1, 5).map((r) => r[1])).toEqual(['SIP', 'Invested', 'Withdrawn', 'Transfer']);
  });

  it('says what a holding is and where its money comes from on the Accounts sheet', () => {
    const rows = XLSX.utils.sheet_to_json<any[]>(buildExportWorkbook(ledger).Sheets['Accounts'], {
      header: 1,
    });
    const fund = rows.find((r) => r[0] === 'Nifty 50')!;
    expect(fund[1]).toBe('investment');
    expect(fund.slice(6)).toEqual(['Mutual fund', 'SBI']);
  });
});
