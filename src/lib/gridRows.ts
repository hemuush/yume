/**
 * A calendar-style grid's rows: `leadingPad` blanks before the first cell,
 * then the cells, cut into rows of `columns` and padded with blanks at the
 * end so every row has exactly `columns` slots.
 *
 * Grids are laid out as explicit rows of equal-share slots rather than one
 * wrapping row of 1/7-width (14.2857%) cells: seven of those can round to a
 * hair over the row's width, and then the 7th cell wraps — Saturday ends up
 * empty and every later date lands under the wrong weekday. Explicit rows
 * can't wrap. Used by Reports' spending calendar and the date picker.
 */
export function gridRows<T>(cells: T[], leadingPad: number, columns: number): (T | null)[][] {
  const slots: (T | null)[] = [...Array.from({ length: leadingPad }, () => null), ...cells];
  while (slots.length % columns !== 0) slots.push(null);
  const rows: (T | null)[][] = [];
  for (let i = 0; i < slots.length; i += columns) rows.push(slots.slice(i, i + columns));
  return rows;
}
