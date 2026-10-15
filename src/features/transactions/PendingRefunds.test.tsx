import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/db/refundTracking', () => ({ listExpectedRefunds: jest.fn(async () => []) }));
jest.mock('@/db/transactions', () => ({ getTransactionById: jest.fn() }));
import { listExpectedRefunds } from '@/db/refundTracking';
import { PendingRefunds } from './PendingRefunds';
import { getTransactionById } from '@/db/transactions';
import { InsightRow } from '@/components/InsightCard';
import type { ExpectedRefund } from '@/db/refundTracking';
import type { Transaction } from '@/types';
it('shows pending purchases immediately, sorts dated refunds first and opens the purchase', async () => {
  const refund = (id: string, dueDate: string | null): ExpectedRefund => ({
    id,
    transactionId: id,
    expectedMinor: 2000,
    receivedMinor: 500,
    remainingMinor: 1500,
    dueDate,
    closed: false,
    currency: 'INR',
    label: `Purchase ${id}`,
    receipts: [],
  });
  jest
    .mocked(listExpectedRefunds)
    .mockResolvedValueOnce([
      refund('undated', null),
      refund('later', '2099-01-01'),
      refund('overdue', '2020-01-01'),
      refund('extra', null),
    ]);
  const purchase = { id: 'overdue' } as Transaction;
  jest.mocked(getTransactionById).mockResolvedValueOnce(purchase);
  const open = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PendingRefunds refreshToken={0} onOpen={open} />);
  });
  const rows = tree.root.findAllByType(InsightRow);
  expect(rows.map((row) => row.props.label)).toEqual([
    'Purchase overdue',
    'Purchase later',
    'Purchase undated',
  ]);
  expect(rows[0].props.detail).toContain('Overdue');
  await act(async () => rows[0].props.onPress());
  expect(open).toHaveBeenCalledWith(purchase);
  act(() =>
    tree.root
      .find((node) => node.props.title === 'View all 4 refunds' && typeof node.props.onPress === 'function')
      .props.onPress()
  );
  expect(tree.root.findAllByType(InsightRow)).toHaveLength(4);
  await act(async () => tree.update(<PendingRefunds refreshToken={1} onOpen={open} />));
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
  jest.clearAllMocks();
});
it('retries a failed pending-refund load without displaying it as an empty result', async () => {
  jest.mocked(listExpectedRefunds).mockRejectedValueOnce(new Error('Unavailable'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PendingRefunds refreshToken={0} onOpen={jest.fn()} />);
  });
  expect(
    tree.root.findAllByType(Text).some((n) => String(n.props.children).includes("Couldn't refresh"))
  ).toBe(true);
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Retry refunds' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  expect(listExpectedRefunds).toHaveBeenCalledTimes(2);
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.unmount());
});
