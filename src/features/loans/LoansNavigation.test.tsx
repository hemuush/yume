import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Loan } from '@/types';

jest.setTimeout(120000);
let mockParams: { pay?: string; loan?: string } = {};
const mockSetParams = jest.fn((next: object) => {
  mockParams = { ...mockParams, ...next };
});
const mockAlert = jest.fn();
const mockLoans: Loan[] = ['first', 'second', 'closed'].map(
  (id) =>
    ({
      id,
      counterparty: id,
      status: id === 'closed' ? 'closed' : 'active',
      direction: 'borrowed',
      principalMinor: 100000,
      outstandingPrincipalMinor: id === 'closed' ? 0 : 50000,
      emiAmountMinor: 10000,
    }) as Loan
);
const mockListLoans = jest.fn(async () => mockLoans);
jest.mock('expo-router', () => ({
  router: { setParams: (next: object) => mockSetParams(next) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/db/loans', () => ({ listLoans: () => mockListLoans(), getLoanProgress: async () => [] }));
jest.mock('@/lib/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    const React = require('react');
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      void load().then(() => setLoaded(true));
    }, [load]);
    return { loaded, hasData: loaded, loadError: null, reload: load };
  },
}));
jest.mock('@/components/AppDialog', () => ({ showAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock('@/lib/useCollapsingHeader', () => ({ useCollapsingHeader: () => ({ headerHeight: 100 }) }));
jest.mock('@/features/home/SkyHeader', () => ({ SkyHeader: () => null, HeaderSummary: () => null }));
jest.mock('@/features/home/HomeWallpaper', () => ({ HomeWallpaper: () => null }));
jest.mock('@/features/loans/LoansHero', () => ({ LoansHero: () => null }));
jest.mock('@/features/loans/LoanCard', () => ({ LoanCard: () => null }));
jest.mock('@/features/loans/LoanDetailModal', () => ({ LoanDetailModal: () => null }));
jest.mock('@/features/loans/AddLoanModal', () => ({ AddLoanModal: () => null }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/MovingRow', () => ({
  MovingRow: ({ children }: { children: React.ReactNode }) => children,
}));

import LoansScreen from '../../../app/loans';
import { LoanDetailModal } from './LoanDetailModal';
import { LoansHero } from './LoansHero';

let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  mockParams = {};
  jest.clearAllMocks();
});
async function open(params: typeof mockParams) {
  mockParams = params;
  await act(async () => {
    tree = create(<LoansScreen />);
  });
}

it('consumes each pay link and can open a later reminder in the same screen', async () => {
  await open({ pay: 'first' });
  expect(tree.root.findByType(LoanDetailModal).props.loan.id).toBe('first');
  act(() => tree.root.findByType(LoanDetailModal).props.onClose());
  mockParams = { pay: 'second' };
  await act(async () => tree.update(<LoansScreen />));
  expect(tree.root.findByType(LoanDetailModal).props.loan.id).toBe('second');
  expect(tree.root.findByType(LoanDetailModal).props.startWithPay).toBe(true);
  expect(mockSetParams).toHaveBeenCalledWith({ pay: undefined, loan: undefined });
});

it('opens a closed loan for review without asking to record another payment', async () => {
  await open({ loan: 'closed' });
  expect(tree.root.findByType(LoanDetailModal).props.loan.id).toBe('closed');
  expect(tree.root.findByType(LoanDetailModal).props.startWithPay).toBe(false);
});

it('explains a reminder whose loan no longer exists', async () => {
  await open({ pay: 'deleted' });
  expect(mockAlert).toHaveBeenCalledWith('Loan unavailable', expect.any(String));
  expect(tree.root.findAllByType(LoanDetailModal)).toHaveLength(0);
});

it('does not claim everything was paid off on a fresh empty loan list', async () => {
  mockListLoans.mockResolvedValueOnce([]);
  await open({});
  expect(tree.root.findAllByType(LoansHero)).toHaveLength(0);
});
