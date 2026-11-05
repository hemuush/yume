import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Animated, Text } from 'react-native';
import { CountUpAmount } from './CountUpAmount';
import { formatMoney } from '@/lib/money';

jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));

it('bounds intermediate text updates without delaying the final or accessible amount', () => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  let frame: (value: { value: number }) => void = () => {};
  const listener = jest.spyOn(Animated.Value.prototype, 'addListener').mockImplementation((callback) => {
    frame = callback;
    return 'frame';
  });
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  });
  let tree!: ReactTestRenderer;
  const text = () => tree.root.findByType(Text).props.children;
  try {
    act(() => {
      tree = create(<CountUpAmount minor={0} currency="USD" />);
    });
    expect(text()).toBe(formatMoney(0, 'USD'));
    act(() => tree.update(<CountUpAmount minor={10000} currency="USD" />));
    expect(tree.root.findByType(Text).props.accessibilityLabel).toBe(formatMoney(10000, 'USD'));
    act(() => frame({ value: 0.1 }));
    expect(text()).toBe(formatMoney(1000, 'USD'));
    jest.setSystemTime(1008);
    act(() => frame({ value: 0.2 }));
    expect(text()).toBe(formatMoney(1000, 'USD'));
    act(() => tree.update(<CountUpAmount minor={20000} currency="USD" />));
    expect(text()).toBe(formatMoney(1000, 'USD'));
    jest.setSystemTime(1032);
    act(() => frame({ value: 0.5 }));
    expect(text()).toBe(formatMoney(10500, 'USD'));
    // Completion bypasses throttling, even on a high-refresh display's next frame.
    jest.setSystemTime(1040);
    act(() => frame({ value: 1 }));
    expect(text()).toBe(formatMoney(20000, 'USD'));
    const stale = frame;
    act(() => tree.update(<CountUpAmount minor={30000} currency="USD" />));
    act(() => stale({ value: 0 }));
    expect(text()).toBe(formatMoney(20000, 'USD'));
    expect(tree.root.findByType(Text).props.accessibilityLabel).toBe(formatMoney(30000, 'USD'));
  } finally {
    act(() => tree.unmount());
    listener.mockRestore();
    timing.mockRestore();
    jest.useRealTimers();
  }
});
