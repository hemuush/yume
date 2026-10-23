import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
jest.unmock('./SheetFlow');
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ModalSheet } from './ModalSheet';
import { SheetFlow } from './SheetFlow';
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

describe('related tasks in one native sheet', () => {
  it('does not mount an unopened page, and retains its content after returning', () => {
    const mounted = jest.fn();
    function Draft() {
      useEffect(() => {
        mounted();
      }, []);
      return <Text>Draft content</Text>;
    }
    const flow = (child: boolean) => (
      <SheetFlow>
        <ModalSheet flowPage visible={!child} onClose={jest.fn()} title="Overview">
          <Text>Overview</Text>
        </ModalSheet>
        <ModalSheet flowPage visible={child} onClose={jest.fn()} backLabel="Back to overview">
          <Draft />
        </ModalSheet>
      </SheetFlow>
    );
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(flow(false));
    });
    expect(mounted).not.toHaveBeenCalled();
    act(() => tree.update(flow(true)));
    expect(mounted).toHaveBeenCalledTimes(1);
    act(() => tree.update(flow(false)));
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(Draft)).toHaveLength(1);
    act(() => tree.unmount());
  });

  it('keeps a lone page at its own height, then clamps the remembered height to the viewport with enlarged text', () => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ height: 550, width: 320, fontScale: 1.5, scale: 3 });
    const Pages = ({ second }: { second: boolean }) => (
      <SheetFlow>
        <ModalSheet flowPage visible={!second} title="Task" onClose={jest.fn()}>
          <Text>Body</Text>
        </ModalSheet>
        {second && (
          <ModalSheet flowPage visible title="Next" onClose={jest.fn()}>
            <Text>Next body</Text>
          </ModalSheet>
        )}
      </SheetFlow>
    );
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Pages second={false} />);
    });
    act(() =>
      tree.root
        .findByProps({ testID: 'sheet-surface' })
        .props.onLayout({ nativeEvent: { layout: { height: 900 } } })
    );
    const lone = StyleSheet.flatten(tree.root.findByProps({ testID: 'sheet-surface' }).props.style);
    expect(lone.maxHeight).toBe('94%');
    expect(lone.minHeight).toBe(0);
    act(() => tree.update(<Pages second />));
    const style = StyleSheet.flatten(tree.root.findAllByProps({ testID: 'sheet-surface' })[1].props.style);
    expect(style.minHeight).toBeCloseTo((550 - 24 - 8) * 0.94);
    act(() =>
      tree.root
        .findByProps({ testID: 'sheet-flow-viewport' })
        .props.onLayout({ nativeEvent: { layout: { height: 320 } } })
    );
    const resized = StyleSheet.flatten(tree.root.findAllByProps({ testID: 'sheet-surface' })[1].props.style);
    expect(resized.minHeight).toBeCloseTo((320 - 24 - 8) * 0.94);
    act(() => tree.unmount());
  });

  it('starts over once every page has closed, so a reopened lone page is not held to an old taller one', async () => {
    jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ height: 800, width: 360, fontScale: 1, scale: 3 });
    const Flow = ({ open, second }: { open: boolean; second: boolean }) => (
      <SheetFlow>
        <ModalSheet flowPage visible={open && !second} title="One" onClose={jest.fn()}>
          <Text>One body</Text>
        </ModalSheet>
        <ModalSheet flowPage visible={open && second} title="Two" onClose={jest.fn()}>
          <Text>Two body</Text>
        </ModalSheet>
      </SheetFlow>
    );
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<Flow open second={false} />);
    });
    act(() => tree.update(<Flow open second />));
    act(() =>
      tree.root
        .findAll((n) => n.props.testID === 'sheet-surface' && typeof n.props.onLayout === 'function')[0]
        .props.onLayout({ nativeEvent: { layout: { height: 640 } } })
    );
    act(() => tree.update(<Flow open={false} second={false} />));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => tree.update(<Flow open second={false} />));
    const first = StyleSheet.flatten(
      tree.root.findAll((n) => n.props.testID === 'sheet-surface')[0].props.style
    );
    expect(first.minHeight).toBe(0);
    act(() => tree.unmount());
  });

  function FlowFixture({ busy = false }: { busy?: boolean }) {
    const [child, setChild] = useState(false);
    const [draft, setDraft] = useState('Keep my draft');
    return (
      <SheetFlow>
        <ModalSheet flowPage visible={!child} title="Loan details" onClose={jest.fn()}>
          <TextInput testID="draft" value={draft} onChangeText={setDraft} />
          <Pressable testID="open-child" onPress={() => setChild(true)} />
        </ModalSheet>
        {child && (
          <SheetFlow>
            <ModalSheet
              visible
              variant="center"
              title="EMI account"
              backLabel="Back to loan"
              dismissible={!busy}
              onClose={() => setChild(false)}
              footer={<Text>Save</Text>}
            >
              <Text>Account choices</Text>
            </ModalSheet>
          </SheetFlow>
        )}
      </SheetFlow>
    );
  }

  it('keeps the same native window, draft and sheet height through child/back navigation', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<FlowFixture />);
    });
    const window = tree.root.findByType(Modal);
    act(() => tree.root.findByProps({ testID: 'draft' }).props.onChangeText('Edited draft'));
    const surface = tree.root.findAllByProps({ testID: 'sheet-surface' })[0];
    act(() => surface.props.onLayout({ nativeEvent: { layout: { height: 480 } } }));
    act(() => tree.root.findByProps({ testID: 'open-child' }).props.onPress());
    expect(tree.root.findAllByType(Modal)).toHaveLength(1);
    expect(tree.root.findByType(Modal)).toBe(window);
    expect(window.props.visible).toBe(true);
    const childSurface = tree.root.findAllByProps({ testID: 'sheet-surface' }).at(-1)!;
    expect(StyleSheet.flatten(childSurface.props.style).minHeight).toBe(480);
    expect(StyleSheet.flatten(childSurface.props.style).borderTopLeftRadius).toBe(32);
    const childBody = childSurface.findByType(KeyboardAwareScrollView);
    expect(StyleSheet.flatten(childBody.props.style).flexGrow).toBe(1);
    const hidden = tree.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' });
    expect(hidden.some((n) => StyleSheet.flatten(n.props.style).display === 'none')).toBe(true);
    act(() => window.props.onRequestClose());
    expect(tree.root.findAllByProps({ title: 'EMI account' })).toHaveLength(0);
    expect(tree.root.findByProps({ testID: 'draft' }).props.value).toBe('Edited draft');
    expect(tree.root.findByType(Modal)).toBe(window);
    act(() => tree.unmount());
  });

  it('blocks Android back and child Back while saving, then returns when unlocked', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<FlowFixture busy />);
    });
    act(() => tree.root.findByProps({ testID: 'open-child' }).props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findAllByProps({ title: 'EMI account' }).length).toBeGreaterThan(0);
    const back = tree.root.findAll(
      (n) => n.props.accessibilityLabel === 'Back to loan' && n.props.onPress
    )[0];
    expect(back.props.disabled).toBe(true);
    act(() => back.props.onPress());
    expect(tree.root.findAllByProps({ title: 'EMI account' }).length).toBeGreaterThan(0);
    act(() => tree.update(<FlowFixture />));
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findAllByProps({ title: 'EMI account' })).toHaveLength(0);
    act(() => tree.unmount());
  });
});
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
