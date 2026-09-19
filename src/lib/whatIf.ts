import { addMonthsToIsoDate, parseLocalIsoDate, toLocalIsoDate } from './date';

/** Whole days between two YYYY-MM-DD dates (`to` minus `from`) — negative if `to` is earlier. */
function daysBetweenIsoDates(from: string, to: string): number {
  const a = parseLocalIsoDate(from);
  const b = parseLocalIsoDate(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export interface SpendCut {
  extraMinor: number;
  newMonthlyMinor: number;
}

/** A category's average monthly spend with a percentage cut applied. */
export function projectedMonthlySpend(avgMonthlyMinor: number, cutPct: number): SpendCut {
  const extraMinor = Math.round((avgMonthlyMinor * cutPct) / 100);
  return { extraMinor, newMonthlyMinor: Math.max(0, avgMonthlyMinor - extraMinor) };
}

export interface GoalPaceProjection {
  /** How much is saved per month on average, derived from progress so far — 0 if the goal was just created or nothing's been added yet. */
  currentMonthlyRateMinor: number;
  /** Projected date the goal is reached at the current rate — null if the rate is 0 and the goal isn't already done. */
  currentEtaDate: string | null;
  /** Projected date at the current rate plus the what-if's extra monthly amount — null under the same condition. */
  newEtaDate: string | null;
  /** Whole days newEtaDate lands earlier than currentEtaDate — 0 when either date is unavailable or unchanged. */
  daysSooner: number;
  alreadyDone: boolean;
}

/**
 * Projects when a savings goal is reached, from data the goal already
 * carries — there's no contribution ledger (see DATA_MODEL.md), so the
 * "rate" is an average: what's been saved so far, spread over the time
 * since the goal was created. Adding a what-if's extra monthly amount to
 * that rate projects a new, sooner date — purely client-side arithmetic,
 * never written back to the goal.
 */
export function projectGoalPace(
  goal: { currentAmountMinor: number; targetAmountMinor: number; createdAt: string },
  extraMonthlyMinor: number,
  today: string = toLocalIsoDate(new Date())
): GoalPaceProjection {
  const remaining = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  if (remaining <= 0) {
    return {
      currentMonthlyRateMinor: 0,
      currentEtaDate: today,
      newEtaDate: today,
      daysSooner: 0,
      alreadyDone: true,
    };
  }

  // `created_at` is a SQLite "YYYY-MM-DD HH:MM:SS" datetime; only the date
  // portion is safe to parse (see getMemberSinceYear's own comment on why
  // `new Date()` on that raw string is engine-dependent).
  const createdDate = goal.createdAt.slice(0, 10);
  const daysSinceCreated = Math.max(1, daysBetweenIsoDates(createdDate, today));
  const monthsSinceCreated = Math.max(1, daysSinceCreated / 30.44);
  const currentMonthlyRateMinor = goal.currentAmountMinor / monthsSinceCreated;

  const etaFrom = (monthlyRate: number): string | null => {
    if (monthlyRate <= 0) return null;
    const monthsNeeded = remaining / monthlyRate;
    return addMonthsToIsoDate(today, Math.ceil(monthsNeeded));
  };

  const currentEtaDate = etaFrom(currentMonthlyRateMinor);
  const newEtaDate = etaFrom(currentMonthlyRateMinor + extraMonthlyMinor);
  const daysSooner =
    currentEtaDate && newEtaDate ? Math.max(0, daysBetweenIsoDates(newEtaDate, currentEtaDate)) : 0;

  return { currentMonthlyRateMinor, currentEtaDate, newEtaDate, daysSooner, alreadyDone: false };
}
