/**
 * Reports' custom ranges: stepping by the range's own length (whole months
 * by months, so a financial year steps to the next one), not stepping into
 * the future, India's financial year, and the labels the period pill shows.
 */
import {
  shiftCustomRange,
  stepWindow,
  canStepWindowForward,
  previousWindowRange,
  windowRange,
  financialYearOf,
  financialYearRange,
  customRangeLabel,
  rangeDays,
  CustomRange,
} from './period';
import { buildRangeHeatGrid } from '@/features/reports/reportsInsights';

const custom = (start: string, end: string): CustomRange => ({ granularity: 'custom', start, end });

describe('custom report ranges', () => {
  it('steps a financial year to the next and previous one', () => {
    expect(shiftCustomRange(financialYearRange(2025), 1)).toEqual(financialYearRange(2026));
    expect(shiftCustomRange(financialYearRange(2025), -1)).toEqual(financialYearRange(2024));
  });

  it('steps whole months by months, even across short months', () => {
    expect(shiftCustomRange(custom('2026-06-01', '2026-08-31'), -1)).toEqual(
      custom('2026-03-01', '2026-05-31')
    );
    expect(shiftCustomRange(custom('2026-01-01', '2026-01-31'), 1)).toEqual(
      custom('2026-02-01', '2026-02-28')
    );
  });

  it('steps any other range by its number of days', () => {
    expect(shiftCustomRange(custom('2026-09-01', '2026-09-14'), 1)).toEqual(
      custom('2026-09-15', '2026-09-28')
    );
    expect(shiftCustomRange(custom('2026-08-28', '2026-09-26'), -1)).toEqual(
      custom('2026-07-29', '2026-08-27')
    );
  });

  it('compares with the same length just before', () => {
    expect(previousWindowRange(custom('2026-09-01', '2026-09-14'))).toEqual({
      start: '2026-08-18',
      end: '2026-08-31',
    });
    expect(windowRange(custom('2026-09-01', '2026-09-14'))).toEqual({
      start: '2026-09-01',
      end: '2026-09-14',
    });
  });

  it("won't step into a range that starts after today", () => {
    const today = '2026-09-26';
    const lastTwoWeeks = custom('2026-09-13', '2026-09-26');
    expect(canStepWindowForward(lastTwoWeeks, today)).toBe(false);
    expect(stepWindow(lastTwoWeeks, 1, today)).toBe(lastTwoWeeks);
    // This financial year hasn't ended, and the next one hasn't started.
    expect(canStepWindowForward(financialYearRange(2026), today)).toBe(false);
    expect(canStepWindowForward(financialYearRange(2025), today)).toBe(true);
  });

  it('knows which financial year a date is in (1 Apr to 31 Mar)', () => {
    expect(financialYearOf('2026-03-31')).toBe(2025);
    expect(financialYearOf('2026-04-01')).toBe(2026);
    expect(financialYearOf('2026-12-31')).toBe(2026);
  });

  it('labels a financial year, a whole month, and other ranges', () => {
    expect(customRangeLabel(financialYearRange(2026))).toBe('FY 2026–27');
    expect(customRangeLabel(financialYearRange(2099))).toBe('FY 2099–00');
    expect(customRangeLabel(custom('2026-09-01', '2026-09-30'))).toMatch(/2026/);
    const sameYear = customRangeLabel(custom('2026-04-01', '2026-09-26'));
    expect(sameYear).toContain(' – ');
    expect(sameYear.match(/2026/g)).toHaveLength(1);
    const twoYears = customRangeLabel(custom('2025-12-20', '2026-01-04'));
    expect(twoYears).toMatch(/2025.* – .*2026/);
  });

  it('counts days inclusively', () => {
    expect(rangeDays({ start: '2026-09-01', end: '2026-09-01' })).toBe(1);
    expect(rangeDays({ start: '2026-02-01', end: '2026-03-01' })).toBe(29);
  });
});

describe('buildRangeHeatGrid', () => {
  const daily = [
    { date: '2026-08-30', totalMinor: 5000 },
    { date: '2026-09-02', totalMinor: 20000 },
  ];

  it('draws a short range day by day, lined up under its weekdays', () => {
    const onDayPress = jest.fn();
    const grid = buildRangeHeatGrid({
      start: '2026-08-28',
      end: '2026-09-03',
      daily,
      onDayPress,
      todayIso: '2026-09-03',
    });
    expect(grid.columns).toBe(7);
    expect(grid.leadingPad).toBe(5); // 28 Aug 2026 is a Friday
    expect(grid.cells.map((c) => c.label)).toEqual(['28', '29', '30', '31', '1', '2', '3']);
    expect(grid.cells.find((c) => c.key === '2026-09-02')?.level).toBe(4);
    expect(grid.cells.find((c) => c.key === '2026-09-03')?.isToday).toBe(true);
    grid.cells.find((c) => c.key === '2026-08-30')?.onPress?.();
    expect(onDayPress).toHaveBeenCalledWith('2026-08-30');
    expect(grid.cells.find((c) => c.key === '2026-08-31')?.onPress).toBeUndefined();
  });

  it('draws a long range one cell per month, from its own days only', () => {
    const grid = buildRangeHeatGrid({
      start: '2026-04-01',
      end: '2026-09-26',
      daily: [
        { date: '2026-04-10', totalMinor: 100 },
        { date: '2026-09-20', totalMinor: 400 },
      ],
      onDayPress: jest.fn(),
    });
    expect(grid.columns).toBe(4);
    expect(grid.cells.map((c) => c.key)).toEqual([
      'm-2026-04',
      'm-2026-05',
      'm-2026-06',
      'm-2026-07',
      'm-2026-08',
      'm-2026-09',
    ]);
    expect(grid.cells.map((c) => c.level)).toEqual([2, 0, 0, 0, 0, 4]);
  });
});
