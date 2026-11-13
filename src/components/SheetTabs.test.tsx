import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { SheetTabs } from './SheetTabs';
import { haptics } from '@/lib/haptics';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

it('switches tabs once with feedback and leaves an already selected tab alone', () => {
  const change = jest.fn();
  let tree!: ReactTestRenderer;
  const content = (value: 'overview' | 'schedule') => (
    <SheetTabs
      options={[
        { label: 'Overview', value: 'overview' },
        { label: 'Schedule', value: 'schedule' },
      ]}
      value={value}
      onChange={change}
    />
  );
  act(() => {
    tree = create(content('overview'));
  });
  let tabs = tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && n.props.onPress);
  expect(tabs[0].props.accessibilityState.selected).toBe(true);
  act(() => tabs[0].props.onPress());
  expect(change).not.toHaveBeenCalled();
  act(() => tabs[1].props.onPress());
  expect(change).toHaveBeenCalledWith('schedule');
  expect(haptics.tap).toHaveBeenCalledTimes(1);
  act(() => tree.update(content('schedule')));
  tabs = tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && n.props.onPress);
  expect(tabs[1].props.accessibilityState.selected).toBe(true);
  act(() => tabs[1].props.onPress());
  expect(change).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

describe('five types on a phone', () => {
  const TYPES = ['All', 'Expense', 'Income', 'Transfer', 'Invest'].map((label) => ({ label, value: label }));
  const wrapsAt = (width: number, fontScale: number) => {
    const spy = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width, height: 800, fontScale, scale: 1 });
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<SheetTabs options={TYPES} value="All" onChange={jest.fn()} />);
    });
    const { StyleSheet } = require('react-native');
    const row = StyleSheet.flatten(
      tree.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist').props.style
    );
    const tab = tree.root.findAll((n) => n.props.accessibilityRole === 'tab' && n.props.onPress)[0];
    const tabStyle = StyleSheet.flatten(tab.props.style({ pressed: false }));
    act(() => tree.unmount());
    spy.mockRestore();
    return { wrap: row.flexWrap === 'wrap', basis: tabStyle.flexBasis, flex: tabStyle.flex };
  };

  it('stay in one row while "Transfer" fits a fifth of the row', () => {
    expect(wrapsAt(360, 1)).toEqual({ wrap: false, basis: undefined, flex: 1 });
  });

  it('wrap two to a row at large text, instead of breaking a word', () => {
    expect(wrapsAt(360, 2)).toEqual({ wrap: true, basis: '45%', flex: undefined });
    expect(wrapsAt(360, 1.3).wrap).toBe(true);
  });
});
