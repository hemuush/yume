import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
const mockHidden = { value: false };
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn((cb: () => void) => require('react').useEffect(cb, [cb])),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/AmountField', () => ({
  AmountField: (p: object) =>
    require('react').createElement(require('react-native').View, { testID: 'amount', ...p }),
}));
jest.mock('@/components/DateField', () => ({
  DateField: (p: object) =>
    require('react').createElement(require('react-native').View, { testID: 'date', ...p }),
}));
jest.mock('@/db/accounts', () => ({
  listAccounts: jest.fn(async () => [{ id: 'bank', name: 'Bank', type: 'bank', currency: 'INR' }]),
}));
jest.mock('@/db/purchaseAffordability', () => ({
  estimatePurchase: jest.fn(async () => ({
    currency: 'INR',
    shortfallMinor: 10000,
    afterPurchaseMinor: 20000,
    lowestMinor: -10000,
    lowestDate: '2026-10-20',
    reservedMinor: 30000,
    through: '2026-11-12',
    incompleteSchedule: false,
    movements: [],
    reservations: [{ id: 'goal', name: 'Trip', archived: false, reservedMinor: 30000 }],
  })),
}));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden.value }) }));
import { PurchaseCheck } from './PurchaseCheck';
import { estimatePurchase } from '@/db/purchaseAffordability';
import { listAccounts } from '@/db/accounts';
import { router, useFocusEffect } from 'expo-router';
const words = (t: ReactTestRenderer) =>
  t.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
async function check() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PurchaseCheck />);
  });
  await act(async () => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('500'));
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Check purchase' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  return tree;
}
beforeEach(() => {
  mockHidden.value = false;
  jest.clearAllMocks();
});
it('checks the selected account, explains shortfalls and invalidates stale results on input changes', async () => {
  const tree = await check();
  expect(estimatePurchase).toHaveBeenCalledWith('bank', 50000, expect.any(String));
  expect(words(tree)).toContain('Short by ₹100');
  expect(words(tree)).not.toContain('Trip');
  await act(async () =>
    tree.root
      .find(
        (n) =>
          n.props.accessibilityLabel === 'How this estimate works' && typeof n.props.onPress === 'function'
      )
      .props.onPress()
  );
  expect(words(tree)).toContain('Trip');
  expect(words(tree)).toContain('Excludes unrecorded everyday spending');
  await act(async () => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('100'));
  expect(words(tree)).not.toContain('Short by');
  await act(async () => tree.unmount());
});
it('hides both the amounts and affordability outcome while privacy is enabled', async () => {
  mockHidden.value = true;
  const tree = await check();
  expect(words(tree)).toContain('Estimate hidden');
  expect(words(tree)).not.toContain('Short by');
  expect(words(tree)).not.toMatch(/₹[\d,]+/);
  await act(async () => tree.unmount());
});
it('does not show a positive estimate when the read fails', async () => {
  jest.mocked(estimatePurchase).mockRejectedValueOnce(new Error('Schedule unavailable'));
  const tree = await check();
  expect(words(tree)).toContain('Schedule unavailable');
  expect(words(tree)).not.toContain('Covered under');
  await act(async () => tree.unmount());
});
it('discards an in-flight estimate after the user changes inputs', async () => {
  const result = await estimatePurchase('bank', 50000, '2026-10-12');
  let resolve!: (value: typeof result) => void;
  jest.mocked(estimatePurchase).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PurchaseCheck />);
  });
  await act(async () => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('500'));
  let pending!: Promise<void>;
  await act(async () => {
    pending = tree.root
      .find((n) => n.props.title === 'Check purchase' && typeof n.props.onPress === 'function')
      .props.onPress();
  });
  await act(async () => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('100'));
  await act(async () => {
    resolve(result);
    await pending;
  });
  expect(words(tree)).not.toContain('Short by');
  expect(words(tree)).not.toContain('After purchase:');
  await act(async () => tree.unmount());
});
it('offers account setup instead of an unusable purchase form', async () => {
  jest.mocked(listAccounts).mockResolvedValueOnce([]);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PurchaseCheck />);
  });
  expect(tree.root.findAllByProps({ testID: 'amount' })).toHaveLength(0);
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Manage accounts' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  expect(router.push).toHaveBeenCalledWith('/profile');
  expect(estimatePurchase).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
it('can recover an account read failure directly', async () => {
  jest.mocked(listAccounts).mockRejectedValueOnce(new Error('Accounts unavailable'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PurchaseCheck />);
  });
  expect(words(tree)).toContain('Accounts unavailable');
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Retry accounts' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  expect(tree.root.findByProps({ testID: 'amount' })).toBeTruthy();
  expect(tree.root.find((n) => n.props.title === 'Check purchase').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});
it('refreshes accounts and discards the previous estimate when returning to the page', async () => {
  const tree = await check();
  expect(words(tree)).toContain('Short by');
  const reads = jest.mocked(listAccounts).mock.calls.length;
  await act(async () => {
    jest.mocked(useFocusEffect).mock.calls.at(-1)![0]();
  });
  expect(jest.mocked(listAccounts).mock.calls.length).toBe(reads + 1);
  expect(words(tree)).not.toContain('Short by');
  expect(tree.root.findByProps({ testID: 'amount' }).props.value).toBe('500');
  await act(async () => tree.unmount());
});
