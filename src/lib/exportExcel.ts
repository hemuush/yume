import * as XLSX from 'xlsx-js-style';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { listPeople, PersonWithBalance } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';
import { toMajor } from './money';
import { Account, Category, Loan, Transaction } from '@/types';

/**
 * Yume's own palette, as plain 6-digit RGB hex (xlsx-js-style's CellStyleColor
 * takes "RRGGBB", no alpha) — mirrors src/constants/theme.ts exactly, so the
 * exported workbook reads as the same app, not a generic spreadsheet.
 */
const C = {
  ink: '12130F',
  surface: 'FFFDF6',
  surfaceAlt: 'F3ECE0',
  sky: '8FCBFF', // theme.colors.primary — was 'lime' (sage), ring-mark rebrand
  mint: '8FE8C8',
  gold: 'F0E1A8',
  income: '1C9A5B',
  incomeTint: 'DDF2E5',
  expense: 'E23F55',
  expenseTint: 'FBE1E4',
  white: 'FFFFFF',
  textMuted: '948E7C',
  borderSoft: 'E6DFC9', // theme.colors.borderSoft — the app's own hairline colour, used for the grid below
};

const FONT_NAME = 'Calibri'; // Archivo (the app's own display font) isn't available to Excel — bold + color carries the identity instead.

// Freeze panes were part of the sign-off design (the Transactions header row
// staying put on scroll) but there turned out to be no way to do it:
// xlsx-js-style has no `!freeze`/sheetView API at all, and writing one
// requires the paid SheetJS Pro tier or hand-patching the zip's sheet XML
// after the fact — both a lot of fragile surface area for one nice-to-have.
// Dropped rather than shipped half-working, exactly as flagged going in.

/** A thin border on all four sides — every bordered cell in this file uses this, so the grid reads as one table instead of colour patches with no edges (the actual complaint that started this rework). */
function allBorders(color: string, style: XLSX.BorderType = 'thin') {
  const side = { style, color: { rgb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

type CellStyle = XLSX.CellStyle;

const titleStyle: CellStyle = {
  font: { name: FONT_NAME, bold: true, sz: 18, color: { rgb: C.sky } },
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
    // A full border, not just the bottom edge — the header used to be the
    // one row with any border at all, so it sat on top of the borderless
    // body like a lid rather than the first row of the same table.
    border: allBorders(C.ink),
  };
}

function bodyStyle(shaded: boolean, extra?: CellStyle): CellStyle {
  return {
    font: { name: FONT_NAME, sz: 10.5, ...(extra?.font ?? {}) },
    fill: { fgColor: { rgb: shaded ? C.surfaceAlt : C.surface }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: extra?.alignment?.horizontal ?? 'left' },
    // Every body cell gets a hairline border now — this is the actual fix
    // for the export reading as "unclean": a coloured fill with no border
    // just floats over Excel's own default gridlines instead of forming a
    // table with them.
    border: allBorders(C.borderSoft),
    numFmt: extra?.numFmt,
  };
}

function totalRowStyle(extra?: CellStyle): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 10.5, color: { rgb: C.ink } },
    fill: { fgColor: { rgb: C.gold }, patternType: 'solid' },
    border: allBorders(C.ink),
    alignment: { vertical: 'center', horizontal: extra?.alignment?.horizontal ?? 'left' },
    numFmt: extra?.numFmt,
  };
}

/** One Summary KPI tile's fill+border, applied to every physical cell in its merge so the block reads as one solid card, not just its top-left cell. */
function tileStyle(fill: string): CellStyle {
  return {
    fill: { fgColor: { rgb: fill }, patternType: 'solid' },
    border: allBorders(C.ink),
    alignment: { vertical: 'center', horizontal: 'left' },
  };
}

function tileLabelStyle(fill: string): CellStyle {
  return {
    ...tileStyle(fill),
    font: { name: FONT_NAME, sz: 9, color: { rgb: C.textMuted } },
  };
}

