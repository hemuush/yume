/** The one button: announced as a button, reports taps, and a disabled one neither fires nor reads as enabled. */
import { StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { theme } from '@/constants/theme';
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
  it('preserves shared press feedback when the caller also handles press events', () => {
    const start = jest.fn();
    const end = jest.fn();
    const tree = render({ onPressIn: start, onPressOut: end });
    const event = {} as any;
    expect(pressable(tree).props.onPressIn).not.toBe(start);
    act(() => {
      pressable(tree).props.onPressIn(event);
      pressable(tree).props.onPressOut(event);
    });
    expect(start).toHaveBeenCalledWith(event);
    expect(end).toHaveBeenCalledWith(event);
  });
  it('announces loading and disables repeated presses while preserving its title', () => {
    const tree = render({ loading: true, title: 'Saving…' });
    expect(pressable(tree).props.disabled).toBe(true);
    expect(pressable(tree).props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(JSON.stringify(tree.toJSON())).toContain('Saving…');
  });

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
    expect(pressable(tree).props.accessibilityState.disabled).toBe(true);
    expect(pressable(tree).props.accessibilityRole).toBe('button');
  });

  it('preserves the caller busy state while announcing disabled accurately', () => {
    const tree = render({ disabled: true, accessibilityState: { busy: true } });
    expect(pressable(tree).props.accessibilityState).toEqual({ busy: true, disabled: true });
    act(() => tree.update(<PrimaryButton title="Save" accessibilityState={{ busy: false }} />));
    expect(pressable(tree).props.accessibilityState).toEqual({ busy: false, disabled: false });
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

  it('reads as unavailable: a disabled button is dimmed, and the press feedback does not undo it', () => {
    // The press-down eases opacity between 0.92 and 1; written after the dim it used to win, so a disabled
    // Save looked exactly like a live one.
    const opacity = (props: Partial<React.ComponentProps<typeof PrimaryButton>>) =>
      StyleSheet.flatten(pressable(render(props)).props.style).opacity;
    expect(opacity({ disabled: true })).toBe(theme.opacity.disabled);
    expect(opacity({ disabled: true, variant: 'secondary' })).toBe(theme.opacity.disabled);
    // Busy and finished buttons keep their full strength (the spinner or the tick is the message).
    expect(opacity({ loading: true })).not.toBe(theme.opacity.disabled);
    expect(opacity({ done: true })).not.toBe(theme.opacity.disabled);
    expect(opacity({})).not.toBe(theme.opacity.disabled);
  });
});
