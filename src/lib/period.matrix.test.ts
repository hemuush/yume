/**
 * Combinatorial coverage of the browsable-period cursor used by Home,
 * Reports and Transactions. The cursor is an offset from "now" rather than an
 * absolute date, so stepping it must stay correct across month lengths and
 * year boundaries for any reference date.
 */
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodRange,
  previousPeriodRange,
  periodLabel,
  canStepForward,
  stepPeriod,
  setGranularity,
} from './period';
import { toLocalIsoDate, parseLocalIsoDate } from './date';

// Reference dates chosen to include month-end days (28-31), leap-Feb, and
// both year boundaries.
const REFERENCES = [
  '2024-01-01',
  '2024-02-29',
  '2024-03-31',
  '2024-06-15',
  '2024-12-31',
  '2025-01-31',
  '2025-07-01',
  '2026-02-28',
  '2026-08-31',
  '2027-11-30',
].map(parseLocalIsoDate);

const OFFSETS = [0, -1, -2, -3, -6, -11, -12, -13, -18, -24, -36];

describe('periodRange (month) — a full calendar month, start ≤ end, for every reference × offset', () => {
  for (const ref of REFERENCES) {
    for (const offset of OFFSETS) {
      const cursor: PeriodCursor = { granularity: 'month', offset };
      it(`${toLocalIsoDate(ref)} @ offset ${offset}`, () => {
        const range = periodRange(cursor, ref);
        const start = parseLocalIsoDate(range.start);
        const end = parseLocalIsoDate(range.end);
        // Same month & year for start and end.
        expect(start.getFullYear()).toBe(end.getFullYear());
        expect(start.getMonth()).toBe(end.getMonth());
        // Starts on the 1st, ends on that month's real last day.
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate());
        expect(range.start <= range.end).toBe(true);
        // The anchored month is `offset` months before the reference month.
        const anchor = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
        expect(start.getFullYear()).toBe(anchor.getFullYear());
        expect(start.getMonth()).toBe(anchor.getMonth());
      });
    }
  }
});

describe('periodRange (year) — a full calendar year for every reference × offset', () => {
  for (const ref of REFERENCES) {
    for (const offset of [0, -1, -2, -5, -10]) {
      const cursor: PeriodCursor = { granularity: 'year', offset };
      it(`${toLocalIsoDate(ref)} @ offset ${offset}`, () => {
        const range = periodRange(cursor, ref);
        const y = ref.getFullYear() + offset;
        expect(range.start).toBe(`${y}-01-01`);
        expect(range.end).toBe(`${y}-12-31`);
      });
    }
  }
});

describe('previousPeriodRange — exactly one period earlier, contiguous with the current one', () => {
  for (const ref of REFERENCES) {
    for (const offset of OFFSETS) {
      for (const granularity of ['month', 'year'] as const) {
        const cursor: PeriodCursor = { granularity, offset };
        it(`${granularity} ${toLocalIsoDate(ref)} @ ${offset}`, () => {
          const cur = periodRange(cursor, ref);
          const prev = previousPeriodRange(cursor, ref);
          expect(prev.end < cur.start).toBe(true);
          // The gap between prev.end and cur.start is exactly one day.
          const dayAfterPrev = new Date(parseLocalIsoDate(prev.end));
          dayAfterPrev.setDate(dayAfterPrev.getDate() + 1);
          expect(toLocalIsoDate(dayAfterPrev)).toBe(cur.start);
          // And it equals periodRange at offset-1.
          expect(prev).toEqual(periodRange({ granularity, offset: offset - 1 }, ref));
        });
      }
    }
  }
});

describe('canStepForward / stepPeriod', () => {
  // The app only ever holds offsets ≤ 0 (0 = current period, negative = past).
  for (const offset of [-30, -12, -5, -3, -1, 0]) {
    for (const granularity of ['month', 'year'] as const) {
      const cursor: PeriodCursor = { granularity, offset };
      it(`canStepForward is (offset < 0): ${granularity} @ ${offset}`, () => {
        expect(canStepForward(cursor)).toBe(offset < 0);
      });
      it(`stepPeriod back always decrements: ${granularity} @ ${offset}`, () => {
        expect(stepPeriod(cursor, -1)).toEqual({ granularity, offset: offset - 1 });
      });
      it(`stepPeriod forward moves toward 0 and never past it: ${granularity} @ ${offset}`, () => {
        const next = stepPeriod(cursor, 1);
        expect(next.offset).toBeLessThanOrEqual(0);
        // At the current period a forward step is a no-op; otherwise it advances by one.
        expect(next.offset).toBe(offset < 0 ? offset + 1 : offset);
      });
    }
  }

  it('stepping back N times then forward N times returns to the current period', () => {
    for (const n of [1, 3, 12, 30]) {
      let c: PeriodCursor = { ...CURRENT_PERIOD };
      for (let i = 0; i < n; i++) c = stepPeriod(c, -1);
      for (let i = 0; i < n; i++) c = stepPeriod(c, 1);
      expect(c).toEqual(CURRENT_PERIOD);
    }
  });
});

describe('setGranularity — switching axes resets to the current period, same axis is a no-op', () => {
  for (const offset of [0, -1, -7, -24]) {
    it(`month@${offset} → year resets offset to 0`, () => {
      expect(setGranularity({ granularity: 'month', offset }, 'year')).toEqual({
        granularity: 'year',
        offset: 0,
      });
    });
    it(`year@${offset} → month resets offset to 0`, () => {
      expect(setGranularity({ granularity: 'year', offset }, 'month')).toEqual({
        granularity: 'month',
        offset: 0,
      });
    });
    it(`month@${offset} → month is unchanged`, () => {
      const c: PeriodCursor = { granularity: 'month', offset };
      expect(setGranularity(c, 'month')).toBe(c);
    });
  }
});

describe('periodLabel — always a non-empty string for every reference × offset × granularity', () => {
  for (const ref of REFERENCES) {
    for (const offset of OFFSETS) {
      for (const granularity of ['month', 'year'] as const) {
        it(`${granularity} ${toLocalIsoDate(ref)} @ ${offset}`, () => {
          const label = periodLabel({ granularity, offset }, ref);
          expect(typeof label).toBe('string');
          expect(label.trim().length).toBeGreaterThan(0);
        });
      }
    }
  }
});
