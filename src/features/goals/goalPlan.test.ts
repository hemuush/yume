/** What a goal needs to finish on time, and whether it is ahead of that. All figures are made up. */
import { goalPlan, summarizeGoals, goalHues, createdLocalDate } from './goalPlan';

const TODAY = '2026-10-02';

const goal = (over: Partial<Parameters<typeof goalPlan>[0]> = {}) => ({
  currentAmountMinor: 16200000,
  targetAmountMinor: 20000000,
  targetDate: '2026-12-31',
  createdAt: '2026-01-01 00:00:00',
  ...over,
});

describe('goalPlan', () => {
  it('counts the part month and rounds the monthly amount up', () => {
    const p = goalPlan(goal(), TODAY);
    expect(p.toGoMinor).toBe(3800000);
    expect(p.monthsLeft).toBe(3);
    expect(p.perMonthMinor).toBe(1266667);
    expect(p.pastDue).toBe(false);
  });

  it('counts exactly the months to the same day as whole months', () => {
    expect(goalPlan(goal({ targetDate: '2027-03-02' }), TODAY).monthsLeft).toBe(5);
    expect(goalPlan(goal({ targetDate: '2027-03-31' }), TODAY).monthsLeft).toBe(6);
  });

  it('is ahead when the saved share is past the even-saving line', () => {
    expect(goalPlan(goal(), TODAY).pace).toBe('ahead');
  });

  it('is on pace within the slack either side of the line', () => {
    expect(goalPlan(goal({ currentAmountMinor: 15200000 }), TODAY).pace).toBe('onPace');
  });

  it('is behind when well under the line', () => {
    const p = goalPlan(
      goal({
        currentAmountMinor: 2800000,
        targetAmountMinor: 8000000,
        targetDate: '2027-03-31',
        createdAt: '2026-03-01 00:00:00',
      }),
      TODAY
    );
    expect(p.pace).toBe('behind');
    expect(p.monthsLeft).toBe(6);
    expect(p.perMonthMinor).toBe(866667);
  });

  it('has no month plan or pace without a target date', () => {
    expect(goalPlan(goal({ targetDate: null }), TODAY)).toMatchObject({
      toGoMinor: 3800000,
      monthsLeft: null,
      perMonthMinor: null,
      pace: null,
    });
  });

  it('has nothing left to plan once the goal is reached', () => {
    expect(goalPlan(goal({ currentAmountMinor: 20500000 }), TODAY)).toMatchObject({
      toGoMinor: 0,
      perMonthMinor: null,
      pace: null,
    });
  });

  it('is behind with no monthly amount once the date has passed', () => {
    expect(goalPlan(goal({ targetDate: '2026-09-30' }), TODAY)).toMatchObject({
      pastDue: true,
      pace: 'behind',
      perMonthMinor: null,
      monthsLeft: 0,
    });
  });
});

describe('summarizeGoals', () => {
  it('adds saved, target and the monthly amounts across goals', () => {
    const t = summarizeGoals(
      [goal(), goal({ currentAmountMinor: 4050000, targetAmountMinor: 5000000 })],
      TODAY
    );
    expect(t.savedMinor).toBe(20250000);
    expect(t.targetMinor).toBe(25000000);
    expect(t.percent).toBeCloseTo(81, 5);
    expect(t.goalCount).toBe(2);
    expect(t.perMonthMinor).toBe(1266667 + 316667);
  });

  it('does not count money saved past a target toward the total', () => {
    expect(summarizeGoals([goal({ currentAmountMinor: 30000000 })], TODAY).savedMinor).toBe(20000000);
  });

  it('is zero for no goals', () => {
    expect(summarizeGoals([], TODAY)).toMatchObject({ savedMinor: 0, percent: 0, goalCount: 0 });
  });
});

describe('goalHues', () => {
  it('gives each goal a colour by its place and wraps around', () => {
    const hues = goalHues(Array.from({ length: 7 }, (_, i) => ({ id: `g${i}` })));
    expect(hues.g0).not.toBe(hues.g1);
    expect(hues.g5).toBe(hues.g0);
  });
});

describe('createdLocalDate', () => {
  it("reads SQLite's UTC timestamp as the local calendar day it fell on", () => {
    const utc = new Date('2026-03-01T23:30:00Z');
    const local = `${utc.getFullYear()}-${String(utc.getMonth() + 1).padStart(2, '0')}-${String(utc.getDate()).padStart(2, '0')}`;
    expect(createdLocalDate('2026-03-01 23:30:00')).toBe(local);
  });

  it('honours an explicit zone and passes a plain date through', () => {
    expect(createdLocalDate('2026-03-01T12:00:00+05:30')).toBe(createdLocalDate('2026-03-01 06:30:00'));
    expect(createdLocalDate('2026-03-01')).toBe('2026-03-01');
  });
});
