/**
 * A control that cannot be used reads as such even though pressing one eases its opacity too (0.92 to 1,
 * `usePressScale`). The press feedback used to be written after the dim and won, so a disabled button or a
 * greyed row looked live. Each control here is flattened the way the native view sees it.
 */
import { StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.unmock('./SheetFlow');
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
  initialWindowMetrics: null,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
  useKeyboardState: () => false,
  KeyboardAwareScrollView: require('react').forwardRef((props: object, ref: unknown) =>
    require('react').createElement(require('react-native').ScrollView, { ...props, ref })
  ),
}));
jest.mock('./AmountField', () => ({
  AmountPadHostProvider: require('react').createContext(null).Provider,
  useAmountPadHost: () => ({ host: {}, pad: null, scrollProps: {} }),
}));

import { theme } from '@/constants/theme';
import { AddButton } from './AddButton';
import { SettingsRow } from './SettingsRow';
import { ModalSheet } from './ModalSheet';

const opacityOf = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never).opacity;
const mount = (el: React.ReactElement) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(el);
  });
  return tree;
};
const pressables = (tree: ReactTestRenderer, label?: string) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.onPressIn === 'function' &&
      (label === undefined || n.props.accessibilityLabel === label) &&
      typeof n.type !== 'string'
  );

describe('a control that cannot be used is dimmed', () => {
  it('+ Add', () => {
    const off = mount(<AddButton disabled onPress={() => {}} />);
    const on = mount(<AddButton onPress={() => {}} />);
    expect(opacityOf(pressables(off)[0])).toBe(theme.opacity.disabled);
    expect(opacityOf(pressables(on)[0])).not.toBe(theme.opacity.disabled);
  });

  it('a settings row that depends on something that is off', () => {
    const row = (dimmed: boolean) =>
      mount(<SettingsRow icon="bell" label="Reminder time" dimmed={dimmed} onPress={() => {}} />);
    expect(opacityOf(pressables(row(true))[0])).toBe(theme.opacity.disabled);
    expect(opacityOf(pressables(row(false))[0])).not.toBe(theme.opacity.disabled);
  });

  it('the Close button of a sheet that is saving', () => {
    const sheet = (dismissible: boolean) =>
      mount(
        <ModalSheet visible title="Edit" onClose={() => {}} dismissible={dismissible}>
          {null}
        </ModalSheet>
      );
    const closes = (tree: ReactTestRenderer) => pressables(tree, 'Close');
    const saving = closes(sheet(false));
    expect(saving.length).toBeGreaterThan(0);
    saving.forEach((c) => expect(opacityOf(c)).toBe(theme.opacity.disabled));
    const idle = closes(sheet(true));
    expect(idle.length).toBeGreaterThan(0);
    idle.forEach((c) => expect(opacityOf(c)).not.toBe(theme.opacity.disabled));
  });
});
