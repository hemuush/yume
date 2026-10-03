import { getCachedCurrency } from '@/db/settings';
import { MAX_AMOUNT_MAJOR } from './amountLimits';

// Money is stored as integer minor units (e.g. paise/cents) to avoid float rounding in balance and EMI math.
// The active currency is user-configurable; nothing here assumes INR/USD/any specific currency.

// `toMinor` is the sole entry for typed amounts; it quantizes to whole major units so totals reconcile.
// Minor-unit inputs (EMI splits) stay exact. Over MAX_AMOUNT_MAJOR returns NaN, which callers already reject.
export function toMinor(major: number): number {
  if (Math.abs(major) > MAX_AMOUNT_MAJOR) return NaN;
  return Math.round(major) * 100;
}

/** What's typed in an amount field, in minor units — 0 while it's empty or not a number yet (a live preview). */
export function inputMinor(text: string): number {
  const minor = toMinor(parseFloat(text || '0'));
  return Number.isFinite(minor) && minor > 0 ? minor : 0;
}

export function toMajor(minor: number): number {
  return minor / 100;
}

/** Just the currency symbol/prefix (e.g. "₹", "$") — used wherever a real amount is masked but should still read as money, not a stray number. */
export function getCurrencySymbol(currency?: string): string {
  const resolvedCurrency = currency ?? getCachedCurrency();
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: resolvedCurrency,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? resolvedCurrency;
  } catch {
    return resolvedCurrency;
  }
}

/**
 * Amount as the "hide savings & investment amounts" toggle shows it: the real figure, or (when `masked`) a
 * placeholder that still reads as money. Shared by in-app `<Amount>` and the widgets so they can't disagree.
 */
export function formatMaskableMoney(
  minor: number,
  opts: { currency?: string; masked?: boolean } = {}
): string {
  return opts.masked ? `${getCurrencySymbol(opts.currency)}••••` : formatMoney(minor, opts.currency);
}

/**
 * Formats minor units in the device's locale (digit grouping, symbol placement), never a hardcoded locale.
 * `currency` defaults to the user's Settings choice (getDefaultCurrency).
 */
export function formatMoney(minor: number, currency?: string): string {
  const major = toMajor(minor);
  const resolvedCurrency = currency ?? getCachedCurrency();
  try {
    // Intl sets per-currency precision (a fixed maximumFractionDigits would print "¥500.00" for JPY).
    // Amounts show rounded to whole units: paise/cents matter for stored math but are noise on screen.
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(major);
  } catch {
    // Unknown/unsupported currency code — fall back to a plain number so the
    // app never crashes on a bad code, just loses symbol formatting.
    return String(Math.round(major));
  }
}
