/**
 * A goal's progress, derived once so GoalCard, GoalDetailModal and Home chips agree. `percent` is clamped to
 * 100: saving past the goal is real, but the ring can't depict more than a full circle.
 */
export interface GoalProgress {
  percent: number;
  done: boolean;
}

export function goalProgress(currentAmountMinor: number, targetAmountMinor: number): GoalProgress {
  if (targetAmountMinor <= 0) return { percent: 0, done: false };
  const raw = (currentAmountMinor / targetAmountMinor) * 100;
  return { percent: Math.min(100, Math.max(0, raw)), done: currentAmountMinor >= targetAmountMinor };
}
