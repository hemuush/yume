/**
 * What a category's `icon` can hold. It is one text value with two shapes:
 *
 * - a built-in icon name (Material Community Icons, such as `silverware-fork-knife`): plain lower-case words joined by
 *   dashes, which is all the default categories and every category made before custom emoji ever used;
 * - one emoji, kept only for a category that already has one (an earlier build let a person type one; the category form
 *   no longer offers that, but such a category keeps its emoji and draws it, and a backup holding one restores it).
 *
 * Anything else is not an icon, and `normalizeCategoryIcon` turns it into the default tag, so a damaged backup or a
 * stray value never reaches the screen as a blank or broken tile.
 *
 * The emoji check is written by hand over code points on purpose: regular-expression property escapes such as
 * `\p{Extended_Pictographic}` are not guaranteed on the phone's JavaScript engine, and a pattern it cannot read would stop
 * the app at start-up.
 */

/** What a category shows when it has no usable icon. */
export const DEFAULT_CATEGORY_ICON = 'tag';

/**
 * The longest emoji accepted, in UTF-16 units. The longest standard ones (a family, a couple with skin tones, a flag
 * of a region) are 15 units; the rest is margin.
 */
export const CUSTOM_ICON_MAX_UNITS = 20;

const ZWJ = 0x200d;
const VARIATION_SELECTOR_16 = 0xfe0f;
const KEYCAP = 0x20e3;

const isSkinTone = (cp: number | undefined) => cp !== undefined && cp >= 0x1f3fb && cp <= 0x1f3ff;
const isRegionalIndicator = (cp: number | undefined) => cp !== undefined && cp >= 0x1f1e6 && cp <= 0x1f1ff;
const isTag = (cp: number | undefined) => cp !== undefined && cp >= 0xe0020 && cp <= 0xe007f;

/** A symbol or picture that has an emoji form (letters, digits and punctuation never do). */
function isPictograph(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff && !isRegionalIndicator(cp) && !isSkinTone(cp)) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x23e9 && cp <= 0x23f3) ||
    (cp >= 0x23f8 && cp <= 0x23fa) ||
    (cp >= 0x2b05 && cp <= 0x2b07) ||
    (cp >= 0x2934 && cp <= 0x2935) ||
    (cp >= 0x2194 && cp <= 0x2199) ||
    (cp >= 0x21a9 && cp <= 0x21aa) ||
    (cp >= 0x25fb && cp <= 0x25fe) ||
    (cp >= 0x25aa && cp <= 0x25ab) ||
    (cp >= 0x231a && cp <= 0x231b) ||
    cp === 0xa9 ||
    cp === 0xae ||
    cp === 0x203c ||
    cp === 0x2049 ||
    cp === 0x2122 ||
    cp === 0x2139 ||
    cp === 0x2328 ||
    cp === 0x23cf ||
    cp === 0x24c2 ||
    cp === 0x25b6 ||
    cp === 0x25c0 ||
    cp === 0x2b1b ||
    cp === 0x2b1c ||
    cp === 0x2b50 ||
    cp === 0x2b55 ||
    cp === 0x3030 ||
    cp === 0x303d ||
    cp === 0x3297 ||
    cp === 0x3299
  );
}

/** Where the one emoji unit starting at `i` ends (a picture with its modifiers, a flag, a keycap), or null if none does. */
function unitEnd(cps: number[], i: number): number | null {
  const cp = cps[i];
  if (cp === undefined) return null;
  // A flag is two regional indicators.
  if (isRegionalIndicator(cp)) return isRegionalIndicator(cps[i + 1]) ? i + 2 : null;
  // A keycap is a digit, # or *, an optional emoji selector, then the keycap mark.
  if ((cp >= 0x30 && cp <= 0x39) || cp === 0x23 || cp === 0x2a) {
    const next = cps[i + 1] === VARIATION_SELECTOR_16 ? i + 2 : i + 1;
    return cps[next] === KEYCAP ? next + 1 : null;
  }
  if (!isPictograph(cp)) return null;
  let end = i + 1;
  if (cps[end] === VARIATION_SELECTOR_16 || isSkinTone(cps[end])) end += 1;
  // The flag of a region is a black flag followed by tag letters and a cancel tag.
  while (isTag(cps[end])) end += 1;
  return end;
}

/** Where the first emoji (units joined by zero-width joiners: a family, a person with a job) ends, or null if none starts. */
function emojiEnd(cps: number[]): number | null {
  let end = unitEnd(cps, 0);
  if (end === null) return null;
  while (cps[end] === ZWJ) {
    const next = unitEnd(cps, end + 1);
    if (next === null) return null;
    end = next;
  }
  return end;
}

const codePointsOf = (text: string): number[] => Array.from(text, (ch) => ch.codePointAt(0) as number);

function isAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) > 0x7f) return false;
  return true;
}

/** Whether `value` is exactly one emoji and nothing else (no spaces, no second emoji, no letters). */
export function isEmojiIcon(value: string): boolean {
  // Every built-in name is plain ASCII, so the common case costs one scan and no allocation.
  if (value.length === 0 || value.length > CUSTOM_ICON_MAX_UNITS || isAscii(value)) return false;
  const cps = codePointsOf(value);
  return emojiEnd(cps) === cps.length;
}

/** Whether `value` is shaped like a built-in icon name: lower-case words and digits joined by single dashes. */
export function isBuiltInIconName(value: string): boolean {
  return value.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * The icon to store: the value itself when it is a built-in name or one emoji, otherwise the default tag. It never
 * throws: an icon is cosmetic, so a bad one must not block saving a category or restoring a backup.
 */
export function normalizeCategoryIcon(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CATEGORY_ICON;
  const icon = value.trim();
  return isBuiltInIconName(icon) || isEmojiIcon(icon) ? icon : DEFAULT_CATEGORY_ICON;
}
