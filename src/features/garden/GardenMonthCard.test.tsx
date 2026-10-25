import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { GardenMonthCard } from './GardenMonthCard';
import { buildGardenMonth } from './gardenMonth';

let mockFontScale = 2;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 800, scale: 2, fontScale: mockFontScale }),
}));

const point = (date: string, streakDays: number, tracked = true) => ({ date, streakDays, tracked });

describe('GardenMonthCard', () => {
  it('names the month, counts the kept days and labels each day for a screen reader', () => {
    const month = buildGardenMonth(
      [point('2026-10-01', 0, false), point('2026-10-02', 1), point('2026-10-03', 0), point('2026-10-04', 1)],
      '2026-10-04'
    );
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<GardenMonthCard month={month} today="2026-10-04" />);
    });
    const shown = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
    expect(shown).toContain('2 of 3 kept');
    expect(shown.some((t) => t.startsWith('October'))).toBe(true);
    const label = (day: number) =>
      tree.root.find(
        (n) =>
          typeof n.type === 'string' &&
          typeof n.props.accessibilityLabel === 'string' &&
          new RegExp(`^${day}[:,]`).test(n.props.accessibilityLabel)
      ).props.accessibilityLabel;
    expect(label(2)).toBe('2: kept under the goal');
    expect(label(3)).toBe('3: over the goal');
    expect(label(4)).toBe('4, today: kept under the goal');
    expect(label(1)).toBe('1: not tracked yet');
    expect(label(31)).toBe('31: still to come');
    act(() => tree.unmount());
  });

  it('fits the seven columns in the card instead of scrolling, and says nothing about today twice', () => {
    const month = buildGardenMonth([point('2026-10-02', 1), point('2026-10-03', 0)], '2026-10-04');
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<GardenMonthCard month={month} today="2026-10-04" />);
    });
    expect(tree.root.findAll((n) => n.props.horizontal === true)).toHaveLength(0);
    const shown = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
    expect(shown.filter((t) => t.includes('can change until the day ends'))).toHaveLength(0);
    expect(shown).toEqual(expect.arrayContaining(['Kept', 'Over goal', 'Not tracked']));
    // The jest window reports a large font scale, so the tick is dropped here rather than the grid scrolling.
    expect(shown.filter((t) => t === '✓')).toHaveLength(0);
    expect(shown).not.toContain('●');
    act(() => tree.unmount());
  });

  it('ticks kept days at normal text size', () => {
    mockFontScale = 1;
    const month = buildGardenMonth([point('2026-10-02', 1), point('2026-10-03', 0)], '2026-10-04');
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<GardenMonthCard month={month} today="2026-10-04" />);
    });
    const shown = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
    expect(shown.filter((t) => t === '✓')).toHaveLength(1);
    act(() => tree.unmount());
  });
});
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
