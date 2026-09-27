/**
 * The "just added" glow: each list glows a saved entry once, and a minute
 * later nothing glows any more.
 */
import {
  markJustAdded,
  takeJustAdded,
  resetJustAdded,
  justAddedVersion,
  JUST_ADDED_WINDOW_MS,
} from './justAdded';

beforeEach(() => resetJustAdded());

describe('justAdded', () => {
  it('glows an entry once per list', () => {
    markJustAdded(['a'], 1000);
    expect(takeJustAdded(['a'], 'home', 1100)).toBe(true);
    expect(takeJustAdded(['a'], 'home', 1200)).toBe(false);
    expect(takeJustAdded(['a'], 'activity', 1300)).toBe(true);
  });

  it('never glows an entry nobody saved', () => {
    markJustAdded(['a'], 1000);
    expect(takeJustAdded(['b'], 'home', 1100)).toBe(false);
  });

  it('a stack glows when any entry in it is new', () => {
    markJustAdded(['c'], 1000);
    expect(takeJustAdded(['a', 'b', 'c'], 'activity', 1100)).toBe(true);
  });

  it('forgets after the window', () => {
    markJustAdded(['a'], 1000);
    expect(takeJustAdded(['a'], 'home', 1000 + JUST_ADDED_WINDOW_MS + 1)).toBe(false);
  });

  it('saving the same entry again (an edit) glows it again', () => {
    markJustAdded(['a'], 1000);
    takeJustAdded(['a'], 'home', 1100);
    const before = justAddedVersion();
    markJustAdded(['a'], 2000);
    expect(justAddedVersion()).toBe(before + 1);
    expect(takeJustAdded(['a'], 'home', 2100)).toBe(true);
  });

  it('marking nothing changes nothing', () => {
    const before = justAddedVersion();
    markJustAdded([]);
    expect(justAddedVersion()).toBe(before);
  });
});
