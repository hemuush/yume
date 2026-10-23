import { parseLocalIsoDate } from '@/lib/date';

/** Local calendar date for the compact upcoming-payment tile. */
export function dateTileParts(iso: string): { day: string; month: string } {
  const d = parseLocalIsoDate(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString(undefined, { month: 'short' }).slice(0, 3).toUpperCase(),
  };
}
