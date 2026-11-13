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

  describe('with more choices than the track can hold', () => {
    const FIVE = ['All', 'Expense', 'Income', 'Transfer', 'Invest'].map((label) => ({ label, value: label }));
    const blocksAt = (options: { label: string; value: string }[], width: number, fontScale: number) => {
      const spy = jest
        .spyOn(require('react-native'), 'useWindowDimensions')
        .mockReturnValue({ width, height: 800, fontScale, scale: 1 });
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<SegmentedControl options={options} value={options[0].value} onChange={jest.fn()} />);
      });
      const list = tree.root.find(
        (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist'
      );
      const blocks = list.children.length;
      act(() => tree.unmount());
      spy.mockRestore();
      return blocks;
    };

    it('keeps five choices in one row while "Transfer" fits a fifth of a 360 dp phone', () => {
      expect(blocksAt(FIVE, 360, 1)).toBe(5);
    });

    it('puts them two to a row at 130% text, or on a 320 dp phone, instead of breaking a word', () => {
      expect(blocksAt(FIVE, 360, 1.3)).toBe(3);
      expect(blocksAt(FIVE, 320, 1)).toBe(3);
    });

    it('stacks three choices only when "Breakdown" no longer fits a third', () => {
      const reports = ['Overview', 'Breakdown', 'Trends'].map((label) => ({ label, value: label }));
      expect(blocksAt(reports, 360, 1.3)).toBe(3);
      expect(blocksAt(reports, 360, 2)).toBe(2);
    });

    it('never stacks two choices, however large the text', () => {
      const two = ['Fixed', 'Floating'].map((label) => ({ label, value: label }));
      expect(blocksAt(two, 320, 2)).toBe(2);
    });
  });
});
