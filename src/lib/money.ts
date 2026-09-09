import { getCachedCurrency } from '@/db/settings';

// All money is stored/passed as integer minor units (smallest currency unit,
// e.g. paise/cents) to avoid float rounding errors anywhere in balance or
// EMI math. The active currency is user-configurable in Settings — nothing
// in this file assumes INR/USD/any specific currency.

// `toMinor` is the single entry point for turning a user-typed amount into a
// stored value, and it quantizes to whole major units: the app deliberately
// keeps every ledger amount, balance and loan figure a round rupee (no
// "205.55") so that on-screen totals reconcile with their parts without any
// sub-unit drift. Amounts that arrive already in minor units (EMI splits,
// derived balances) stay exact — this only governs fresh input.
export function toMinor(major: number): number {
  return Math.round(major) * 100;
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
