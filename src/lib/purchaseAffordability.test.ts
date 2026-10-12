import { purchaseAffordability } from './purchaseAffordability';
const base = {
  balanceMinor: 1000000,
  reservedMinor: 300000,
  amountMinor: 200000,
  today: '2026-10-12',
  purchaseDate: '2026-10-12',
  through: '2026-11-11',
  movements: [],
};
it('protects reservations instead of treating the full balance as available', () => {
  expect(purchaseAffordability(base)).toMatchObject({
    afterPurchaseMinor: 500000,
    lowestMinor: 500000,
    shortfallMinor: 0,
  });
});
it('checks same-day debits before income and includes overdue bills', () => {
  const result = purchaseAffordability({
    ...base,
    movements: [
      { date: '2026-10-10', deltaMinor: -600000, label: 'Overdue EMI' },
      { date: '2026-10-12', deltaMinor: 400000, label: 'Income' },
    ],
  });
  expect(result.shortfallMinor).toBe(100000);
  expect(result.endMinor).toBe(300000);
});
it('handles income-only schedules and ignores movements beyond the estimate horizon', () => {
  expect(
    purchaseAffordability({
      ...base,
      movements: [
        { date: '2026-10-15', deltaMinor: 100000, label: 'Income' },
        { date: '2026-12-01', deltaMinor: -9999999, label: 'Later bill' },
      ],
    }).endMinor
  ).toBe(600000);
});
it('does not confuse a recurring label with the planned purchase', () => {
  const r = purchaseAffordability({
    ...base,
    movements: [{ date: '2026-10-30', deltaMinor: -10000, label: 'Planned purchase' }],
  });
  expect(r.afterPurchaseMinor).toBe(500000);
});
it('rejects zero amounts, past dates and excessive horizons', () => {
  expect(() => purchaseAffordability({ ...base, amountMinor: 0 })).toThrow();
  expect(() => purchaseAffordability({ ...base, purchaseDate: '2026-10-01' })).toThrow();
  expect(() => purchaseAffordability({ ...base, through: '2027-03-01' })).toThrow();
});
