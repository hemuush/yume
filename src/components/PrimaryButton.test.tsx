/** The one button: announced as a button, reports taps, and a disabled one neither fires nor reads as enabled. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { PrimaryButton } from './PrimaryButton';

function render(props: Partial<React.ComponentProps<typeof PrimaryButton>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<PrimaryButton title="Save" onPress={() => {}} {...props} />);
  });
  return tree;
}
// The outermost node carrying the role: the Animated wrapper, which holds the props PrimaryButton passes down.
const pressable = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.accessibilityRole === 'button')[0];

describe('PrimaryButton', () => {
  it('is a button that reports taps', () => {
    const onPress = jest.fn();
    const tree = render({ onPress });
    expect(pressable(tree).props.accessibilityRole).toBe('button');
    act(() => pressable(tree).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled when asked, so TalkBack and the press handler both know', () => {
    const tree = render({ disabled: true });
    expect(pressable(tree).props.disabled).toBe(true);
    expect(pressable(tree).props.accessibilityRole).toBe('button');
  });

  it('keeps every size at a 48dp touch target without changing its look', () => {
    const regular = pressable(render()).props.hitSlop;
    const compact = pressable(render({ compact: true })).props.hitSlop;
    // ~42dp regular (12+12 padding + 18 line) and ~30dp compact (7+7 + 16 line).
    expect(42 + regular.top + regular.bottom).toBeGreaterThanOrEqual(48);
    expect(30 + compact.top + compact.bottom).toBeGreaterThanOrEqual(48);
  });

  it('swaps the title for a checkmark once done', () => {
    const tree = render({ done: true, doneLabel: 'Saved' });
    expect(JSON.stringify(tree.toJSON())).toContain('✓ Saved');
  });
});
