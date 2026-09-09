import * as XLSX from 'xlsx-js-style';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { listPeople, PersonWithBalance } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';
import { toMajor } from './money';
import { Account, Category, Loan, Transaction } from '@/types';

/**
 * Flynse's own palette, as plain 6-digit RGB hex (xlsx-js-style's CellStyleColor
 * takes "RRGGBB", no alpha) — mirrors src/constants/theme.ts exactly, so the
 * exported workbook reads as the same app, not a generic spreadsheet.
 */
const C = {
  ink: '12130F',
  surface: 'FFFDF6',
  surfaceAlt: 'F3ECE0',
  lime: 'E0F0A8',
  mint: '8FE8C8',
  gold: 'F0E1A8',
  income: '1C9A5B',
  incomeTint: 'DDF2E5',
  expense: 'E23F55',
  expenseTint: 'FBE1E4',
  white: 'FFFFFF',
  textMuted: '948E7C',
};

const FONT_NAME = 'Calibri'; // Archivo (the app's own display font) isn't available to Excel — bold + color carries the identity instead.

type CellStyle = XLSX.CellStyle;

const titleStyle: CellStyle = {
  font: { name: FONT_NAME, bold: true, sz: 18, color: { rgb: C.lime } },
  fill: { fgColor: { rgb: C.ink }, patternType: 'solid' },
  alignment: { vertical: 'center', horizontal: 'left' },
};

const subtitleStyle: CellStyle = {
  font: { name: FONT_NAME, italic: true, sz: 10, color: { rgb: C.surfaceAlt } },
  fill: { fgColor: { rgb: C.ink }, patternType: 'solid' },
  alignment: { vertical: 'center', horizontal: 'left' },
};

function headerStyle(fill: string = C.ink, fontColor: string = C.white): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 11, color: { rgb: fontColor } },
    fill: { fgColor: { rgb: fill }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: { bottom: { style: 'thin', color: { rgb: C.ink } } },
  };
}

function bodyStyle(shaded: boolean, extra?: CellStyle): CellStyle {
  return {
    font: { name: FONT_NAME, sz: 10.5, ...(extra?.font ?? {}) },
    fill: { fgColor: { rgb: shaded ? C.surfaceAlt : C.surface }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: extra?.alignment?.horizontal ?? 'left' },
    numFmt: extra?.numFmt,
  };
}

function totalRowStyle(extra?: CellStyle): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 10.5, color: { rgb: C.ink } },
    fill: { fgColor: { rgb: C.gold }, patternType: 'solid' },
    border: { top: { style: 'thin', color: { rgb: C.ink } } },
    alignment: { vertical: 'center', horizontal: extra?.alignment?.horizontal ?? 'left' },
    numFmt: extra?.numFmt,
  };
}

function statLabelStyle(): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 10.5, color: { rgb: C.ink } },
    fill: { fgColor: { rgb: C.surfaceAlt }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: 'left' },
  };
}

function statValueStyle(numFmt: string, color: string = C.ink): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 11, color: { rgb: color } },
    fill: { fgColor: { rgb: C.surface }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: 'right' },
    numFmt,
  };
}

/** Extracts just the currency symbol/prefix Intl would use, for a numFmt literal like "₹"#,##0.00 */
function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

function moneyFmt(symbol: string): string {
  // Escaped so Excel treats the symbol as a literal, not a format directive;
  // negative amounts render in red with a leading minus, matching how the
  // app itself colors expenses.
  return `"${symbol}"#,##0.00;[Red]-"${symbol}"#,##0.00`;
}

function setCell(ws: XLSX.WorkSheet, ref: string, value: any, style?: CellStyle, type?: 'n' | 's' | 'd') {
  const cell: any = { v: value };
  if (type) cell.t = type;
  else if (typeof value === 'number') cell.t = 'n';
  else cell.t = 's';
  if (style) cell.s = style;
  ws[ref] = cell;
}

function setFormula(ws: XLSX.WorkSheet, ref: string, formula: string, cached: number, style?: CellStyle) {
  ws[ref] = { t: 'n', f: formula, v: cached, s: style };
}

function extendRef(ws: XLSX.WorkSheet, ref: string) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? ref);
  const cell = XLSX.utils.decode_cell(ref);
  range.s.r = Math.min(range.s.r, cell.r);
  range.s.c = Math.min(range.s.c, cell.c);
  range.e.r = Math.max(range.e.r, cell.r);
  range.e.c = Math.max(range.e.c, cell.c);
  ws['!ref'] = XLSX.utils.encode_range(range);
}

