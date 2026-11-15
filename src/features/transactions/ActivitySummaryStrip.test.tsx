/** The Spent card at the top of Activity: the figure, how it compares, a lettered preview of the period, and a tap into Insights. */
import { Text, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

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

// The test renderer's default screen has a 200% text size, which is the stacked layout; the card is drawn at normal text.
let dimensions: jest.SpyInstance;
beforeEach(() => {
  dimensions = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 390, height: 800, fontScale: 1, scale: 3 });
});
afterEach(() => dimensions.mockRestore());

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
/** One entry per mini bar, in order: its drawn style. A bar is the only thing 16 dp at most wide and 4 dp rounded. */
const barStyles = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.maxWidth === 16)
    .map((n) => StyleSheet.flatten(n.props.style));
/** The words under the bars (11 dp on a 14 dp line, the only text of that size here). */
const letters = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).filter((t) => {
    const flat = StyleSheet.flatten(t.props.style);
    return flat?.fontSize === 11 && flat?.lineHeight === 14;
  });
const labelsOf = (r: ReactTestRenderer) => letters(r).map((t) => t.props.children);

it('says what was spent this week, how it compares in a chip, and opens Insights when tapped', () => {
  const { r, onPress } = strip();
  const shown = texts(r);
  expect(shown).toEqual(expect.arrayContaining(['Spent this week', 'amount:617700', 'less than last week']));
  // The chip carries the amount; the words after it say what it is against.
  expect(shown).toContain(formatMoney(390_000));
  const button = r.root.find((n) => n.props.accessibilityRole === 'button' && n.props.onPress);
  expect(button.props.accessibilityLabel).toMatch(/^Spent this week, .*less than last week\. Open insights$/);
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => r.unmount());
});

it('draws the chip green when spending is down and red when it is up', () => {
  const chipOf = (r: ReactTestRenderer) =>
    StyleSheet.flatten(
      r.root.find((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.minHeight === 22)
        .props.style
    ).backgroundColor;
  const down = strip({ expenseChangeMinor: -390_000 });
  expect(chipOf(down.r)).toBe(theme.colors.incomeTint);
  act(() => down.r.unmount());
  const up = strip({ expenseChangeMinor: 120_000 });
  expect(chipOf(up.r)).toBe(theme.colors.expenseTint);
  expect(texts(up.r)).toContain('more than last week');
  act(() => up.r.unmount());
});

it('draws one small bar per day in proportion, today in ink and days to come as a dashed outline', () => {
  const { r } = strip();
  const bars = barStyles(r);
  expect(bars).toHaveLength(5);
  expect(bars[2].height).toBe(40);
  expect(bars[0].height).toBeLessThan(bars[2].height as number);
  expect(bars[3].backgroundColor).toBe(theme.colors.ink);
  // Not here yet: an outline, never a filled tick that could be read as a day with nothing spent.
  expect(bars[4]).toMatchObject({
    height: 4,
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: theme.colors.inkOff,
  });
  act(() => r.unmount());
});

it('letters the bars under them: a week by its days, a month by W1, W2…', () => {
  const week = strip();
  expect(labelsOf(week.r)).toEqual(['08', '09', '10', '12', '13']);
  act(() => week.r.unmount());
  const month = strip({
    viewScope: 'month',
    bars: [
      bar('2026-11-01', 41_200),
      bar('2026-11-08', 5_440),
      bar('2026-11-15', 3_654, { isCurrent: true }),
    ],
  });
  expect(labelsOf(month.r)).toEqual(['W1', 'W2', 'W3']);
  // The bar for the period we are in is the one set in bold.
  const now = letters(month.r).map((t) => StyleSheet.flatten(t.props.style).fontFamily);
  expect(now).toEqual([theme.font.bodyMedium, theme.font.bodyMedium, theme.font.bodyBold]);
  act(() => month.r.unmount());
});

describe('a month’s weeks', () => {
  const weeks = [
    bar('2026-11-01', 41_200),
    bar('2026-11-08', 5_440),
    bar('2026-11-15', 3_654, { isCurrent: true }),
    bar('2026-11-22', 0),
    bar('2026-11-29', 0),
  ];

  it('are drawn on a square-root scale, so the small weeks beside a big one stay readable', () => {
    const { r } = strip({ viewScope: 'month', bars: weeks });
    const bars = barStyles(r);
    expect(bars[0].height).toBe(40);
    // Linear, 5,440 of 41,200 would be 5 dp; on the root scale it is a bar you can see, and still in order.
    expect(bars[1].height).toBe(Math.round(8 + 32 * Math.sqrt(5_440 / 41_200)));
    expect(bars[1].height as number).toBeGreaterThan(15);
    expect(bars[2].height as number).toBeGreaterThan(8);
    expect(bars[2].height as number).toBeLessThan(bars[1].height as number);
    act(() => r.unmount());
  });

  it('after the current one are dashed outlines, and a past month’s empty week is a short tick', () => {
    const now = strip({ viewScope: 'month', bars: weeks });
    expect(barStyles(now.r).map((b) => b.borderStyle)).toEqual([
      undefined,
      undefined,
      undefined,
      'dashed',
      'dashed',
    ]);
    act(() => now.r.unmount());
    // A past month has no weeks to come: an empty one is just a week nothing was spent in.
    const past = strip({
      viewScope: 'month',
      current: false,
      bars: weeks.map((b) => ({ ...b, isCurrent: false })),
    });
    const bars = barStyles(past.r);
    expect(bars.map((b) => b.borderStyle)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(bars[3]).toMatchObject({ height: 3, backgroundColor: theme.colors.trayTrack });
    act(() => past.r.unmount());
  });
});

it('leaves the preview out at large text, where the figure needs the room', () => {
  dimensions.mockReturnValue({ width: 390, height: 800, fontScale: 1.5, scale: 3 });
  const { r } = strip();
  expect(barStyles(r)).toHaveLength(0);
  expect(texts(r)).toContain('amount:617700');
  act(() => r.unmount());
});

it('counts only the picked category and drops the comparison while the list is narrowed', () => {
  const { r } = strip({ narrowedTo: 'Food', spentMinor: 80_000 });
  const shown = texts(r);
  expect(shown).toContain('Spent on Food this week');
  expect(shown.some((t) => /than/.test(t))).toBe(false);
  act(() => r.unmount());
});

it('names a past month plainly', () => {
  const { r } = strip({ current: false, viewScope: 'month', compareLabel: 'October' });
  expect(texts(r)).toContain('Spent');
  expect(texts(r)).toContain('less than October');
  act(() => r.unmount());
});

it('says nothing about change when the period matches the one before', () => {
  const { r } = strip({ expenseChangeMinor: 0 });
  expect(texts(r).some((t) => /than/.test(t))).toBe(false);
  act(() => r.unmount());
});

it('never captions a past week "This week"', () => {
  const { r } = strip({ current: false });
  expect(texts(r)).toContain('Spent');
  expect(texts(r)).not.toContain('This week');
  act(() => r.unmount());
});
