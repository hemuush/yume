import { stageForStreak, streakSeries } from './gardenGrowth';

describe('stageForStreak', () => {
  it('maps streak length to the right stage', () => {
    expect(stageForStreak(0)).toBe('seed');
    expect(stageForStreak(1)).toBe('sprout');
    expect(stageForStreak(2)).toBe('sprout');
    expect(stageForStreak(3)).toBe('sapling');
    expect(stageForStreak(6)).toBe('sapling');
    expect(stageForStreak(7)).toBe('bloom');
    expect(stageForStreak(30)).toBe('bloom');
  });

  it('never goes negative', () => {
    expect(stageForStreak(-3)).toBe('seed');
  });
});

describe('streakSeries', () => {
  it('counts consecutive under-goal days, resetting on a break', () => {
    expect(streakSeries([true, true, true])).toEqual([1, 2, 3]);
    expect(streakSeries([true, false, true, true])).toEqual([1, 0, 1, 2]);
    expect(streakSeries([false, false])).toEqual([0, 0]);
    expect(streakSeries([])).toEqual([]);
  });

  it('a broken streak never carries over the earlier run length', () => {
    expect(streakSeries([true, true, true, false, true])).toEqual([1, 2, 3, 0, 1]);
  });
});