function tileValueStyle(fill: string, numFmt: string, color: string = C.ink): CellStyle {
  return {
    ...tileStyle(fill),
    font: { name: FONT_NAME, bold: true, sz: 13, color: { rgb: color } },
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
  // Redesigned from a label/value list (narrow, mostly empty at the sheet's
  // actual width) into a 3-across grid of KPI tiles, the same shape as the
  // app's own stat tiles on Profile → You — six numbers at a glance instead
  // of a list you scroll.
  const summary = XLSX.utils.aoa_to_sheet([['', '']]);
  const put = (ref: string, v: any, style?: CellStyle, type?: 'n' | 's') => {
    setCell(summary, ref, v, style, type);
    extendRef(summary, ref);
  };
  const SUMMARY_COLS = 6; // 3 tiles across, 2 columns wide each
  put('A1', 'Yume — Financial Export', titleStyle);
  put('A2', `Generated ${new Date().toLocaleString()}`, subtitleStyle);
  summary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: SUMMARY_COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: SUMMARY_COLS - 1 } },
  ];
  for (let c = 1; c < SUMMARY_COLS; c++) {
    put(XLSX.utils.encode_cell({ r: 0, c }), '', titleStyle);
    put(XLSX.utils.encode_cell({ r: 1, c }), '', subtitleStyle);
  }

  const TILE_BASE_ROW = 3; // one blank row after the banner
  interface Tile {
    label: string;
    value: number | string;
    fill: string;
    color?: string;
    numFmt?: string;
  }
  const putTile = (index: number, tile: Tile) => {
    const colStart = (index % 3) * 2;
    const labelRow = TILE_BASE_ROW + Math.floor(index / 3) * 2;
    const valueRow = labelRow + 1;
    const numFmt = tile.numFmt ?? moneyStyle;
    const value = typeof tile.value === 'number' ? toMajor(tile.value) : tile.value;
    for (const col of [colStart, colStart + 1]) {
      put(
        XLSX.utils.encode_cell({ r: labelRow, c: col }),
        col === colStart ? tile.label : '',
        tileLabelStyle(tile.fill)
      );
      put(
        XLSX.utils.encode_cell({ r: valueRow, c: col }),
        col === colStart ? value : '',
        col === colStart
          ? tileValueStyle(tile.fill, typeof tile.value === 'number' ? numFmt : '@', tile.color)
          : {
              ...tileValueStyle(tile.fill, '@', tile.color),
              alignment: { horizontal: 'left', vertical: 'center' },
            }
      );
    }
    summary['!merges']!.push(
      { s: { r: labelRow, c: colStart }, e: { r: labelRow, c: colStart + 1 } },
      { s: { r: valueRow, c: colStart }, e: { r: valueRow, c: colStart + 1 } }
    );
  };

  const netMinor = totalIncome - totalExpense;
  putTile(0, { label: 'Total income', value: totalIncome, fill: C.incomeTint, color: C.income });
  putTile(1, { label: 'Total expense', value: totalExpense, fill: C.expenseTint, color: C.expense });
  putTile(2, {
    label: 'Net',
    value: netMinor,
    fill: C.surfaceAlt,
    color: netMinor >= 0 ? C.income : C.expense,
  });
  putTile(3, {
    label: 'Combined balance',
    value: totalBalance,
    fill: C.surfaceAlt,
    color: totalBalance >= 0 ? C.ink : C.expense,
  });
  putTile(4, { label: 'Outstanding debt', value: totalDebt, fill: C.expenseTint, color: C.expense });
  putTile(5, { label: 'Owed to you', value: totalReceivable, fill: C.incomeTint, color: C.income });

  const footerRow = TILE_BASE_ROW + 5; // one blank row after the two tile rows
  put(
    XLSX.utils.encode_cell({ r: footerRow, c: 0 }),
    `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} exported` +
      (dateRange ? ` · ${dateRange.from} to ${dateRange.to}` : ' · no transactions') +
      ' · Exported from Yume — a point-in-time snapshot of your own on-device data.',
    { font: { name: FONT_NAME, italic: true, sz: 9.5, color: { rgb: C.textMuted } } }
  );
  summary['!cols'] = Array.from({ length: SUMMARY_COLS }, () => ({ wch: 18 }));
  // Banner rows tall enough to read as a real header; tile label rows short,
  // value rows tall — the label/value height contrast is what makes each
  // pair read as one tile rather than two ordinary rows.
  summary['!rows'] = [
    { hpt: 26 },
    { hpt: 20 },
    { hpt: 6 },
    { hpt: 16 },
    { hpt: 26 },
    { hpt: 16 },
    { hpt: 26 },
  ];
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
  const catTotals = new Map<
    string,
    { name: string; kind: string; total: number; count: number; color: string }
  >();
  for (const t of transactions) {
    if (t.type === 'transfer' || !t.categoryId) continue;
    const cat = categoryById.get(t.categoryId);
    const topId = cat?.parentId ?? t.categoryId;
    const top = categoryById.get(topId);
    const key = topId;
    const name = top?.name ?? cat?.name ?? 'Deleted category';
    const color = top?.color ?? cat?.color ?? C.textMuted;
    const existing = catTotals.get(key);
    if (existing) {
      existing.total += t.amountMinor;
      existing.count += 1;
    } else {
      catTotals.set(key, { name, kind: t.type, total: t.amountMinor, count: 1, color });
    }
  }
  const catRowsData = [...catTotals.values()].sort((a, b) =>
    a.kind === b.kind ? b.total - a.total : a.kind === 'expense' ? -1 : 1
  );
  // A leading colour-swatch column, reading each category's own stored
  // `color` — the same hex every chip and icon badge for that category
  // already uses in the app, so this sheet ties back to it visually instead
  // of being names with no link to how the category actually looks in Yume.
  const catHeaders = ['', 'Category', 'Kind', 'Total', 'Transactions'];
  const catSheet = XLSX.utils.aoa_to_sheet([
    catHeaders,
    ...catRowsData.map((c) => ['', c.name, c.kind, toMajor(c.total), c.count]),
  ]);
  for (let c = 0; c < catHeaders.length; c++) catSheet[XLSX.utils.encode_cell({ r: 0, c })].s = headerStyle();
  catRowsData.forEach((c, i) => {
    const shaded = i % 2 === 1;
    const amountColor = c.kind === 'income' ? C.income : C.expense;
    for (let col = 0; col < 5; col++) {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c: col });
      if (col === 0) {
        catSheet[ref].s = {
          fill: { fgColor: { rgb: c.color.replace('#', '') }, patternType: 'solid' },
          border: allBorders(C.borderSoft),
        };
      } else if (col === 3) {
        catSheet[ref].s = bodyStyle(shaded, {
          numFmt: moneyStyle,
          font: { color: { rgb: amountColor }, bold: true },
          alignment: { horizontal: 'right' },
        });
      } else {
        catSheet[ref].s = bodyStyle(shaded, col === 4 ? { alignment: { horizontal: 'right' } } : undefined);
      }
    }
  });
  catSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(catRowsData.length, 1), c: catHeaders.length - 1 },
    }),
  };
  catSheet['!cols'] = [{ wch: 3 }, { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 14 }];
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
