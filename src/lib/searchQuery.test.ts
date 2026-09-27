import { parseSearchQuery } from './searchQuery';

const TODAY = '2026-09-26';
const parse = (q: string) => parseSearchQuery(q, TODAY);

describe('parseSearchQuery', () => {
  it('keeps plain words as text', () => {
    expect(parse('zomato lunch')).toEqual({ date: null, words: [{ text: 'zomato' }, { text: 'lunch' }] });
    expect(parse('sep')).toEqual({ date: null, words: [{ text: 'sep' }] });
  });

  it('reads a whole number as an amount shown in whole rupees', () => {
    expect(parse('184').words).toEqual([{ text: '184', amountMinor: { min: 18350, max: 18449 } }]);
  });

  it('reads ₹ signs, commas and paise', () => {
    expect(parse('₹1,807').words[0].amountMinor).toEqual({ min: 180650, max: 180749 });
    expect(parse('1,05,500').words[0].amountMinor).toEqual({ min: 10549950, max: 10550049 });
    expect(parse('45.50').words[0].amountMinor).toEqual({ min: 4550, max: 4550 });
  });

  it('does not treat other number-like words as amounts', () => {
    expect(parse('50%').words).toEqual([{ text: '50%' }]);
    expect(parse('1,2345').words).toEqual([{ text: '1,2345' }]);
  });

  it('reads a day in any common order, this year', () => {
    for (const q of ['24 sep', 'sep 24', '24 September', '24th sep', '24/9', '24-9']) {
      expect(parse(q)).toEqual({ date: '2026-09-24', words: [] });
    }
  });

  it('uses last year for a day still ahead this year', () => {
    expect(parse('25 dec').date).toBe('2025-12-25');
  });

  it('ignores impossible dates', () => {
    expect(parse('31/2')).toEqual({ date: null, words: [{ text: '31/2' }] });
  });

  it('mixes a date, an amount and a word', () => {
    expect(parse('zomato 250 24 sep')).toEqual({
      date: '2026-09-24',
      words: [{ text: 'zomato' }, { text: '250', amountMinor: { min: 24950, max: 25049 } }],
    });
  });
});
