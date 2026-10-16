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
