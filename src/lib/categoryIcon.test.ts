import {
  CUSTOM_ICON_MAX_UNITS,
  DEFAULT_CATEGORY_ICON,
  isBuiltInIconName,
  isEmojiIcon,
  normalizeCategoryIcon,
} from './categoryIcon';

// Written as escapes so the file reads the same in every editor.
const COFFEE = '☕';
const RAMEN = '\u{1F35C}';
const DOG = '\u{1F436}';
const LIFTING = '\u{1F3CB}️';
const HEART = '❤️';
const THUMB_TONE = '\u{1F44D}\u{1F3FD}';
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}';
const INDIA = '\u{1F1EE}\u{1F1F3}';
const KEYCAP_ONE = '1️⃣';
const PRIDE = '\u{1F3F3}️‍\u{1F308}';
const PIRATE = '\u{1F3F4}‍☠️';
const ENGLAND = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
const COUPLE_TONES = '\u{1F469}\u{1F3FD}‍❤️‍\u{1F48B}‍\u{1F468}\u{1F3FF}';

describe('isEmojiIcon', () => {
  it.each([
    ['a coffee cup', COFFEE],
    ['a bowl of ramen', RAMEN],
    ['a dog', DOG],
    ['a person lifting, with the emoji selector', LIFTING],
    ['a heart with the emoji selector', HEART],
    ['a thumb with a skin tone', THUMB_TONE],
    ['a family joined by zero-width joiners', FAMILY],
    ['a flag made of two regional letters', INDIA],
    ['a keycap', KEYCAP_ONE],
    ['a flag joined to a rainbow', PRIDE],
    ['a pirate flag', PIRATE],
    ['a region flag made of tag characters', ENGLAND],
    ['a couple with skin tones', COUPLE_TONES],
  ])('accepts %s', (_name, value) => {
    expect(isEmojiIcon(value)).toBe(true);
  });

  it.each([
    ['nothing', ''],
    ['a space', ' '],
    ['a letter', 'a'],
    ['a word', 'coffee'],
    ['a built-in icon name', 'silverware-fork-knife'],
    ['digits', '12'],
    ['a lone digit', '1'],
    ['two emoji', COFFEE + RAMEN],
    ['the same emoji twice', COFFEE + COFFEE],
    ['an emoji and a letter after it', COFFEE + 'a'],
    ['a letter and an emoji after it', 'a' + COFFEE],
    ['an emoji with a space around it', ' ' + COFFEE + ' '],
    ['a lone skin tone', '\u{1F3FD}'],
    ['a lone regional letter', '\u{1F1EE}'],
    ['a lone joiner', '‍'],
    ['an emoji ending in a joiner', COFFEE + '‍'],
    ['a joiner with nothing after it', FAMILY + '‍'],
    ['a lone selector', '️'],
    ['punctuation', '!'],
    ['a currency symbol', '₹'],
    ['a Devanagari letter', 'अ'],
  ])('rejects %s', (_name, value) => {
    expect(isEmojiIcon(value)).toBe(false);
  });

  it('rejects an emoji sequence longer than the limit', () => {
    const long = Array.from({ length: 12 }, () => RAMEN).join('‍');
    expect(long.length).toBeGreaterThan(CUSTOM_ICON_MAX_UNITS);
    expect(isEmojiIcon(long)).toBe(false);
  });

  it('keeps the longest standard sequences inside the limit', () => {
    for (const value of [FAMILY, COUPLE_TONES, ENGLAND]) {
      expect(value.length).toBeLessThanOrEqual(CUSTOM_ICON_MAX_UNITS);
    }
  });
});

describe('isBuiltInIconName', () => {
  it.each(['tag', 'silverware-fork-knife', 'numeric-1-box', 'cash-refund'])('accepts %s', (name) => {
    expect(isBuiltInIconName(name)).toBe(true);
  });
  it.each(['', 'Tag', 'two words', '-tag', 'tag-', 'a--b', 'tag_name', 'x'.repeat(41), COFFEE])(
    'rejects %j',
    (name) => {
      expect(isBuiltInIconName(name)).toBe(false);
    }
  );
});

describe('normalizeCategoryIcon', () => {
  it('keeps a built-in name and an emoji as they are', () => {
    expect(normalizeCategoryIcon('gas-station')).toBe('gas-station');
    expect(normalizeCategoryIcon(RAMEN)).toBe(RAMEN);
    expect(normalizeCategoryIcon(FAMILY)).toBe(FAMILY);
  });
  it('trims the edges', () => {
    expect(normalizeCategoryIcon('  car ')).toBe('car');
    expect(normalizeCategoryIcon(` ${COFFEE}\n`)).toBe(COFFEE);
  });
  it.each([
    undefined,
    null,
    5,
    {},
    [],
    '',
    ' ',
    'Not An Icon',
    'a b',
    COFFEE + RAMEN,
    '<script>',
    'x'.repeat(500),
  ])('falls back to the tag for %j', (value) => {
    expect(normalizeCategoryIcon(value)).toBe(DEFAULT_CATEGORY_ICON);
  });
});
