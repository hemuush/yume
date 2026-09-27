/**
 * Home's Wrap button: nothing when no Wrap is ready, one tap plays the one
 * that is, a pastel ring until it's watched, and on the day both are ready
 * a 2 that asks which to play. All figures are made up.
 */
import { View, Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8CCED6' }) }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => {
    const { View: Ring } = require('react-native');
    return <Ring testID="fresh-ring">{children}</Ring>;
  },
}));
// Sheets render their contents in place while open.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));

import { WrapButton } from './WrapButton';
import type { ReadyWrap } from '@/features/wrap/wrapWindow';

const month: ReadyWrap = {
  period: 'month',
  key: '2026-09',
  label: 'September',
  spentMinor: 3_842_000,
  seen: false,
};
const week: ReadyWrap = {
  period: 'week',
  key: '2026-09-27',
  label: '27 Sept – 3 Oct',
  spentMinor: 615_000,
  seen: false,
};

function render(wraps: ReadyWrap[], onPlay = jest.fn()) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<WrapButton wraps={wraps} onPlay={onPlay} />);
  });
  return tree;
}
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const hasFreshRing = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.type === View && n.props.testID === 'fresh-ring').length > 0;

describe('Wrap button', () => {
  it('is not there when no Wrap is ready', () => {
    expect(render([]).toJSON()).toBeNull();
  });

  it('plays the one ready Wrap in a tap', () => {
    const onPlay = jest.fn();
    const tree = render([week], onPlay);
    act(() => byLabel(tree, "Play last week's Wrap").props.onPress());
    expect(onPlay).toHaveBeenCalledWith(week);
  });

  it('keeps its pastel ring until the Wrap is watched', () => {
    expect(hasFreshRing(render([month]))).toBe(true);
    expect(hasFreshRing(render([{ ...month, seen: true }]))).toBe(false);
  });

  it('asks which to play when both are ready', () => {
    const onPlay = jest.fn();
    const tree = render([month, week], onPlay);
    expect(texts(tree)).toContain('2');
    act(() => byLabel(tree, 'Play a Wrap, 2 ready').props.onPress());
    expect(onPlay).not.toHaveBeenCalled();
    expect(texts(tree)).toEqual(
      expect.arrayContaining(['September', 'Your month · 15 sec', 'Your week · 8 sec'])
    );
    act(() => byLabel(tree, "Play last week's Wrap, ₹6,150 spent").props.onPress());
    expect(onPlay).toHaveBeenCalledWith(week);
  });
});
