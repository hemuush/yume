/** The selectable pill: a button that reports whether it is selected, with a 48dp touch target, on any hex colour. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { Chip } from './Chip';

function render(props: Partial<React.ComponentProps<typeof Chip>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<Chip label="Food" active={false} onPress={() => {}} {...props} />);
  });
  return tree;
}
// The outermost node carrying the role: the Animated wrapper, which holds the props Chip passes down.
const pressable = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.accessibilityRole === 'button')[0];

describe('Chip', () => {
  it('is a button that reports taps', () => {
    const onPress = jest.fn();
    const tree = render({ onPress });
    expect(pressable(tree).props.accessibilityRole).toBe('button');
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says whether it is selected', () => {
    expect(pressable(render({ active: false })).props.accessibilityState).toEqual({ selected: false });
    expect(pressable(render({ active: true })).props.accessibilityState).toEqual({ selected: true });
  });

  it('lifts its ~30dp pill to a 48dp touch target', () => {
    const { top, bottom } = pressable(render()).props.hitSlop;
    expect(30 + top + bottom).toBeGreaterThanOrEqual(48);
  });

  it.each([
    ['#FFA8CE', 'rgba(255, 168, 206, 0.1)'],
    ['#fa8', 'rgba(255, 170, 136, 0.1)'],
    ['#FFA8CE80', 'rgba(255, 168, 206, 0.1)'],
  ])('tints an active chip from %s without a malformed colour', (color, tint) => {
    const style = StyleSheet.flatten(
      pressable(render({ active: true, activeBorderColor: color })).props.style
    );
    expect(style.backgroundColor).toBe(tint);
    expect(style.borderColor).toBe(color);
  });
});
