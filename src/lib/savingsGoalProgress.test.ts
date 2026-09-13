import { goalProgress } from './savingsGoalProgress';

describe('goalProgress', () => {
  it('computes a plain percentage below the target', () => {
    expect(goalProgress(640000, 1000000)).toEqual({ percent: 64, done: false });
  });

  it('clamps percent at 100 once past the target, but still reports done', () => {
    expect(goalProgress(1500000, 1000000)).toEqual({ percent: 100, done: true });
  });

  it('is done exactly at the target, not just past it', () => {
    expect(goalProgress(1000000, 1000000)).toEqual({ percent: 100, done: true });
  });

  it('never divides by zero for a target of zero', () => {
    expect(goalProgress(0, 0)).toEqual({ percent: 0, done: false });
    expect(goalProgress(500, 0)).toEqual({ percent: 0, done: false });
  });

  it('treats zero saved as zero percent, not done', () => {
    expect(goalProgress(0, 1000000)).toEqual({ percent: 0, done: false });
  });
});
