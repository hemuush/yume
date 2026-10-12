import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/db/refundTracking', () => ({ listExpectedRefunds: jest.fn(async () => []) }));
jest.mock('@/db/transactions', () => ({ getTransactionById: jest.fn() }));
import { listExpectedRefunds } from '@/db/refundTracking';
import { PendingRefunds } from './PendingRefunds';
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
