import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Modal } from 'react-native';
jest.unmock('@/components/SheetFlow');
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
  initialWindowMetrics: null,
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react').forwardRef((props: object, ref: unknown) =>
    require('react').createElement(require('react-native').ScrollView, { ...props, ref })
  ),
}));
jest.mock('@/components/AmountField', () => ({
  AmountPadHostProvider: require('react').createContext(null).Provider,
  useAmountPadHost: () => ({ host: {}, pad: null, scrollProps: {} }),
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('@/db/settings', () => ({ getCachedCurrency: () => 'INR' }));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('./AssetModal', () => ({ AssetModal: () => null }));
jest.mock('./RateChangeModal', () => ({ RateChangeModal: () => null }));
jest.mock('./PrepayModal', () => ({ PrepayModal: () => null }));
jest.mock('./PayInstallmentSheet', () => ({ PayInstallmentSheet: () => null }));
jest.mock('./LoanSchedule', () => ({ LoanSchedule: () => null }));
const mockLoan = {
  id: 'loan',
  counterparty: 'Test loan',
  direction: 'borrowed',
  rateType: 'fixed',
  status: 'active',
  interestRateAnnualBp: 900,
  principalMinor: 1200000,
  outstandingPrincipalMinor: 900000,
  emiAmountMinor: 100000,
  startDate: '2026-01-01',
  linkedAccountId: 'bank1',
  assetValueMinor: null,
  assetLabel: null,
};
const mockUpdate = jest.fn(async (_id: string, accountId: string) => {
  mockLoan.linkedAccountId = accountId;
});
jest.mock('@/db/loans', () => ({
  getLoanById: async () => ({ ...mockLoan }),
  getLoanSchedule: async () => [],
  getLoanRateHistory: async () => [],
  updateLoanAccount: (...args: [string, string]) => mockUpdate(...args),
}));
jest.mock('@/db/ledger', () => ({
  listAccounts: async () => [
    { id: 'bank1', name: 'First bank', type: 'bank', currency: 'INR' },
    { id: 'bank2', name: 'Second bank', type: 'bank', currency: 'INR' },
  ],
  listCategories: async () => [],
}));
import { LoanDetailModal } from './LoanDetailModal';
import type { Loan } from '@/types';

it('opens EMI account inside the existing native sheet, saves and returns to refreshed loan details', async () => {
  let tree!: ReactTestRenderer;
  const changed = jest.fn();
  await act(async () => {
    tree = create(<LoanDetailModal loan={mockLoan as Loan} onClose={jest.fn()} onChanged={changed} />);
  });
  const window = tree.root.findByType(Modal);
  act(() => tree.root.find((n) => n.props.label === 'EMI account' && n.props.onPress).props.onPress());
  expect(tree.root.findAllByType(Modal)).toHaveLength(1);
  expect(tree.root.findByType(Modal)).toBe(window);
  expect(window.props.visible).toBe(true);
  act(() => tree.root.find((n) => n.props.label === 'Second bank' && n.props.onPress).props.onPress());
  await act(async () => {
    await tree.root.find((n) => n.props.title === 'Save' && n.props.onPress).props.onPress();
  });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith('loan', 'bank2');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(tree.root.find((n) => n.props.label === 'EMI account' && n.props.onPress).props.sub).toBe(
    'Second bank'
  );
  expect(tree.root.findByType(Modal)).toBe(window);
  act(() => tree.unmount());
});
