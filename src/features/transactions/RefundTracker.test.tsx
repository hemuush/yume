import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Transaction, Account } from '@/types';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockRefund = { value: null as any };
jest.mock('@/db/refundTracking', () => ({
  getExpectedRefund: jest.fn(async () => mockRefund.value),
  refundCandidates: jest.fn(async () => []),
  expectRefund: jest.fn(async () => {}),
  receiveRefund: jest.fn(async () => {}),
  closeExpectedRefund: jest.fn(async () => {}),
  undoRefundReceipt: jest.fn(async () => {}),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: p.label, ...p }),
}));
jest.mock('@/components/DateField', () => ({
  DateField: (p: object) => require('react').createElement(require('react-native').View, p),
}));
import { RefundTracker } from './RefundTracker';
import { expectRefund, receiveRefund } from '@/db/refundTracking';
const transaction = {
  id: 'purchase',
  type: 'expense',
  amountMinor: 100000,
  accountId: 'bank',
  date: '2026-10-01',
} as Transaction;
const accounts = [{ id: 'bank', name: 'Bank', type: 'bank', currency: 'INR' }] as Account[];
async function render() {
  let tree!: ReactTestRenderer;
  const changed = jest.fn();
  await act(async () => {
    tree = create(<RefundTracker transaction={transaction} accounts={accounts} onChanged={changed} />);
  });
  return { tree, changed };
}
const press = (tree: ReactTestRenderer, title: string) =>
  tree.root.find((n) => n.props.title === title && typeof n.props.onPress === 'function');
beforeEach(() => {
  mockRefund.value = null;
  jest.clearAllMocks();
});
it('records an expectation through a separate action rather than receiving money', async () => {
  const { tree, changed } = await render();
  await act(async () => press(tree, 'Expect refund').props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'Expected refund amount' }).props.onChangeText('500')
  );
  await act(async () => press(tree, 'Save expectation').props.onPress());
  expect(expectRefund).toHaveBeenCalledWith('purchase', 50000, null);
  expect(receiveRefund).not.toHaveBeenCalled();
  expect(changed).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
it('records a partial receipt in the selected account', async () => {
  mockRefund.value = {
    id: 'e1',
    expectedMinor: 100000,
    receivedMinor: 0,
    remainingMinor: 100000,
    dueDate: null,
    closed: false,
    receipts: [],
  };
  const { tree } = await render();
  await act(async () =>
    tree.root
      .find(
        (n) => n.props.accessibilityLabel === 'Record money received' && typeof n.props.onPress === 'function'
      )
      .props.onPress()
  );
  await act(async () => tree.root.findByProps({ testID: 'Refund received' }).props.onChangeText('100'));
  await act(async () => press(tree, 'Record received refund').props.onPress());
  expect(receiveRefund).toHaveBeenCalledWith(
    'purchase',
    expect.objectContaining({ amountMinor: 10000, accountId: 'bank' })
  );
  await act(async () => tree.unmount());
});
it('cancels expectation edits without creating or receiving money', async () => {
  const { tree, changed } = await render();
  await act(async () => press(tree, 'Expect refund').props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'Expected refund amount' }).props.onChangeText('500')
  );
  await act(async () => press(tree, 'Cancel editing').props.onPress());
  expect(press(tree, 'Expect refund')).toBeTruthy();
  expect(expectRefund).not.toHaveBeenCalled();
  expect(receiveRefund).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

it('hides the redundant creation button and opens expectation editing on request', async () => {
  let tree!: ReactTestRenderer;
  const base = { transaction, accounts, onChanged: jest.fn(), hideCreateAction: true };
  await act(async () => {
    tree = create(<RefundTracker {...base} />);
  });
  expect(tree.root.findAll((n) => n.props.title === 'Expect refund')).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'Expected refund amount' })).toHaveLength(0);
  await act(async () => {
    tree.update(<RefundTracker {...base} request={{ sequence: 1, mode: 'expect' }} />);
  });
  expect(tree.root.findAllByProps({ testID: 'Expected refund amount' }).length).toBeGreaterThan(0);
  await act(async () => press(tree, 'Cancel editing').props.onPress());
  expect(tree.root.findAllByProps({ testID: 'Expected refund amount' })).toHaveLength(0);
  act(() => tree.unmount());
});
it('opens receipt recording for an existing expectation without creating another refund', async () => {
  mockRefund.value = {
    id: 'e1',
    expectedMinor: 100000,
    receivedMinor: 0,
    remainingMinor: 100000,
    dueDate: null,
    closed: false,
    receipts: [],
  };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RefundTracker
        transaction={transaction}
        accounts={accounts}
        onChanged={jest.fn()}
        hideCreateAction
        request={{ sequence: 1, mode: 'receive' }}
      />
    );
  });
  expect(tree.root.findAllByProps({ testID: 'Refund received' }).length).toBeGreaterThan(0);
  expect(expectRefund).not.toHaveBeenCalled();
  expect(receiveRefund).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it('reports a refresh failure as saved and clears the receipt amount instead of inviting a second receipt', async () => {
  mockRefund.value = {
    id: 'e1',
    expectedMinor: 100000,
    receivedMinor: 0,
    remainingMinor: 100000,
    dueDate: null,
    closed: false,
    receipts: [],
  };
  const changed = jest.fn(() => {
    throw new Error('refresh failed');
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RefundTracker
        transaction={transaction}
        accounts={accounts}
        onChanged={changed}
        request={{ sequence: 1, mode: 'receive' }}
      />
    );
  });
  try {
    act(() => tree.root.findByProps({ testID: 'Refund received' }).props.onChangeText('100'));
    await act(async () => {
      await press(tree, 'Record received refund').props.onPress();
    });
    expect(receiveRefund).toHaveBeenCalledTimes(1);
    expect(tree.root.findByProps({ testID: 'Refund received' }).props.value).toBe('');
    expect(JSON.stringify(tree.toJSON())).toContain('Saved. Couldn’t refresh');
  } finally {
    act(() => tree.unmount());
  }
});

it('keeps a receipt draft and skips refresh when the write itself fails', async () => {
  mockRefund.value = {
    id: 'e1',
    expectedMinor: 100000,
    receivedMinor: 0,
    remainingMinor: 100000,
    dueDate: null,
    closed: false,
    receipts: [],
  };
  jest.mocked(receiveRefund).mockRejectedValueOnce(new Error('write failed'));
  const { tree, changed } = await render();
  try {
    act(() =>
      tree.root
        .find(
          (n) =>
            n.props.accessibilityLabel === 'Record money received' && typeof n.props.onPress === 'function'
        )
        .props.onPress()
    );
    act(() => tree.root.findByProps({ testID: 'Refund received' }).props.onChangeText('100'));
    await act(async () => {
      await press(tree, 'Record received refund').props.onPress();
    });
    expect(tree.root.findByProps({ testID: 'Refund received' }).props.value).toBe('100');
    expect(changed).not.toHaveBeenCalled();
  } finally {
    act(() => tree.unmount());
  }
});
