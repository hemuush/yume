import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Animated, Text } from 'react-native';
import { CountUpAmount } from './CountUpAmount';
import { formatMoney } from '@/lib/money';

it('shows each amount at once and never starts an animation, so figures cannot make a screen janky', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const listener = jest.spyOn(Animated.Value.prototype, 'addListener');
  let tree!: ReactTestRenderer;
  const text = () => tree.root.findByType(Text).props.children;
  try {
    act(() => {
      tree = create(<CountUpAmount minor={0} currency="USD" />);
    });
    expect(text()).toBe(formatMoney(0, 'USD'));
    act(() => tree.update(<CountUpAmount minor={10000} currency="USD" />));
    // The new amount is on screen and read out straight away: nothing rolls through the amounts in between.
    expect(text()).toBe(formatMoney(10000, 'USD'));
    expect(tree.root.findByType(Text).props.accessibilityLabel).toBe(formatMoney(10000, 'USD'));
    act(() => tree.update(<CountUpAmount minor={30000} currency="USD" />));
    expect(text()).toBe(formatMoney(30000, 'USD'));
    expect(timing).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  } finally {
    act(() => tree.unmount());
    timing.mockRestore();
    listener.mockRestore();
  }
});
