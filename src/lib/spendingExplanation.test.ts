import { explainSpending, matchedSpendingRanges } from './spendingExplanation';
it('separates frequency, size and refunds while preserving the exact difference', () => {
  const r = explainSpending(
    { count: 6, grossMinor: 90000, refundMinor: 1000 },
    { count: 4, grossMinor: 40000, refundMinor: 5000 }
  );
  expect(r).toMatchObject({ frequencyMinor: 25000, sizeMinor: 25000, refundsMinor: 4000, deltaMinor: 54000 });
  expect(r.frequencyMinor + r.sizeMinor + r.refundsMinor).toBe(r.deltaMinor);
});
it('does not invent a previous purchase size for a new category', () => {
  expect(
    explainSpending(
      { count: 2, grossMinor: 10000, refundMinor: 0 },
      { count: 0, grossMinor: 0, refundMinor: 0 }
    )
  ).toMatchObject({ frequencyMinor: 10000, sizeMinor: 0, newCategory: true });
});
it('explains a refund-only current period and decreases', () => {
  const r = explainSpending(
    { count: 0, grossMinor: 0, refundMinor: 10000 },
    { count: 3, grossMinor: 20000, refundMinor: 0 }
  );
  expect(r.deltaMinor).toBe(-30000);
  expect(r.frequencyMinor + r.sizeMinor + r.refundsMinor).toBe(-30000);
});
it('compares matching elapsed days rather than a partial month with a full month', () => {
  expect(
    matchedSpendingRanges(
      { start: '2026-10-01', end: '2026-10-31' },
      { start: '2026-09-01', end: '2026-09-30' },
      '2026-10-12'
    )
  ).toEqual({
    days: 12,
    current: { start: '2026-10-01', end: '2026-10-12' },
    previous: { start: '2026-09-01', end: '2026-09-12' },
  });
});
it('handles different month lengths and future ranges', () => {
  expect(
    matchedSpendingRanges(
      { start: '2026-03-01', end: '2026-03-31' },
      { start: '2026-02-01', end: '2026-02-28' },
      '2026-10-12'
    ).days
  ).toBe(28);
  expect(() =>
    matchedSpendingRanges(
      { start: '2027-01-01', end: '2027-01-31' },
      { start: '2026-12-01', end: '2026-12-31' },
      '2026-10-12'
    )
  ).toThrow();
});
