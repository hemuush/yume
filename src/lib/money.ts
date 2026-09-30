import { getCachedCurrency } from '@/db/settings';
import { MAX_AMOUNT_MAJOR } from './amountLimits';

// All money is stored/passed as integer minor units (smallest currency unit,
// e.g. paise/cents) to avoid float rounding errors anywhere in balance or
// EMI math. The active currency is user-configurable in Settings — nothing
// in this file assumes INR/USD/any specific currency.

// `toMinor` is the single entry point for turning a user-typed amount into a
// stored value, and it quantizes to whole major units: the app deliberately
// keeps every ledger amount, balance and loan figure a round rupee (no
// "205.55") so that on-screen totals reconcile with their parts without any
// sub-unit drift. Amounts that arrive already in minor units (EMI splits,
// derived balances) stay exact — this only governs fresh input. An amount
// beyond MAX_AMOUNT_MAJOR comes back as NaN, the same "not a usable number"
// answer as unparseable text, so every screen's existing "enter a valid
// amount" check rejects it without any new code.
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
 * An amount as the "hide savings & investment amounts" privacy toggle shows
 * it: the real formatted figure, or — when `masked` — a placeholder that
 * still reads as money (keeps the currency symbol). The one rendering both
 * the in-app `<Amount>` and the home-screen widgets use, so the two can't
 * disagree about what a hidden amount looks like.
 */
export function formatMaskableMoney(
  minor: number,
  opts: { currency?: string; masked?: boolean } = {}
): string {
  return opts.masked ? `${getCurrencySymbol(opts.currency)}••••` : formatMoney(minor, opts.currency);
}

/**
 * Formats minor units using the device's locale, so digit grouping and the
 * currency symbol/placement follow the reader's own conventions rather than
 * a hardcoded locale. `currency` defaults to whatever the user picked in
 * Settings (getDefaultCurrency), never a fixed value.
 */
export function formatMoney(minor: number, currency?: string): string {
  const major = toMajor(minor);
  const resolvedCurrency = currency ?? getCachedCurrency();
  try {
    // No fixed maximumFractionDigits here on purpose: Intl already knows the
    // correct decimal precision per currency (2 for INR/USD, 0 for JPY,
    // etc.), so hardcoding one would print "¥500.00" for a currency that
    // has no minor unit at all.
    // Rounded to whole currency units on display — paise/cents precision
    // matters for internal math (storage stays exact minor units) but reads
    // as noise on screen (EMI splits, reports, balances all showing ".84",
    // ".67" etc.), so every amount is shown rounded regardless of currency.
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
