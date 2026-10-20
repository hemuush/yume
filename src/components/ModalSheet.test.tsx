import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Modal, StyleSheet, Text, View } from 'react-native';
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/usePressScale', () => ({
  usePressScale: () => ({ animatedStyle: {}, onPressIn: jest.fn(), onPressOut: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
  initialWindowMetrics: null,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react').forwardRef((props: object, ref: unknown) =>
    require('react').createElement(require('react-native').ScrollView, { ...props, ref })
  ),
}));
jest.mock('./AmountField', () => ({
  AmountPadHostProvider: require('react').createContext(null).Provider,
  useAmountPadHost: () => ({ host: {}, pad: null, scrollProps: {} }),
}));
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ModalSheet } from './ModalSheet';
function render(over: Partial<Parameters<typeof ModalSheet>[0]> = {}) {
  const close = jest.fn();
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ModalSheet visible onClose={close} title="Edit amount" footer={<Text>Save</Text>} {...over}>
        <Text>Form body</Text>
      </ModalSheet>
    );
  });
  return { tree, close };
}
afterEach(() => jest.restoreAllMocks());
it.each(['sheet', 'center'] as const)(
  'keeps header and action outside keyboard-aware scrolling for %s',
  (variant) => {
    const { tree } = render({ variant });
    const body = tree.root.findByType(KeyboardAwareScrollView);
    const text = body.findAllByType(Text).map((n) => n.props.children);
    expect(text).toContain('Form body');
    expect(text).not.toContain('Edit amount');
    expect(text).not.toContain('Save');
    expect(body.props.keyboardShouldPersistTaps).toBe('handled');
    if (variant === 'center') {
      const surface = tree.root.findAllByProps({ testID: 'sheet-surface' })[0];
      expect(StyleSheet.flatten(surface.props.style).paddingTop).toBe(0);
    }
    act(() => tree.unmount());
  }
);
it('blocks back, backdrop and close-button dismissal while saving', () => {
  const { tree, close } = render({ dismissible: false });
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  const controls = tree.root.findAll(
    (n) => n.props.accessibilityLabel === 'Close' && typeof n.props.onPress === 'function'
  );
  expect(controls.length).toBeGreaterThan(0);
  for (const c of controls) {
    expect(c.props.disabled).toBe(true);
    act(() => c.props.onPress());
  }
  expect(close).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
it('retains Android back dismissal when editing is allowed', () => {
  const { tree, close } = render();
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(close).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it.each([
  { height: 800, fontScale: 1, cap: '78%' },
  { height: 800, fontScale: 1.5, cap: '94%' },
  { height: 550, fontScale: 1, cap: '94%' },
])('allows compact content to grow at $height / $fontScale', (d) => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ ...d, width: 390, scale: 3 });
  const { tree } = render({ size: 'compact' });
  const surface = tree.root.findAllByProps({ testID: 'sheet-surface' })[0];
  expect(StyleSheet.flatten(surface.props.style).maxHeight).toBe(d.cap);
  const safeFooter = tree.root
    .findAllByType(View)
    .filter((n) => StyleSheet.flatten(n.props.style)?.paddingBottom === 36);
  expect(safeFooter.length).toBeGreaterThan(0);
  act(() => tree.unmount());
});

it('labels a child task as Back and returns through the same dismissal handler', () => {
  const { tree, close } = render({ backLabel: 'Back to loan' });
  const back = tree.root.findAll(
    (n) => n.props.accessibilityLabel === 'Back to loan' && typeof n.props.onPress === 'function'
  )[0];
  expect(back).toBeDefined();
  act(() => back.props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
