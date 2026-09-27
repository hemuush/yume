import { timesLabel, visitsLine } from './visits';

describe('visit labels on a category page', () => {
  it('says how often and the usual amount each time', () => {
    expect(visitsLine(18, 708800)).toBe('18 times · ₹394 each');
    expect(visitsLine(31, 291500)).toBe('31 times · ₹94 each');
    expect(visitsLine(1, 14900)).toBe('once');
    expect(visitsLine(0, 0)).toBeUndefined();
    expect(visitsLine(undefined, 500)).toBeUndefined();
  });

  it('counts a grouped row without an average', () => {
    expect(timesLabel(7)).toBe('7 times');
    expect(timesLabel(1)).toBe('once');
    expect(timesLabel(0)).toBeUndefined();
  });
});
