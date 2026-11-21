import { claimsSwipe, shouldCloseOnRelease } from './useSwipeToClose';

describe('swipe a sheet down to close', () => {
  it('lets go after a long drag, or a short fast fling, and settles back otherwise', () => {
    expect(shouldCloseOnRelease(120, 0.1)).toBe(true);
    expect(shouldCloseOnRelease(40, 1.2)).toBe(true);
    expect(shouldCloseOnRelease(40, 0.2)).toBe(false);
    expect(shouldCloseOnRelease(10, 2)).toBe(false);
    expect(shouldCloseOnRelease(-80, 0)).toBe(false);
  });
});

describe('when a sheet takes a downward drag', () => {
  it('takes a mostly-vertical drag down from the top of its content', () => {
    expect(claimsSwipe(true, 0, 4, 30)).toBe(true);
  });
  it('leaves it to the content when scrolled down, sideways, tiny, upward or turned off', () => {
    expect(claimsSwipe(true, 120, 0, 30)).toBe(false);
    expect(claimsSwipe(true, 0, 40, 30)).toBe(false);
    expect(claimsSwipe(true, 0, 0, 5)).toBe(false);
    expect(claimsSwipe(true, 0, 0, -30)).toBe(false);
    expect(claimsSwipe(false, 0, 0, 30)).toBe(false);
  });
});
