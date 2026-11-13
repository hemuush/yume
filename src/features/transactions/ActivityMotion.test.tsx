import { Animated } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

let mockReduce = false;
const mockTiming = jest.fn((target: number) => target);
const mockCancel = jest.fn();
jest.mock('react-native-reanimated', () => ({
  ...require('@/test-support/reanimatedMock').createReanimatedMock(),
  withTiming: (target: number) => mockTiming(target),
  cancelAnimation: (value: unknown) => mockCancel(value),
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));

import { TransactionsHeadline } from './TransactionsHeadline';
import { SpendBarChart } from './SpendBarChart';
import { ActivitySummaryStrip } from './ActivitySummaryStrip';
import type { SpendBar } from './spendChart';

const bar = (key: string, totalMinor: number): SpendBar => ({
  key,
  label: 'S',
  totalMinor,
  isCurrent: false,
  segments: [{ categoryId: 'food', name: 'Food', amountMinor: totalMinor, color: '#123456' }],
});
let root: ReactTestRenderer;
beforeEach(() => {
  mockReduce = false;
  jest.clearAllMocks();
});
afterEach(() => {
  if (root) act(() => root.unmount());
  jest.restoreAllMocks();
});

it('rapid period turns render the latest bars and bind taps to that same period immediately', () => {
  const press = jest.fn();
  const headline = (key: string) => (
    <TransactionsHeadline
      periodKey={key}
      direction={1}
      expenseMinor={10000}
      incomeMinor={0}
      expenseChangeMinor={null}
      viewScope="week"
      bars={[bar(key, 10000)]}
      selectedKey={null}
      onPressDay={press}
    />
  );
  act(() => {
    root = create(headline('2026-10-01'));
  });
  act(() => {
    root.update(headline('2026-10-02'));
  });
  act(() => {
    root.update(headline('2026-10-03'));
  });
  const chart = root.root.findByType(SpendBarChart);
  expect(chart.props.bars[0].key).toBe('2026-10-03');
  const button = chart.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress)[0];
  act(() => button.props.onPress());
  expect(press).toHaveBeenCalledWith('2026-10-03');
  expect(mockCancel).toHaveBeenCalled();
  mockReduce = true;
  mockTiming.mockClear();
  act(() => {
    root.update(headline('2026-10-04'));
  });
  expect(root.root.findByType(SpendBarChart).props.bars[0].key).toBe('2026-10-04');
  expect(mockTiming).not.toHaveBeenCalled();
});

it('shows bars at their height at once, glides a changed one with the native driver, and stops an interrupted glide', () => {
  const stops: jest.Mock[] = [];
  const configs: Animated.TimingAnimationConfig[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => {
    const stop = jest.fn();
    stops.push(stop);
    configs.push(config);
    return { start: jest.fn(), stop, reset: jest.fn() };
  });
  const chart = (second: number) => (
    <SpendBarChart bars={[bar('2026-10-01', 10000), bar('2026-10-02', second)]} onPressDay={jest.fn()} />
  );
  act(() => {
    root = create(chart(5000));
  });
  // First showing: nothing draws up from empty, nothing one after another.
  expect(configs).toHaveLength(0);
  act(() => {
    root.update(chart(5000));
  });
  expect(configs).toHaveLength(0);
  // A day whose spending changed glides to its new height, on the native driver.
  act(() => {
    root.update(chart(8000));
  });
  expect(configs).toHaveLength(1);
  expect(configs[0]).toMatchObject({ useNativeDriver: true, toValue: 80, duration: 200 });
  // Interrupted (here by reduce-motion): the running glide is stopped.
  mockReduce = true;
  act(() => {
    root.update(chart(8000));
  });
  expect(stops[0]).toHaveBeenCalledTimes(1);
});

it('glides the Spent strip when the period steps, and holds still on first show, a refresh and reduce-motion', () => {
  const strip = (key: string, direction: -1 | 0 | 1 = 1) => (
    <ActivitySummaryStrip
      periodKey={key}
      direction={direction}
      spentMinor={10000}
      expenseChangeMinor={null}
      compareLabel="last week"
      viewScope="week"
      bars={[bar(key, 10000)]}
      current
      narrowedTo={null}
      onPress={jest.fn()}
    />
  );
  act(() => {
    root = create(strip('2026-10-01'));
  });
  expect(mockTiming).not.toHaveBeenCalled();
  act(() => root.update(strip('2026-10-01')));
  expect(mockTiming).not.toHaveBeenCalled();
  act(() => root.update(strip('2026-10-02')));
  expect(mockTiming).toHaveBeenCalledWith(0);
  mockTiming.mockClear();
  mockReduce = true;
  act(() => root.update(strip('2026-10-03')));
  expect(mockTiming).not.toHaveBeenCalled();
});
