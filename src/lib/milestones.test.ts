import {
  budgetMonthCopy,
  budgetMonthHeld,
  budgetMonthKey,
  goalMilestoneCopy,
  goalMilestoneKey,
  milestoneReached,
  milestonesUpTo,
} from './milestones';

describe('milestoneReached', () => {
  it('fires when a save crosses a line', () => {
    expect(milestoneReached(2000, 2600, 10000)).toBe(25);
    expect(milestoneReached(4900, 5000, 10000)).toBe(50);
    expect(milestoneReached(7000, 7500, 10000)).toBe(75);
    expect(milestoneReached(9000, 10000, 10000)).toBe(100);
  });

  it('reports the highest line when one save jumps several', () => {
    expect(milestoneReached(1000, 8000, 10000)).toBe(75);
    expect(milestoneReached(0, 12000, 10000)).toBe(100);
  });

  it('stays quiet when nothing new is crossed', () => {
    expect(milestoneReached(2600, 3000, 10000)).toBeNull();
    expect(milestoneReached(5000, 5100, 10000)).toBeNull();
    expect(milestoneReached(10000, 12000, 10000)).toBeNull();
  });

  it('never fires for a withdrawal or a goal with no target', () => {
    expect(milestoneReached(6000, 4000, 10000)).toBeNull();
    expect(milestoneReached(0, 100, 0)).toBeNull();
  });
});

describe('keys and copy', () => {
  it('marks every line up to the one reached', () => {
    expect(milestonesUpTo(50)).toEqual([25, 50]);
    expect(milestonesUpTo(100)).toEqual([25, 50, 75, 100]);
    expect(goalMilestoneKey('g1', 50)).toBe('goal:g1:50');
    expect(budgetMonthKey('2026-09')).toBe('budgets:2026-09');
  });

  it('leaves amounts out while savings are hidden', () => {
    const shown = goalMilestoneCopy(50, 'Trip', 500000, false);
    const hidden = goalMilestoneCopy(50, 'Trip', 500000, true);
    expect(shown.title).toBe('Halfway there');
    expect(shown.body).toMatch(/to go for Trip/);
    expect(hidden.body).toBe('Trip is 50% funded.');
    expect(hidden.body).not.toMatch(/\d{2,}[,.]/);
    expect(goalMilestoneCopy(100, 'Trip', 0, false).strong).toBe(true);
    expect(goalMilestoneCopy(25, 'Trip', 750000, false).strong).toBe(false);
  });
});

describe('budgetMonthHeld', () => {
  it('needs every budget under its limit and something spent', () => {
    expect(budgetMonthHeld([{ spentMinor: 100, overBudget: false }])).toBe(true);
    expect(
      budgetMonthHeld([
        { spentMinor: 100, overBudget: false },
        { spentMinor: 900, overBudget: true },
      ])
    ).toBe(false);
    expect(budgetMonthHeld([])).toBe(false);
    expect(budgetMonthHeld([{ spentMinor: 0, overBudget: false }])).toBe(false);
  });

  it('words the note by how many budgets held', () => {
    expect(budgetMonthCopy('2026-09', 1).body).toBe('Your budget held.');
    expect(budgetMonthCopy('2026-09', 3).body).toBe('All 3 budgets held.');
    expect(budgetMonthCopy('2026-09', 3).title).toMatch(/closed under budget$/);
  });
});
