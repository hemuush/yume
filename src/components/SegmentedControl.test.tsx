import { create, act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Money plan', value: 'money' },
  { label: 'Debt', value: 'debt' },
];

describe('SegmentedControl', () => {
  it('leaves each label nearly the whole of its segment, so "Money plan" stays on one line in a quarter of a 360 dp phone', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SegmentedControl options={OPTIONS} value="money" onChange={jest.fn()} onBand />);
    });
    const segments = tree.root.findAll(
      (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tab'
    );
    expect(segments).toHaveLength(4);
    for (const segment of segments) {
      const style = StyleSheet.flatten(segment.props.style);
      // The picked label is the heavier weight and about 68 dp wide; a segment there has about 79 dp.
      expect(style.paddingHorizontal).toBeLessThanOrEqual(4);
    }
    act(() => tree.unmount());
  });

  it('reports the picked segment to a screen reader and changes the choice on a tap', () => {
    const onChange = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<SegmentedControl options={OPTIONS} value="money" onChange={onChange} />);
    });
    const tabs = tree.root
      .findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function')
      .filter((n, i, all) => all.findIndex((m) => m.props.onPress === n.props.onPress) === i);
    expect(tabs.map((t) => t.props.accessibilityState.selected)).toEqual([false, false, true, false]);
    act(() => tabs[3].props.onPress());
    expect(onChange).toHaveBeenCalledWith('debt');
    act(() => tree.unmount());
  });
});