export interface ExportData {
  currency: string;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  loans: Loan[];
  people: PersonWithBalance[];
}

/**
 * Builds the actual styled workbook from already-fetched data — kept pure
 * (no db/file-system calls) so it's straightforward to unit test.
 */
export function buildExportWorkbook(data: ExportData): XLSX.WorkBook {
  const { currency, accounts, categories, transactions, loans, people } = data;
  const symbol = currencySymbol(currency);
  const moneyStyle = moneyFmt(symbol);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryLabel = (id: string | null) => {
    if (!id) return 'Transfer';
    const cat = categoryById.get(id);
    if (!cat) return 'Deleted category';
    if (!cat.parentId) return cat.name;
    const parent = categoryById.get(cat.parentId);
    return parent ? `${parent.name} — ${cat.name}` : cat.name;
  };

  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountMinor, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amountMinor, 0);
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalanceMinor, 0);
  const totalDebt = loans
    .filter((l) => l.direction === 'borrowed' && l.status === 'active')
    .reduce((s, l) => s + l.outstandingPrincipalMinor, 0);
  const totalReceivable = loans
    .filter((l) => l.direction === 'lent' && l.status === 'active')
    .reduce((s, l) => s + l.outstandingPrincipalMinor, 0);
  const dateRange = sorted.length ? { from: sorted[sorted.length - 1].date, to: sorted[0].date } : null;

  const wb = XLSX.utils.book_new();

  // ---------------------------------------------------------------- Summary
  const summary = XLSX.utils.aoa_to_sheet([['', '']]);
  let r = 0;
  const put = (ref: string, v: any, style?: CellStyle, type?: 'n' | 's') => {
    setCell(summary, ref, v, style, type);
    extendRef(summary, ref);
  };
  put('A1', 'Flynse', titleStyle);
  put('B1', '', titleStyle);
  put('C1', '', titleStyle);
  put('A2', `Financial export — generated ${new Date().toLocaleString()}`, subtitleStyle);
  put('B2', '', subtitleStyle);
  put('C2', '', subtitleStyle);
  summary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  r = 3; // row index 3 = spreadsheet row 4, one blank row after the banner
  const stat = (label: string, value: number | string, color?: string, isMoney = true) => {
    const row = r++;
    put(`A${row + 1}`, label, statLabelStyle());
    put(`B${row + 1}`, '', statLabelStyle());
    if (typeof value === 'number') {
      put(
        `C${row + 1}`,
        isMoney ? toMajor(value) : value,
        statValueStyle(isMoney ? moneyStyle : '#,##0', color)
      );
    } else {
      put(`C${row + 1}`, value, {
        ...statValueStyle('@', color),
        alignment: { horizontal: 'right', vertical: 'center' },
      });
    }
    summary['!merges']!.push({ s: { r: row, c: 0 }, e: { r: row, c: 1 } });
  };
  stat('Total income (all exported transactions)', totalIncome, C.income);
  stat('Total expense (all exported transactions)', totalExpense, C.expense);
  stat('Net', totalIncome - totalExpense, totalIncome - totalExpense >= 0 ? C.income : C.expense);
  stat('Combined account balance', totalBalance, totalBalance >= 0 ? C.ink : C.expense);
  stat('Outstanding debt (active loans)', totalDebt, C.expense);
  stat('Owed to you (active loans)', totalReceivable, C.income);
  stat('Transactions exported', transactions.length, C.ink, false);
  stat('Date range', dateRange ? `${dateRange.from} to ${dateRange.to}` : 'No transactions', C.ink, false);
  r++;
  put(`A${r + 1}`, 'Exported from Flynse — this is a point-in-time snapshot of your own on-device data.', {
    font: { name: FONT_NAME, italic: true, sz: 9.5, color: { rgb: C.textMuted } },
  });
  summary['!cols'] = [{ wch: 34 }, { wch: 2 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  // ----------------------------------------------------------- Transactions
  const txHeaders = ['Date', 'Type', 'Account', 'To Account', 'Category', 'Amount', 'Note', 'Payment Mode'];
  const txRows = sorted.map((t) => [
    t.date,
    t.type[0].toUpperCase() + t.type.slice(1),
    accountName.get(t.accountId) ?? 'Deleted account',
    t.toAccountId ? (accountName.get(t.toAccountId) ?? 'Deleted account') : '',
    categoryLabel(t.categoryId),
    toMajor(t.amountMinor),
    t.note ?? '',
    t.paymentMode ? t.paymentMode.replace('_', ' ') : '',
  ]);
  const txSheet = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
  for (let c = 0; c < txHeaders.length; c++) {
    txSheet[XLSX.utils.encode_cell({ r: 0, c })].s = headerStyle();
  }
  txRows.forEach((row, i) => {
    const shaded = i % 2 === 1;
    const type = sorted[i].type;
    const amountColor = type === 'income' ? C.income : type === 'expense' ? C.expense : C.ink;
    for (let c = 0; c < row.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c });
      if (c === 5) {
        txSheet[ref].s = bodyStyle(shaded, {
          numFmt: moneyStyle,
          font: { color: { rgb: amountColor }, bold: true },
          alignment: { horizontal: 'right' },
        });
      } else {
        txSheet[ref].s = bodyStyle(shaded);
      }
    }
  });
  const totalRowIdx = txRows.length + 1; // 0-based row after the last data row
  const lastDataRow = txRows.length; // 1-based Excel row of the last data row
  setCell(
    txSheet,
    XLSX.utils.encode_cell({ r: totalRowIdx, c: 0 }),
    'Total (respects any filter applied above)',
    totalRowStyle()
  );
  for (let c = 1; c < 5; c++) {
    setCell(txSheet, XLSX.utils.encode_cell({ r: totalRowIdx, c }), '', totalRowStyle());
  }
  if (txRows.length > 0) {
    setFormula(
      txSheet,
      XLSX.utils.encode_cell({ r: totalRowIdx, c: 5 }),
      `SUBTOTAL(9,F2:F${lastDataRow + 1})`,
      toMajor(totalIncome) - toMajor(totalExpense),
      totalRowStyle({ numFmt: moneyStyle, alignment: { horizontal: 'right' } })
    );
  } else {
    setCell(
      txSheet,
      XLSX.utils.encode_cell({ r: totalRowIdx, c: 5 }),
      0,
      totalRowStyle({ numFmt: moneyStyle, alignment: { horizontal: 'right' } })
    );
  }
  for (let c = 6; c < 8; c++) {
    setCell(txSheet, XLSX.utils.encode_cell({ r: totalRowIdx, c }), '', totalRowStyle());
  }
  txSheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRowIdx, c: txHeaders.length - 1 },
  });
  txSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(lastDataRow, 1), c: txHeaders.length - 1 },
    }),
  };
  txSheet['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 26 },
    { wch: 14 },
    { wch: 32 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

  // --------------------------------------------------------------- Accounts
  const accHeaders = ['Account', 'Type', 'Balance', 'Currency'];
  const accRows = accounts.map((a) => [
    a.name,
    a.type.replace('_', ' '),
    toMajor(a.currentBalanceMinor),
    a.currency,
  ]);
  const accSheet = XLSX.utils.aoa_to_sheet([accHeaders, ...accRows]);
  for (let c = 0; c < accHeaders.length; c++) accSheet[XLSX.utils.encode_cell({ r: 0, c })].s = headerStyle();
  accRows.forEach((row, i) => {
    const shaded = i % 2 === 1;
    const negative = accounts[i].currentBalanceMinor < 0;
    for (let c = 0; c < row.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c });
      accSheet[ref].s =
        c === 2
          ? bodyStyle(shaded, {
              numFmt: moneyStyle,
              font: { color: { rgb: negative ? C.expense : C.ink }, bold: true },
              alignment: { horizontal: 'right' },
            })
          : bodyStyle(shaded);
    }
  });
  accSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(accRows.length, 1), c: accHeaders.length - 1 },
    }),
  };
  accSheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, accSheet, 'Accounts');

  // ------------------------------------------------------------- Categories
  const catTotals = new Map<string, { name: string; kind: string; total: number; count: number }>();
  for (const t of transactions) {
    if (t.type === 'transfer' || !t.categoryId) continue;
    const cat = categoryById.get(t.categoryId);
    const topId = cat?.parentId ?? t.categoryId;
    const top = categoryById.get(topId);
    const key = topId;
    const name = top?.name ?? cat?.name ?? 'Deleted category';
    const existing = catTotals.get(key);
    if (existing) {
      existing.total += t.amountMinor;
      existing.count += 1;
    } else {
      catTotals.set(key, { name, kind: t.type, total: t.amountMinor, count: 1 });
    }
  }
  const catRowsData = [...catTotals.values()].sort((a, b) =>
    a.kind === b.kind ? b.total - a.total : a.kind === 'expense' ? -1 : 1
  );
  const catHeaders = ['Category', 'Kind', 'Total', 'Transactions'];
  const catSheet = XLSX.utils.aoa_to_sheet([
    catHeaders,
    ...catRowsData.map((c) => [c.name, c.kind, toMajor(c.total), c.count]),
  ]);
  for (let c = 0; c < catHeaders.length; c++) catSheet[XLSX.utils.encode_cell({ r: 0, c })].s = headerStyle();
  catRowsData.forEach((c, i) => {
    const shaded = i % 2 === 1;
    const color = c.kind === 'income' ? C.income : C.expense;
    for (let col = 0; col < 4; col++) {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c: col });
      catSheet[ref].s =
        col === 2
          ? bodyStyle(shaded, {
              numFmt: moneyStyle,
              font: { color: { rgb: color }, bold: true },
              alignment: { horizontal: 'right' },
            })
          : bodyStyle(shaded, col === 3 ? { alignment: { horizontal: 'right' } } : undefined);
    }
  });
  catSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(catRowsData.length, 1), c: catHeaders.length - 1 },
    }),
  };
  catSheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, catSheet, 'Categories');

  // ----------------------------------------------------------------- Loans
  if (loans.length > 0) {
    const loanHeaders = ['Counterparty', 'Direction', 'Principal', 'Outstanding', 'EMI', 'Rate %', 'Status'];
    const loanSheet = XLSX.utils.aoa_to_sheet([
      loanHeaders,
      ...loans.map((l) => [
        l.counterparty,
        l.direction === 'borrowed' ? 'Borrowed' : 'Lent',
        toMajor(l.principalMinor),
        toMajor(l.outstandingPrincipalMinor),
        toMajor(l.emiAmountMinor),
        l.interestRateAnnualBp / 100,
        l.status[0].toUpperCase() + l.status.slice(1),
      ]),
    ]);
    for (let c = 0; c < loanHeaders.length; c++)
      loanSheet[XLSX.utils.encode_cell({ r: 0, c })].s = headerStyle();
    loans.forEach((l, i) => {
      const shaded = i % 2 === 1;
      const color = l.direction === 'borrowed' ? C.expense : C.income;
      for (let c = 0; c < loanHeaders.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: i + 1, c });
        if (c === 2 || c === 3 || c === 4) {
          loanSheet[ref].s = bodyStyle(shaded, {
            numFmt: moneyStyle,
            font: { color: { rgb: color }, bold: c === 3 },
            alignment: { horizontal: 'right' },
          });
        } else if (c === 5) {
          loanSheet[ref].s = bodyStyle(shaded, { numFmt: '0.00"%"', alignment: { horizontal: 'right' } });
        } else {
          loanSheet[ref].s = bodyStyle(shaded);
        }
      }
    });
    loanSheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: loans.length, c: loanHeaders.length - 1 } }),
    };
    loanSheet['!cols'] = [
      { wch: 22 },
      { wch: 11 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 9 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, loanSheet, 'Loans');
  }

  // ---------------------------------------------------------- Friends & Family
  if (people.length > 0) {
    const peopleHeaders = ['Name', 'Balance', 'Status'];
    const peopleSheet = XLSX.utils.aoa_to_sheet([
      peopleHeaders,
      ...people.map((p) => [
        p.name,
        toMajor(Math.abs(p.balanceMinor)),
        p.balanceMinor >= 0 ? 'Owes you' : 'You owe',
      ]),
    ]);
    for (let c = 0; c < peopleHeaders.length; c++)
      peopleSheet[XLSX.utils.encode_cell({ r: 0, c })].s = headerStyle();
    people.forEach((p, i) => {
      const shaded = i % 2 === 1;
      const color = p.balanceMinor >= 0 ? C.income : C.expense;
      for (let c = 0; c < peopleHeaders.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: i + 1, c });
        peopleSheet[ref].s =
          c === 1
            ? bodyStyle(shaded, {
                numFmt: moneyStyle,
                font: { color: { rgb: color }, bold: true },
                alignment: { horizontal: 'right' },
              })
            : bodyStyle(shaded, c === 2 ? { font: { color: { rgb: color } } } : undefined);
      }
    });
    peopleSheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: people.length, c: peopleHeaders.length - 1 },
      }),
    };
    peopleSheet['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, peopleSheet, 'Friends & Family');
  }

  return wb;
}

/** Fetches everything the workbook needs, builds it, and returns the raw bytes ready to write to a file. */
export async function generateExportWorkbookBytes(): Promise<Uint8Array> {
  const [currency, accounts, categories, transactions, loans, people] = await Promise.all([
    getDefaultCurrency(),
    listAccounts(),
    listCategories(true),
    listTransactions({ limit: 200000 }),
    listLoans(),
    listPeople(),
  ]);
  const wb = buildExportWorkbook({ currency, accounts, categories, transactions, loans, people });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}
