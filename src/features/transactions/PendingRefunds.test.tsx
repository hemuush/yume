import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
const mockPrivacy = { hideAmounts: false };
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => mockPrivacy }));
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

it('keeps ordinary refunds visible and masks only sensitive refunds', async () => {
  mockPrivacy.hideAmounts = true;
  const refund = {
    transactionId: 'p',
    expectedMinor: 2000,
    receivedMinor: 0,
    remainingMinor: 2000,
    dueDate: null,
    closed: false,
    currency: 'INR',
    receipts: [],
  };
  jest.mocked(listExpectedRefunds).mockResolvedValueOnce([
    { ...refund, id: 'normal', label: 'Normal', isSensitive: false },
    { ...refund, id: 'private', label: 'Private', isSensitive: true },
  ]);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PendingRefunds refreshToken={1} onOpen={jest.fn()} />);
  });
  const rows = tree.root.findAllByType(InsightRow);
  expect(rows[0].props.value).toContain('₹20');
  expect(rows[1].props.value).toContain('••••');
  await act(async () => tree.unmount());
  mockPrivacy.hideAmounts = false;
});

it('keeps Plan refunds collapsed until requested and preserves their purchase action', async () => {
  jest.mocked(listExpectedRefunds).mockResolvedValueOnce([
    {
      id: 'pending',
      transactionId: 'purchase',
      expectedMinor: 2000,
      receivedMinor: 0,
      remainingMinor: 2000,
      dueDate: null,
      closed: false,
      currency: 'INR',
      label: 'Purchase',
      receipts: [],
    },
  ]);
  let tree!: ReactTestRenderer;
  const onOpen = jest.fn();
  await act(async () => {
    tree = create(<PendingRefunds summaryOnly refreshToken={1} onOpen={onOpen} />);
  });
  expect(tree.root.findAllByType(InsightRow)).toHaveLength(0);
  act(() =>
    tree.root.find((n) => n.props.title === 'View 1 pending refund' && n.props.onPress).props.onPress()
  );
  expect(tree.root.findAllByType(InsightRow)).toHaveLength(1);
  jest.mocked(getTransactionById).mockResolvedValueOnce({ id: 'purchase' } as Transaction);
  await act(async () => tree.root.findByType(InsightRow).props.onPress());
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'purchase' }));
  act(() => tree.unmount());
});
