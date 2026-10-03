/**
 * Calendar grid rows: `leadingPad` blanks, then cells, padded at the end so every row has `columns` slots.
 * Explicit rows, not one wrapping row of 1/7 cells: rounding can wrap the 7th cell and misplace later dates.
 */
export function gridRows<T>(cells: T[], leadingPad: number, columns: number): (T | null)[][] {
  const slots: (T | null)[] = [...Array.from({ length: leadingPad }, () => null), ...cells];
  while (slots.length % columns !== 0) slots.push(null);
  const rows: (T | null)[][] = [];
  for (let i = 0; i < slots.length; i += columns) rows.push(slots.slice(i, i + columns));
  return rows;
}
