/** The Spent strip at the top of Activity: the figure, how it compares, a day preview, and a tap into Insights. */
import { Text, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { theme } from '@/constants/theme';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/CountUpAmount', () => ({
  CountUpAmount: ({ minor }: { minor: number }) => {
    const { Text: T } = require('react-native');
    return <T>{`amount:${minor}`}</T>;
  },
}));

import { ActivitySummaryStrip } from './ActivitySummaryStrip';
import type { SpendBar } from './spendChart';

const bar = (key: string, totalMinor: number, over: Partial<SpendBar> = {}): SpendBar => ({
  key,
  label: key.slice(-2),
  totalMinor,
  segments: [],
  isCurrent: false,
  ...over,
});

function strip(over: Partial<React.ComponentProps<typeof ActivitySummaryStrip>> = {}) {
  const onPress = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <ActivitySummaryStrip
        periodKey="week-1"
        direction={0}
        spentMinor={617_700}
        expenseChangeMinor={-390_000}
        compareLabel="last week"
        viewScope="week"
        bars={[
          bar('2026-11-08', 90_700),
          bar('2026-11-09', 53_000),
          bar('2026-11-10', 200_000),
          bar('2026-11-12', 132_000, { isCurrent: true }),
          bar('2026-11-13', 0, { state: 'future' }),
        ]}
        current
        narrowedTo={null}
        onPress={onPress}
        {...over}
      />
    );
  });
  return { r, onPress };
}
const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
const heights = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.borderRadius === 3)
    .map((n) => StyleSheet.flatten(n.props.style));

it('says what was spent this week, how it compares, and opens Insights when tapped', () => {
  const { r, onPress } = strip();
  const shown = texts(r);
  expect(shown).toEqual(expect.arrayContaining(['Spent this week', 'amount:617700', 'By day']));
  expect(shown.some((t) => t.endsWith('less than last week'))).toBe(true);
  const button = r.root.find((n) => n.props.accessibilityRole === 'button' && n.props.onPress);
  expect(button.props.accessibilityLabel).toMatch(/^Spent this week, .*less than last week\. Open insights$/);
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => r.unmount());
});

it('draws one small bar per day in proportion, today in ink and days to come as a baseline', () => {
  const { r } = strip();
  const bars = heights(r);
  expect(bars).toHaveLength(5);
  expect(bars[2].height).toBe(34);
  expect(bars[0].height).toBeLessThan(bars[2].height as number);
  expect(bars[3].backgroundColor).toBe(theme.colors.ink);
  expect(bars[4]).toMatchObject({ height: 4, backgroundColor: theme.colors.trayTrack });
  act(() => r.unmount());
});

it('counts only the picked category and drops the comparison while the list is narrowed', () => {
  const { r } = strip({ narrowedTo: 'Food', spentMinor: 80_000 });
  const shown = texts(r);
  expect(shown).toContain('Spent on Food this week');
  expect(shown.some((t) => /than/.test(t))).toBe(false);
  act(() => r.unmount());
});

it('names a past month plainly and shows its weeks', () => {
  const { r } = strip({ current: false, viewScope: 'month', compareLabel: 'October' });
  expect(texts(r)).toEqual(expect.arrayContaining(['Spent', 'By week']));
  act(() => r.unmount());
});

it('says nothing about change when the period matches the one before', () => {
  const { r } = strip({ expenseChangeMinor: 0 });
  expect(texts(r).some((t) => /than/.test(t))).toBe(false);
  act(() => r.unmount());
});

it('labels the bars by what they are, so a past week is never captioned "This week"', () => {
  const { r } = strip({ current: false });
  expect(texts(r)).toContain('By day');
  expect(texts(r)).not.toContain('This week');
  act(() => r.unmount());
});
