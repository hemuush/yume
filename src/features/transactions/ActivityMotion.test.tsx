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
      legend={[]}
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

it('grows bars with the native driver and stops an interrupted animation', () => {
  const stops: jest.Mock[] = [];
  const configs: Animated.TimingAnimationConfig[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((_value, config) => {
    const stop = jest.fn();
    stops.push(stop);
    configs.push(config);
    return { start: jest.fn(), stop, reset: jest.fn() };
  });
  act(() => {
    root = create(<SpendBarChart bars={[bar('2026-10-01', 10000)]} onPressDay={jest.fn()} />);
  });
  expect(configs[0].useNativeDriver).toBe(true);
  mockReduce = true;
  act(() => {
    root.update(<SpendBarChart bars={[bar('2026-10-01', 10000)]} onPressDay={jest.fn()} />);
  });
  expect(stops[0]).toHaveBeenCalledTimes(1);
});
