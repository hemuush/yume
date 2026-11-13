import { act, create } from 'react-test-renderer';
import { Dimensions, StyleSheet, Text } from 'react-native';

let mockProps: { style?: unknown; onLayout?: (e: unknown) => void } = {};
jest.mock('react-native-safe-area-context', () => ({
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 411, height: 880 },
    insets: { top: 50, bottom: 49, left: 0, right: 0 },
  },
  SafeAreaProvider: (props: { children: unknown; style?: unknown; onLayout?: (e: unknown) => void }) => {
    mockProps = props;
    return require('react').createElement(
      require('react-native').View,
      { style: props.style },
      props.children
    );
  },
}));

import { ModalSafeArea, modalShortfall } from './ModalSafeArea';

describe('modalShortfall', () => {
  it('is how far short the content area is, when that is exactly the two bars', () => {
    expect(modalShortfall(921, 822, 99)).toBe(99);
    expect(modalShortfall(921, 823, 99)).toBe(98);
  });

  it('is nothing for a full-height area, or one short by something else', () => {
    expect(modalShortfall(921, 921, 99)).toBe(0);
    expect(modalShortfall(921, 460, 99)).toBe(0); // split screen
    expect(modalShortfall(921, 900, 99)).toBe(0);
    expect(modalShortfall(921, 822, 0)).toBe(0); // no bars known
  });
});

describe('ModalSafeArea', () => {
  const layoutAt = (height: number) =>
    act(() => mockProps.onLayout!({ nativeEvent: { layout: { height } } }));

  beforeEach(() => {
    jest
      .spyOn(Dimensions, 'get')
      .mockImplementation(((what: string) =>
        what === 'screen'
          ? { width: 411, height: 921, scale: 2.6, fontScale: 1 }
          : { width: 411, height: 822, scale: 2.6, fontScale: 1 }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const render = () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ModalSafeArea>
          <Text>sheet</Text>
        </ModalSafeArea>
      );
    });
    return tree;
  };

  it('gives the content the screen height when its first layout is short by the status bar and the nav bar', () => {
    const tree = render();
    expect(mockProps.style).toBeUndefined();
    layoutAt(822);
    expect(StyleSheet.flatten(mockProps.style as never)).toEqual({ flex: 0, height: 921 });
    act(() => tree.unmount());
  });

  it('leaves a full-height area, and a window that is really smaller, alone', () => {
    const full = render();
    layoutAt(921);
    expect(mockProps.style).toBeUndefined();
    act(() => full.unmount());
    const split = render();
    layoutAt(460);
    expect(mockProps.style).toBeUndefined();
    act(() => split.unmount());
  });

  it('corrects once: the height it then reports does not undo it', () => {
    const tree = render();
    layoutAt(822);
    layoutAt(921);
    expect(StyleSheet.flatten(mockProps.style as never)).toEqual({ flex: 0, height: 921 });
    act(() => tree.unmount());
  });
});
