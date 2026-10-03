/**
 * Pure growth-stage math for Suu's Garden, kept apart from the screen and DB so it's easy to test.
 * A day counts when its expense total is at or under dailySpendingGoal (src/db/settings.ts), or it has none.
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
 * `underGoal[i]`: did day i (oldest first) end at or under the goal. Returns, per day, the length of the
 * under-goal run ending that day, so a chart can show the streak building; one broken day resets it to 0.
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
