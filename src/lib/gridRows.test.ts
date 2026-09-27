import { gridRows } from './gridRows';

describe('gridRows', () => {
  // September 2026 starts on a Tuesday: two blanks, then the 1st.
  const september = Array.from({ length: 30 }, (_, i) => i + 1);
  const rows = gridRows(september, 2, 7);

  it('gives every row exactly seven slots, Sunday to Saturday', () => {
    expect(rows.every((r) => r.length === 7)).toBe(true);
    expect(rows).toHaveLength(5);
  });

  it('puts each date under its real weekday', () => {
    expect(rows[0]).toEqual([null, null, 1, 2, 3, 4, 5]); // 5 Sep 2026 is a Saturday
    expect(rows[1][0]).toBe(6); // Sunday
    expect(rows[4]).toEqual([27, 28, 29, 30, null, null, null]); // 30 Sep is a Wednesday
  });

  it('lays a year out four months to a row', () => {
    const months = gridRows(
      Array.from({ length: 12 }, (_, i) => i),
      0,
      4
    );
    expect(months.map((r) => r.length)).toEqual([4, 4, 4]);
  });
});
