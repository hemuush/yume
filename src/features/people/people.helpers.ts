import { parseLocalIsoDate } from '@/lib/date';
import { roundedMinor } from '@/lib/round';

/**
 * A balance that rounds to exactly 0 reads as genuinely settled, not as a
 * still-open debt that merely happens to be small — so status is always
 * decided on the whole-rupee figure the row shows.
 */
export type PersonStatus = 'owed' | 'owe' | 'settled';

export function personStatus(dispBalanceMinor: number): PersonStatus {
  if (dispBalanceMinor === 0) return 'settled';
  return dispBalanceMinor > 0 ? 'owed' : 'owe';
}

/**
 * The screen's two totals (and the Plan tile's line): the sums of each
 * person's balance rounded to a whole rupee, so they match the list below.
 * A positive balance means they owe you.
 */
export function peopleTotals(people: { balanceMinor: number }[]): {
  owedToYouMinor: number;
  youOweMinor: number;
} {
  let owedToYouMinor = 0;
  let youOweMinor = 0;
  for (const p of people) {
    const disp = roundedMinor(p.balanceMinor);
    if (disp > 0) owedToYouMinor += disp;
    else youOweMinor -= disp;
  }
  return { owedToYouMinor, youOweMinor };
}

const DAY_MS = 86_400_000;
/** Beyond this, "Nd ago" turns into weeks. */
const DAYS_BEFORE_WEEKS = 14;

/** Compact "last activity" beside a person's balance: Today, Yesterday, 5d ago, 3w ago. */
export function lastActivityShort(dateStr: string | null, now: Date = new Date()): string {
  if (!dateStr) return 'No activity';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - parseLocalIsoDate(dateStr).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < DAYS_BEFORE_WEEKS) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}
