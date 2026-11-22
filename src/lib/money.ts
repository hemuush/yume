import { getCachedCurrency } from '@/db/settings';
import { MAX_AMOUNT_MAJOR } from './amountLimits';

// Money is stored as integer minor units (e.g. paise/cents) to avoid float rounding in balance and EMI math.
// The active currency is user-configurable; nothing here assumes INR/USD/any specific currency.

// `toMinor` is the sole entry for typed amounts: it keeps what was typed to two decimals (₹12.50 is 1250), so a coffee
// at ₹12.50 is stored and shown as such. Loans use `toWholeMinor` instead (a bank debits a whole-rupee EMI).
// Over MAX_AMOUNT_MAJOR returns NaN, which callers already reject.
export function toMinor(major: number): number {
  if (Math.abs(major) > MAX_AMOUNT_MAJOR) return NaN;
  // toPrecision(15) first, so 1.005 * 100 (100.49999999999999) still rounds to the 101 a person typed.
  return Math.round(Number((major * 100).toPrecision(15)));
}

/** A typed amount quantized to whole major units, for loan figures: banks take and quote whole rupees. */
export function toWholeMinor(major: number): number {
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

// Building an Intl.NumberFormat is slow and lists format one amount per row, so each currency's is made once.
const symbolFormats = new Map<string, Intl.NumberFormat>();
const wholeUnitFormats = new Map<string, Intl.NumberFormat>();
const withPaiseFormats = new Map<string, Intl.NumberFormat>();

function cachedFormat(
  cache: Map<string, Intl.NumberFormat>,
  currency: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  let format = cache.get(currency);
  if (!format) {
    format = new Intl.NumberFormat(undefined, { style: 'currency', currency, ...options });
    cache.set(currency, format);
  }
  return format;
}

/** Just the currency symbol/prefix (e.g. "₹", "$") — used wherever a real amount is masked but should still read as money, not a stray number. */
export function getCurrencySymbol(currency?: string): string {
  const resolvedCurrency = currency ?? getCachedCurrency();
  try {
    const parts = cachedFormat(symbolFormats, resolvedCurrency, {}).formatToParts(0);
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
  opts: { currency?: string; masked?: boolean; exact?: boolean } = {}
): string {
  return opts.masked
    ? `${getCurrencySymbol(opts.currency)}••••`
    : (opts.exact ? formatMoneyExact : formatMoney)(minor, opts.currency);
}

/**
 * Formats minor units in the device's locale (digit grouping, symbol placement), never a hardcoded locale.
 * `currency` defaults to the user's Settings choice (getDefaultCurrency). Amounts show rounded to whole units: paise are
 * noise on a total, an average or a per-day figure. A recorded amount that has paise uses `formatMoneyExact`.
 */
export function formatMoney(minor: number, currency?: string): string {
  // Less than half a unit prints as "₹0", never "-₹0".
  const raw = toMajor(minor);
  const major = Math.abs(raw) < 0.5 ? 0 : raw;
  const resolvedCurrency = currency ?? getCachedCurrency();
  try {
    // Intl sets per-currency precision (a fixed maximumFractionDigits would print "¥500.00" for JPY).
    return cachedFormat(wholeUnitFormats, resolvedCurrency, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(major);
  } catch {
    // Unknown/unsupported currency code — fall back to a plain number so the
    // app never crashes on a bad code, just loses symbol formatting.
    return String(Math.round(major));
  }
}

/**
 * An amount someone recorded, as they typed it: whole ("₹1,250") when it has no paise, with both digits ("₹12.50") when it
 * has. For entries, what a sheet or the chat repeats back, and the day's own total; totals and averages stay on
 * `formatMoney`. A currency with no minor unit (the yen) always prints whole.
 */
export function formatMoneyExact(minor: number, currency?: string): string {
  const resolvedCurrency = currency ?? getCachedCurrency();
  const exact = Math.round(minor);
  if (exact % 100 === 0 || resolvedCurrency === 'JPY') return formatMoney(exact, resolvedCurrency);
  const raw = toMajor(exact);
  try {
    return cachedFormat(withPaiseFormats, resolvedCurrency, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(raw);
  } catch {
    return raw.toFixed(2);
  }
}
