import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { SheetTabs } from './SheetTabs';
import { ToggleSwitch } from './ToggleSwitch';
import { themeInk, selectedFill } from '@/theme/interactionColors';
import { theme } from '@/constants/theme';
import { THEMES } from '@/theme/themes';
import { SegmentedControl } from './SegmentedControl';

let mockAccent = '#8FCBFF';
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: mockAccent }) }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

it.each([false, true])('centres the switch thumb with symmetric insets (small=%s)', (small) => {
  let tree!: ReactTestRenderer;
  const render = (value: boolean) => <ToggleSwitch value={value} small={small} onChange={jest.fn()} />;
  act(() => {
    tree = create(render(false));
  });
  for (const value of [false, true]) {
    act(() => tree.update(render(value)));
    const styles = tree.root.findAllByType(View).map((n) => StyleSheet.flatten(n.props.style));
    const track = styles.find((s) => s?.width === (small ? 38 : 46))!;
    const thumb = styles.find((s) => s?.width === (small ? 16 : 18))!;
    expect(Number(thumb.top) * 2 + Number(thumb.height)).toBe(track.height);
    const translate = thumb.transform?.[0] as { translateX: number | { __getValue: () => number } };
    const offset =
      typeof translate.translateX === 'number' ? translate.translateX : translate.translateX.__getValue();
    const left = Number(thumb.left) + offset;
    const right = Number(track.width) - left - Number(thumb.width);
    expect(value ? right : left).toBe(Number(thumb.left));
  }
});

it.each(THEMES)('updates buttons, selectors and switches for the $name theme', (pack) => {
  mockAccent = pack.primary;
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
      <SegmentedControl
        options={[
          { label: 'Expense', value: 'expense' },
          { label: 'Income', value: 'income' },
        ]}
        value="expense"
        onChange={change}
      />
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
    );
    expect(selected.length).toBeGreaterThan(1);
    // SheetTabs fill with the theme ink; the pill switch fills with the theme colour itself.
    expect(
      selected.every((node) =>
        [themeInk(mockAccent), mockAccent, selectedFill(mockAccent)].includes(color(node) as string)
      )
    ).toBe(true);
    const toggle = tree.root.findAll(
      (node) => node.props?.accessibilityRole === 'switch' && node.props?.onPress
    )[0];
    expect(toggle.props.accessibilityState.checked).toBe(true);
    expect(toggle.findAll((node) => color(node) === themeInk(mockAccent)).length).toBeGreaterThan(0);
  };
  check();
  mockAccent = THEMES[(THEMES.indexOf(pack) + 1) % THEMES.length].primary;
  act(() => tree.update(content()));
  check();
  expect(change).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
