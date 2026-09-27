/**
 * The split page's working copy: the first part holds the rest, so a split
 * always adds up, and every reason it can't be saved yet comes back as
 * something to do. All figures are made up.
 */
import {
  partMinor,
  restMinor,
  partAmounts,
  seedParts,
  draftFromSaved,
  splitProblem,
  splitProblemText,
  toSplitParts,
  canAddPart,
  canRemovePart,
  DraftPart,
} from './splitDraft';

const part = (key: string, categoryId: string | null, text = ''): DraftPart => ({
  key,
  categoryId,
  amountText: text,
});
const money = (minor: number) => `₹${minor / 100}`;
const names: Record<string, string> = { g: 'Groceries', f: 'Food', s: 'Shopping' };
const nameOf = (key: string) => names[key] ?? 'this part';

describe('split draft', () => {
  it('reads typed amounts and sums, and ignores what has no value', () => {
    expect(partMinor('500')).toBe(50_000);
    expect(partMinor('120+45')).toBe(16_500);
    // Whole rupees, like every amount typed anywhere in the app (toMinor).
    expect(partMinor('12.5')).toBe(1_300);
    expect(partMinor('')).toBe(0);
    expect(partMinor('5÷0')).toBe(0);
  });

  it('starts with the category already picked, holding the whole payment', () => {
    const [only] = seedParts('g');
    expect(only.categoryId).toBe('g');
    expect(partAmounts(240_000, [only])).toEqual([240_000]);
  });

  it('gives the first part whatever the others leave', () => {
    const parts = [part('g', 'g', '9999'), part('f', 'f', '500'), part('s', 's', '300')];
    // The first part's own text is never used: it's the rest.
    expect(restMinor(240_000, parts)).toBe(160_000);
    expect(partAmounts(240_000, parts)).toEqual([160_000, 50_000, 30_000]);
    expect(toSplitParts(240_000, parts)).toEqual([
      { categoryId: 'g', amountMinor: 160_000 },
      { categoryId: 'f', amountMinor: 50_000 },
      { categoryId: 's', amountMinor: 30_000 },
    ]);
  });

  it('follows a changed payment in the first part', () => {
    const parts = [part('g', 'g'), part('f', 'f', '500')];
    expect(partAmounts(300_000, parts)).toEqual([250_000, 50_000]);
    expect(partAmounts(100_000, parts)).toEqual([50_000, 50_000]);
  });

  it('opens a saved split with its biggest part as the rest', () => {
    const parts = draftFromSaved([
      { categoryId: 'g', amountMinor: 160_000 },
      { categoryId: 'f', amountMinor: 50_000 },
    ]);
    expect(parts.map((p) => p.amountText)).toEqual(['', '500']);
    expect(toSplitParts(210_000, parts)).toEqual([
      { categoryId: 'g', amountMinor: 160_000 },
      { categoryId: 'f', amountMinor: 50_000 },
    ]);
  });

  it('says what to do next, one thing at a time', () => {
    const text = (total: number, parts: DraftPart[]) => {
      const p = splitProblem(total, parts);
      return p && splitProblemText(p, parts, nameOf, money);
    };
    expect(text(0, [part('g', 'g'), part('f', 'f', '5')])).toBe('Enter the amount first');
    expect(text(240_000, [part('g', 'g')])).toBe('Add a 2nd category');
    expect(text(240_000, [part('x', null), part('f', 'f', '500')])).toBe('Pick a category for every part');
    expect(text(240_000, [part('g', 'g'), part('f', 'f')])).toBe('Enter the amount for Food');
    expect(text(240_000, [part('g', 'g'), part('f', 'f', '2600')])).toBe('₹200 over the payment');
    expect(text(240_000, [part('g', 'g'), part('f', 'f', '2400')])).toBe('Leave some for Groceries');
    expect(text(240_000, [part('g', 'g'), part('f', 'f', '500')])).toBeNull();
  });

  it('keeps between 2 and 6 parts, and never takes out the rest', () => {
    const parts = [part('g', 'g'), part('f', 'f', '1'), part('s', 's', '1')];
    expect(canRemovePart(parts, 'g')).toBe(false);
    expect(canRemovePart(parts, 'f')).toBe(true);
    expect(canAddPart(parts)).toBe(true);
    expect(canAddPart(Array.from({ length: 6 }, (_, i) => part(`k${i}`, `c${i}`, '1')))).toBe(false);
  });
});
