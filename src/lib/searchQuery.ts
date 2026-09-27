import { toLocalIsoDate } from './date';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = `(${MONTHS.join('|')})[a-z]*`;
// "24 sep", "24 september", "sep 24", "24/9", "24-9", "24.9" — day first, as dates are written here.
const DAY_MONTH_NAME = new RegExp(`(?:^|\\s)(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}(?=\\s|$)`, 'i');
const MONTH_NAME_DAY = new RegExp(`(?:^|\\s)${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s|$)`, 'i');
const DAY_SLASH_MONTH = /(?:^|\s)(\d{1,2})[/.-](\d{1,2})(?=\s|$)/;
// "184", "1807", "₹1,807", "1,807.50" — an amount as it's shown or typed.
const AMOUNT = /^₹?(\d{1,3}(?:,\d{2,3})*|\d+)(\.\d{1,2})?$/;

export interface SearchWord {
  /** Matched as text against the note, category and account names. */
  text: string;
  /** Also matches an amount in this minor-unit range (inclusive), when the word is a number. */
  amountMinor?: { min: number; max: number };
}

export interface ParsedSearch {
  /** A day named in the query ("24 sep"), as YYYY-MM-DD, or null. */
  date: string | null;
  /** The rest of the query, word by word — every word has to match something. */
  words: SearchWord[];
}

/** YYYY-MM-DD for day/month this year — or last year, when that date is still ahead. Null if it isn't a real date. */
function resolveDate(day: number, month: number, today: string): string | null {
  const thisYear = Number(today.slice(0, 4));
  for (const year of [thisYear, thisYear - 1]) {
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    const iso = toLocalIsoDate(d);
    if (iso <= today) return iso;
  }
  return null;
}

/**
 * Activity search's query, understood: a day ("24 sep", "sep 24", "24/9")
 * becomes a date filter, and each remaining word is matched as text — plus,
 * when it's a number ("184", "₹1,807"), as an amount. A whole number matches
 * every amount that shows as that many rupees (₹183.50 up to ₹184.49, since
 * amounts are shown rounded); one with paise matches exactly. A month on its
 * own ("sep") stays a plain word, as before.
 */
export function parseSearchQuery(query: string, today: string = toLocalIsoDate(new Date())): ParsedSearch {
  let rest = ` ${query.trim()} `;
  let date: string | null = null;

  const named = DAY_MONTH_NAME.exec(rest) ?? MONTH_NAME_DAY.exec(rest);
  if (named) {
    const dayFirst = /^\s*\d/.test(named[0]);
    const day = Number(dayFirst ? named[1] : named[2]);
    const month = MONTHS.indexOf((dayFirst ? named[2] : named[1]).toLowerCase().slice(0, 3)) + 1;
    date = resolveDate(day, month, today);
    if (date) rest = rest.replace(named[0], ' ');
  } else {
    const slashed = DAY_SLASH_MONTH.exec(rest);
    if (slashed) {
      date = resolveDate(Number(slashed[1]), Number(slashed[2]), today);
      if (date) rest = rest.replace(slashed[0], ' ');
    }
  }

  const words = rest
    .split(/\s+/)
    .filter(Boolean)
    .map((text): SearchWord => {
      const m = AMOUNT.exec(text);
      if (!m) return { text };
      const whole = Number(m[1].replace(/,/g, ''));
      if (m[2]) {
        const exact = Math.round((whole + Number(m[2])) * 100);
        return { text, amountMinor: { min: exact, max: exact } };
      }
      return { text, amountMinor: { min: Math.max(1, whole * 100 - 50), max: whole * 100 + 49 } };
    });

  return { date, words };
}
