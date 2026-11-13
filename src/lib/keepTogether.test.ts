import { keepTogether, noBreak } from './keepTogether';

describe('keepTogether', () => {
  it('joins the last two words so a wrapped caption never strands one', () => {
    expect(keepTogether('2 loans · free by Feb 2036')).toBe('2 loans · free by Feb\u00A02036');
    expect(keepTogether('3 budgets · all within limits')).toBe('3 budgets · all within\u00A0limits');
  });

  it('leaves a single word, and the empty string, alone', () => {
    expect(keepTogether('Overdue')).toBe('Overdue');
    expect(keepTogether('')).toBe('');
  });

  it('only changes the last space', () => {
    expect(keepTogether('a b c d').split('\u00A0')).toEqual(['a b c', 'd']);
  });
});

describe('noBreak', () => {
  it('makes every space a non-breaking one, so a date range wraps as a whole', () => {
    expect(noBreak('Jan 1 – Feb 2')).toBe('Jan\u00A01\u00A0–\u00A0Feb\u00A02');
    expect(noBreak('Jan 1 – Feb 2')).not.toMatch(/ /);
  });
});
