import { formatMoney } from '@/lib/money';

/** "18 times", "once" — nothing when the count isn't known. */
export function timesLabel(count: number | undefined): string | undefined {
  if (!count) return undefined;
  return count === 1 ? 'once' : `${count} times`;
}

/** A split row's second line: how often, and the usual amount each time ("18 times · ₹394 each", or "once"). */
export function visitsLine(count: number | undefined, totalMinor: number): string | undefined {
  if (!count) return undefined;
  if (count === 1) return 'once';
  return `${count} times · ${formatMoney(totalMinor / count)} each`;
}
