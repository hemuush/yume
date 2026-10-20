import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { SheetTabs } from './SheetTabs';
import { ToggleSwitch } from './ToggleSwitch';
import { themeInk } from '@/theme/interactionColors';
import { theme } from '@/constants/theme';

let mockAccent = '#8FCBFF';
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: mockAccent }) }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

it('updates buttons, popup selection and switches together when the theme changes', () => {
  const change = jest.fn();
  const content = () => (
    <>
      <PrimaryButton title="Save" onPress={change} />
      <PrimaryButton title="Delete" variant="danger" onPress={change} />
      <SheetTabs
        options={[
          { label: 'Cash', value: 'cash' },
          { label: 'Card', value: 'card' },
        ]}
        value="cash"
        onChange={change}
      />
      <ToggleSwitch value onChange={change} accessibilityLabel="Reminders" />
    </>
  );
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(content());
  });
  const color = (node: { props: { style?: unknown } }) => {
    const style =
      typeof node.props?.style === 'function' ? node.props?.style({ pressed: false }) : node.props?.style;
    return StyleSheet.flatten(style as StyleProp<ViewStyle>)?.backgroundColor;
  };
  const check = () => {
    const buttons = tree.root.findAll(
      (node) => node.props?.accessibilityRole === 'button' && node.props?.onPress
    );
    expect(color(buttons[0])).toBe(themeInk(mockAccent));
    expect(buttons.some((node) => color(node) === theme.colors.expenseText)).toBe(true);
    const selected = tree.root.findAll(
      (node) =>
        node.props?.accessibilityRole === 'tab' &&
        node.props?.onPress &&
        node.props?.accessibilityState.selected
    )[0];
    expect(color(selected)).toBe(themeInk(mockAccent));
    const toggle = tree.root.findAll(
      (node) => node.props?.accessibilityRole === 'switch' && node.props?.onPress
    )[0];
    expect(toggle.props.accessibilityState.checked).toBe(true);
    expect(toggle.findAll((node) => color(node) === themeInk(mockAccent)).length).toBeGreaterThan(0);
  };
  check();
  mockAccent = '#E2A6D8';
  act(() => tree.update(content()));
  check();
  expect(change).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
