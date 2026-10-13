jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { BreakdownControls } from './ReportControls';
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

it('does not offer expense labels in income or when no label action is provided', () => {
  for (const flow of ['expense', 'income'] as const) {
    act(() => {
      tree = create(
        <BreakdownControls
          flow={flow}
          group="account"
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
