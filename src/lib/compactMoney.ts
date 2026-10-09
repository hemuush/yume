import { getCurrencySymbol } from '@/lib/money';

/** "₹850", "₹61k", "₹1.2L" (and "−₹4k" below zero): a figure small enough to sit under a name or on a chart. */
export function compactMoney(minor: number): string {
  if (minor < 0) return `−${compactMoney(-minor)}`;
  const sym = getCurrencySymbol();
  const major = Math.round(minor / 100);
  if (major < 1000) return `${sym}${major}`;
  if (major < 100000) {
    const k = major / 1000;
    return `${sym}${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
  }
  return `${sym}${(major / 100000).toFixed(1).replace(/\.0$/, '')}L`;
}
