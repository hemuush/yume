import * as XLSX from 'xlsx-js-style';

/**
 * Yume's palette as plain 6-digit RGB hex (xlsx-js-style takes "RRGGBB", no alpha), mirroring
 * src/constants/theme.ts so the workbook reads as the same app.
 */
export const C = {
  ink: '12130F',
  surface: 'FFFDF6',
  surfaceAlt: 'F3ECE0',
  sky: '8FCBFF', // theme.colors.primary
  mint: '8FE8C8',
  gold: 'F0E1A8',
  income: '1C9A5B',
  incomeTint: 'DDF2E5',
  expense: 'E23F55',
  expenseTint: 'FBE1E4',
  white: 'FFFFFF',
  textMuted: '948E7C',
  borderSoft: 'E6DFC9', // theme.colors.borderSoft — the app’s own hairline colour, used for the grid below
};

export const FONT_NAME = 'Calibri'; // Archivo (the app’s own display font) isn’t available to Excel — bold + color carries the identity instead.

// No freeze panes: xlsx-js-style has no `!freeze`/sheetView API, and the alternatives (paid SheetJS Pro or
// hand-patching the sheet XML) are too fragile for a nice-to-have.

/** A thin border on all four sides — every bordered cell in this file uses this, so the grid reads as one table instead of colour patches with no edges. */
export function allBorders(color: string, style: XLSX.BorderType = 'thin') {
  const side = { style, color: { rgb: color } };
  return { top: side, bottom: side, left: side, right: side };
}

export type CellStyle = XLSX.CellStyle;

export const titleStyle: CellStyle = {
  font: { name: FONT_NAME, bold: true, sz: 18, color: { rgb: C.sky } },
  fill: { fgColor: { rgb: C.ink }, patternType: 'solid' },
  alignment: { vertical: 'center', horizontal: 'left' },
};

export const subtitleStyle: CellStyle = {
  font: { name: FONT_NAME, italic: true, sz: 10, color: { rgb: C.surfaceAlt } },
  fill: { fgColor: { rgb: C.ink }, patternType: 'solid' },
  alignment: { vertical: 'center', horizontal: 'left' },
};

export function headerStyle(fill: string = C.ink, fontColor: string = C.white): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 11, color: { rgb: fontColor } },
    fill: { fgColor: { rgb: fill }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: 'left' },
    // A full border, not just the bottom edge, so the header reads as the first row of the same table
    // rather than a lid on a borderless body.
    border: allBorders(C.ink),
  };
}

export function bodyStyle(shaded: boolean, extra?: CellStyle): CellStyle {
  return {
    font: { name: FONT_NAME, sz: 10.5, ...(extra?.font ?? {}) },
    fill: { fgColor: { rgb: shaded ? C.surfaceAlt : C.surface }, patternType: 'solid' },
    alignment: { vertical: 'center', horizontal: extra?.alignment?.horizontal ?? 'left' },
    // Every body cell gets a hairline border: a coloured fill with no border floats over Excel's default
    // gridlines instead of forming a table.
    border: allBorders(C.borderSoft),
    numFmt: extra?.numFmt,
  };
}

export function totalRowStyle(extra?: CellStyle): CellStyle {
  return {
    font: { name: FONT_NAME, bold: true, sz: 10.5, color: { rgb: C.ink } },
    fill: { fgColor: { rgb: C.gold }, patternType: 'solid' },
    border: allBorders(C.ink),
    alignment: { vertical: 'center', horizontal: extra?.alignment?.horizontal ?? 'left' },
    numFmt: extra?.numFmt,
  };
}

/** One Summary KPI tile's fill+border, applied to every physical cell in its merge so the block reads as one solid card, not just its top-left cell. */
export function tileStyle(fill: string): CellStyle {
  return {
    fill: { fgColor: { rgb: fill }, patternType: 'solid' },
    border: allBorders(C.ink),
    alignment: { vertical: 'center', horizontal: 'left' },
  };
}

export function tileLabelStyle(fill: string): CellStyle {
  return {
    ...tileStyle(fill),
    font: { name: FONT_NAME, sz: 9, color: { rgb: C.textMuted } },
  };
}

export function tileValueStyle(fill: string, numFmt: string, color: string = C.ink): CellStyle {
  return {
    ...tileStyle(fill),
    font: { name: FONT_NAME, bold: true, sz: 13, color: { rgb: color } },
    numFmt,
  };
}

export function moneyFmt(symbol: string): string {
  // Escaped so Excel treats the symbol as a literal, not a format directive; negatives render red with a
  // leading minus, matching how the app colours expenses.
  return `"${symbol}"#,##0.00;[Red]-"${symbol}"#,##0.00`;
}

/** What a cell can hold: a number, text, or a date. */
export type CellValue = string | number | Date;

export function setCell(
  ws: XLSX.WorkSheet,
  ref: string,
  value: CellValue,
  style?: CellStyle,
  type?: 'n' | 's' | 'd'
) {
  const cell: XLSX.CellObject & { s?: CellStyle } = { t: 's', v: value };
  if (type) cell.t = type;
  else if (typeof value === 'number') cell.t = 'n';
  else cell.t = 's';
  if (style) cell.s = style;
  ws[ref] = cell;
}

export function setFormula(
  ws: XLSX.WorkSheet,
  ref: string,
  formula: string,
  cached: number,
  style?: CellStyle
) {
  ws[ref] = { t: 'n', f: formula, v: cached, s: style };
}

export function extendRef(ws: XLSX.WorkSheet, ref: string) {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? ref);
  const cell = XLSX.utils.decode_cell(ref);
  range.s.r = Math.min(range.s.r, cell.r);
  range.s.c = Math.min(range.s.c, cell.c);
  range.e.r = Math.max(range.e.r, cell.r);
  range.e.c = Math.max(range.e.c, cell.c);
  ws['!ref'] = XLSX.utils.encode_range(range);
}
