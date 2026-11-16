jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { GroupPicker, ReportTabs, ComparisonNote } from './ReportControls';
import { ActionSheet } from '@/components/ActionSheet';
jest.mock('@/components/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/components/ModalSheet', () => ({ ModalSheet: () => null }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));

it('keeps category/account navigation and opens label exploration from the spending menu', () => {
  const onGroup = jest.fn();
  const onLabels = jest.fn();
  act(() => {
    tree = create(<GroupPicker flow="expense" group="category" onGroup={onGroup} onLabels={onLabels} />);
  });
  const items = tree.root.findByType(ActionSheet).props.items;
  expect(items.map((item: { key: string }) => item.key)).toEqual(['category', 'account', 'label']);
  act(() => items[1].onPress());
  expect(onGroup).toHaveBeenCalledWith('account');
  act(() => items[2].onPress());
  expect(onLabels).toHaveBeenCalledTimes(1);
});

it('does not offer expense labels in income or when no label action is provided', () => {
  for (const flow of ['expense', 'income'] as const) {
    act(() => {
      tree = create(
        <GroupPicker
          flow={flow}
          group="account"
          onGroup={jest.fn()}
          {...(flow === 'income' ? { onLabels: jest.fn() } : {})}
        />
      );
    });
    expect(tree.root.findByType(ActionSheet).props.items.map((item: { key: string }) => item.key)).toEqual([
      'category',
      'account',
    ]);
    act(() => tree.unmount());
  }
});

it('keeps every report tab selectable and marks the active destination', () => {
  const onChange = jest.fn();
  act(() => {
    tree = create(<ReportTabs value="cats" onChange={onChange} />);
  });
  const tabs = tree.root.findAll(
    (n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function'
  );
  expect(tabs.map((n) => n.props.accessibilityLabel)).toEqual(['Overview', 'Breakdown', 'Trends']);
  expect(tabs.map((n) => n.props.accessibilityState.selected)).toEqual([false, true, false]);
  act(() => tabs[2].props.onPress());
  expect(onChange).toHaveBeenCalledWith('trends');
});

it.each([1, 1.3, 2])(
  'at text scale %s the report tabs stay in one scrollable tab list, and Trends still opens',
  (fontScale) => {
    const spy = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 360, height: 800, fontScale, scale: 1 });
    const onChange = jest.fn();
    act(() => {
      tree = create(<ReportTabs value="days" onChange={onChange} />);
    });
    const lists = tree.root.findAll((n) => n.props.accessibilityRole === 'tablist');
    expect(lists.length).toBeGreaterThan(0);
    const trends = tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'tab' &&
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Trends')
    )[0];
    act(() => trends.props.onPress());
    expect(onChange).toHaveBeenCalledWith('trends');
    spy.mockRestore();
  }
);

it('gives the comparison note a 44 dp touch area though its row is drawn 36 tall', () => {
  const { StyleSheet } = require('react-native');
  let tree!: ReactTestRenderer;
  jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
  act(() => {
    tree = create(<ComparisonNote label="So far vs the whole month before" partial />);
  });
  const row = tree.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel?.includes('About comparisons')
  );
  const drawn = StyleSheet.flatten(
    typeof row.props.style === 'function' ? row.props.style({ pressed: false }) : row.props.style
  ).minHeight as number;
  const slop = row.props.hitSlop as { top: number; bottom: number };
  expect(drawn + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  act(() => tree.unmount());
});
