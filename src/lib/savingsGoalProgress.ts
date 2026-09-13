/**
 * A goal's progress, derived once here rather than recomputed slightly
 * differently by GoalCard, GoalDetailModal, and Home's preview chips.
 * `percent` is clamped to 100 even if more than the target has been saved —
 * saving past the goal is a real outcome, not something the ring should
 * try to depict past a full circle.
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
