/**
 * Pure growth-stage math for Suu's Garden — kept separate from the screen
 * and from any DB query so it's trivial to unit test. A day "counts" when
 * that day's total expense was at or under the daily spending goal
 * (src/db/settings.ts's dailySpendingGoal); a day with no expenses at all
 * counts too (nothing spent is definitely under the goal).
 */

export type GrowthStage = 'seed' | 'sprout' | 'sapling' | 'bloom';

const STAGE_LABEL: Record<GrowthStage, string> = {
  seed: 'Seed',
  sprout: 'Sprout',
  sapling: 'Sapling',
  bloom: 'Bloom',
};

export function stageLabel(stage: GrowthStage): string {
  return STAGE_LABEL[stage];
}

/** Longer streaks read as later growth stages — thresholds picked so a full week reads as "bloom". */
export function stageForStreak(streakDays: number): GrowthStage {
  if (streakDays <= 0) return 'seed';
  if (streakDays <= 2) return 'sprout';
  if (streakDays <= 6) return 'sapling';
  return 'bloom';
}

/**
 * `underGoal[i]` is whether the day at that position (oldest to newest)
 * finished at or under the goal. Returns, for each day, the length of the
 * consecutive under-goal run ending exactly on that day — so a chart of
 * the last few days can show the streak actually building day by day,
 * rather than only knowing where it stands today. A single day that broke
 * the streak resets the count to 0, not back to some earlier run.
 */
export function streakSeries(underGoal: boolean[]): number[] {
  const out: number[] = [];
  let running = 0;
  for (const ok of underGoal) {
    running = ok ? running + 1 : 0;
    out.push(running);
  }
  return out;
}
