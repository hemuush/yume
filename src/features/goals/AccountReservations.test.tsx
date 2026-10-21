import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { Account } from '@/types';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockHidden = { value: false };
const mockSummary = {
  balanceMinor: 200000,
  reservedMinor: 300000,
  availableMinor: 0,
  shortfallMinor: 100000,
  goals: [{ id: 'g1', name: 'Emergency', reservedMinor: 300000, archived: true }],
};
jest.mock('@/db/goalReservations', () => ({ getGoalReservationSummary: jest.fn(async () => mockSummary) }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden.value }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
import { AccountReservations } from './AccountReservations';
import { router } from 'expo-router';
import { getGoalReservationSummary } from '@/db/goalReservations';
const account = { id: 'a1', currency: 'INR', currentBalanceMinor: 200000 } as Account;
const words = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
async function render() {
  const close = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AccountReservations account={account} onNavigate={close} />);
  });
  return { tree, close };
}
beforeEach(() => {
  mockHidden.value = false;
  jest.clearAllMocks();
});
it('shows reserved/available money, retained archived allocations and the shortfall', async () => {
  const { tree, close } = await render();
  expect(words(tree)).toContain('Reserved');
  expect(words(tree)).toContain('₹3,000');
  expect(words(tree)).toContain('Available to reserve');
  expect(words(tree)).toContain('Archived · still reserved');
  expect(words(tree)).toContain('₹1,000 below reservations');
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Manage goals' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  expect(close).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith('/savings-goals');
  await act(async () => tree.unmount());
});
it('masks reservation, available and shortfall amounts together', async () => {
  mockHidden.value = true;
  const { tree } = await render();
  expect(words(tree)).not.toMatch(/₹[\d,]+/);
  expect(words(tree)).toContain('Emergency');
  await act(async () => tree.unmount());
});
it('shows a read failure rather than implying zero reservations', async () => {
  jest.mocked(getGoalReservationSummary).mockRejectedValueOnce(new Error('offline db'));
  const { tree } = await render();
  expect(words(tree)).toContain("Couldn't load goal reservations");
  expect(words(tree)).not.toContain('Available');
  await act(async () => {
    await tree.root
      .find((n) => n.props.title === 'Retry reservations' && typeof n.props.onPress === 'function')
      .props.onPress();
  });
  expect(words(tree)).toContain('Available to reserve');
  await act(async () => tree.unmount());
});
