import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

let mockKeysDrawn = 0;
jest.mock('@/lib/usePressScale', () => ({
  usePressScale: () => {
    mockKeysDrawn++;
    return { animatedStyle: {}, onPressIn: jest.fn(), onPressOut: jest.fn() };
  },
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn() } }));
jest.mock('@/lib/uiScale', () => ({ useUiScale: () => 1 }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { AmountPad } from './AmountPad';

const TONE = { bg: '#eef', ink: '#00f' };
const keyOf = (tree: ReturnType<typeof create>, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

beforeEach(() => {
  mockKeysDrawn = 0;
});

describe('AmountPad', () => {
  it('shows the sixteen keys, and each one calls back with its key', () => {
    const onKey = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <AmountPad onKey={onKey} onClear={jest.fn()} tone={TONE}>
          <Text>Save</Text>
        </AmountPad>
      );
    });
    act(() => keyOf(tree, '7').props.onPress());
    act(() => keyOf(tree, 'plus').props.onPress());
    act(() => keyOf(tree, 'delete').props.onPress());
    expect(onKey.mock.calls.map(([key]) => key)).toEqual(['7', '+', 'back']);
  });

  it('clears the amount with a long press on delete, and only there', () => {
    const onClear = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <AmountPad onKey={jest.fn()} onClear={onClear} tone={TONE}>
          {null}
        </AmountPad>
      );
    });
    expect(keyOf(tree, '7').props.onLongPress).toBeUndefined();
    act(() => keyOf(tree, 'delete').props.onLongPress());
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not draw its keys again when what is around it is drawn again with the same keys', () => {
    const onKey = jest.fn();
    const onClear = jest.fn();
    const render = (label: string) => (
      <AmountPad onKey={onKey} onClear={onClear} tone={TONE}>
        <Text>{label}</Text>
      </AmountPad>
    );
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(render('Save'));
    });
    const first = mockKeysDrawn;
    expect(first).toBe(16);
    // The last row (Save, Add more) is new each time the footer is drawn: the sixteen keys above it are left alone.
    act(() => tree.update(render('Save ₹750')));
    expect(mockKeysDrawn).toBe(first);
  });

  it('draws its keys again when the colour changes', () => {
    let tree!: ReturnType<typeof create>;
    const render = (tone: { bg: string; ink: string }) => (
      <AmountPad onKey={jest.fn()} onClear={jest.fn()} tone={tone}>
        {null}
      </AmountPad>
    );
    act(() => {
      tree = create(render(TONE));
    });
    const first = mockKeysDrawn;
    act(() => tree.update(render({ bg: '#efe', ink: '#0a0' })));
    expect(mockKeysDrawn).toBeGreaterThan(first);
  });
});
