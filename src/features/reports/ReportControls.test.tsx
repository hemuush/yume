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
  // The test renderer's default text scale is 2, which stacks the tabs; this is the one-row switch.
  const spy = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 360, height: 800, fontScale: 1, scale: 1 });
  const onChange = jest.fn();
  act(() => {
    tree = create(<ReportTabs value="cats" onChange={onChange} />);
  });
  // The switch is an animated Pressable, so each tab appears twice (wrapper, then the Pressable it wraps).
  const tabs = tree.root
    .findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function')
    .filter((_, i) => i % 2 === 0);
  expect(tabs).toHaveLength(3);
  expect(tabs.map((n) => n.props.accessibilityState.selected)).toEqual([false, true, false]);
  act(() => tabs[2].props.onPress());
  expect(onChange).toHaveBeenCalledWith('trends');
  spy.mockRestore();
});

it.each([
  [1, 3],
  [1.3, 3],
  [2, 2],
])(
  'at text scale %s the report tabs are %i blocks in the tab list, and Trends still opens',
  (fontScale, blocks) => {
    const spy = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 360, height: 800, fontScale, scale: 1 });
    const onChange = jest.fn();
    act(() => {
      tree = create(<ReportTabs value="days" onChange={onChange} />);
    });
    // One row of three tabs, or (past 130%, when "Breakdown" no longer fits a third of the track) two rows.
    const list = tree.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist');
    expect(list.children).toHaveLength(blocks);
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
