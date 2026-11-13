import { plural } from './plural';

describe('plural', () => {
  it('agrees the noun with the count', () => {
    expect(plural(0, 'month')).toBe('0 months');
    expect(plural(1, 'month')).toBe('1 month');
    expect(plural(2, 'month')).toBe('2 months');
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(3, 'entry', 'entries')).toBe('3 entries');
  });
});
