import { shade } from '@/lib/color';
import { getScheme } from '@/theme/scheme';

/** A category colour is stored as '#RGB' or '#RRGGBB' (the palette, or a backup's: anything else is not drawn as a tint). */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * How a category looks on its icon tile: a pale wash of its own colour with the glyph in a deep shade of the same hue, so
 * Food, Travel and Rent are told apart at a glance in a list, not only in a chart. It is the pair the loans, the entry
 * header and the budget header already use. Null for a colour that is not a hex value (the tile then stays neutral).
 */
type Tone = { fill: string; glyph: string } | null;

/** The tones already worked out, for the colour mode they were made in: a list draws the same few colours many times. */
let cache = new Map<string, Tone>();
let cachedScheme = getScheme();

export function categoryTone(color: string | undefined): Tone {
  if (!color) return null;
  if (cachedScheme !== getScheme()) {
    cache = new Map();
    cachedScheme = getScheme();
  }
  let tone = cache.get(color);
  if (tone === undefined) {
    tone = HEX.test(color) ? { fill: shade(color, 92), glyph: shade(color, 26, 12) } : null;
    cache.set(color, tone);
  }
  return tone;
}
