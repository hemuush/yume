jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { BreakdownControls, ReportTabs } from './ReportControls';
import { ActionSheet } from '@/components/ActionSheet';
jest.mock('@/components/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/components/ModalSheet', () => ({ ModalSheet: () => null }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));

it('keeps category/account navigation and opens label exploration from the spending menu', () => {
  const onGroup = jest.fn();
  const onLabels = jest.fn();
  act(() => {
    tree = create(
      <BreakdownControls
        flow="expense"
        group="category"
        view="tree"
        onView={jest.fn()}
        onFlow={jest.fn()}
        onGroup={onGroup}
        onLabels={onLabels}
      />
    );
  });
  const items = tree.root.findByType(ActionSheet).props.items;
  expect(items.map((item: { key: string }) => item.key)).toEqual(['category', 'account', 'label']);
  act(() => items[1].onPress());
  expect(onGroup).toHaveBeenCalledWith('account');
  act(() => items[2].onPress());
  expect(onLabels).toHaveBeenCalledTimes(1);
});

it('switches the split between tiles and a bar', () => {
  const onView = jest.fn();
  act(() => {
    tree = create(
      <BreakdownControls
        flow="expense"
        group="category"
        view="tree"
        onView={onView}
        onFlow={jest.fn()}
        onGroup={jest.fn()}
      />
    );
  });
  const bar = tree.root.find((n) => n.props.accessibilityLabel === 'Show as bar');
  act(() => bar.props.onPress());
  expect(onView).toHaveBeenCalledWith('bar');
  expect(
    tree.root.find((n) => n.props.accessibilityLabel === 'Show as tiles').props.accessibilityState
  ).toEqual({
    selected: true,
  });
});

it('does not offer expense labels in income or when no label action is provided', () => {
  for (const flow of ['expense', 'income'] as const) {
    act(() => {
      tree = create(
        <BreakdownControls
          flow={flow}
          group="account"
          view="tree"
          onView={jest.fn()}
          onFlow={jest.fn()}
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
  expect(tabs).toHaveLength(3);
  expect(tabs.map((n) => n.props.accessibilityState.selected)).toEqual([false, true, false]);
  act(() => tabs[2].props.onPress());
  expect(onChange).toHaveBeenCalledWith('trends');
});
