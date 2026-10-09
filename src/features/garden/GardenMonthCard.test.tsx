import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { GardenMonthCard } from './GardenMonthCard';
import { buildGardenMonth } from './gardenMonth';

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
  });
});
