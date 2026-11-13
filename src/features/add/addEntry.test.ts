import { dateChipLabel } from './addEntry';

describe('dateChipLabel', () => {
  const now = new Date(2026, 10, 12);
  it('is the short day and month for a date in this year', () => {
    const label = dateChipLabel('2026-03-04', now);
    expect(label).not.toContain('2026');
    expect(label).toMatch(/4/);
  });
  it('names the year for any other year, past or future', () => {
    expect(dateChipLabel('2025-11-12', now)).toContain('2025');
    expect(dateChipLabel('2027-11-12', now)).toContain('2027');
  });
});
