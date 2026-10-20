import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { LoanComparison } from './LoanComparison';
import { AmountField } from '@/components/AmountField';
import { comparePrepayments } from '@/db/loans';
import { formatMoney } from '@/lib/money';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/db/loans', () => ({ comparePrepayments: jest.fn() }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
const props = {
  visible: true,
  hidden: false,
  currency: 'INR',
  loans: [{ id: 'a', name: 'Loan A', leftMinor: 100000, nextDueDate: '2026-11-01' }],
  onClose: jest.fn(),
  onOpenLoan: jest.fn(),
};
let tree: ReactTestRenderer;
const rows = (saving: number) => [
  { id: 'a', summary: { interestSavedMinor: saving, monthsShaved: 1, newPayoffDate: '2027-01-01' } },
];
const text = () =>
  tree.root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .flat(Infinity)
    .join('');
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => tree?.unmount());
  jest.useRealTimers();
  jest.resetAllMocks();
});
it('recalculates after a rate/restore refresh even with identical balance and due date', async () => {
  (comparePrepayments as jest.Mock).mockResolvedValueOnce(rows(1000)).mockResolvedValueOnce(rows(2000));
  await act(async () => {
    tree = create(<LoanComparison {...props} refreshToken={{}} />);
  });
  act(() => tree.root.findByType(AmountField).props.onChangeText('100'));
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(text()).toContain(formatMoney(1000, 'INR'));
  await act(async () => tree.update(<LoanComparison {...props} refreshToken={{}} />));
  expect(text()).not.toContain(formatMoney(1000, 'INR'));
  await act(async () => {
    jest.advanceTimersByTime(250);
  });
  expect(comparePrepayments).toHaveBeenCalledTimes(2);
  expect(text()).toContain(formatMoney(2000, 'INR'));
});
it('does not query hidden comparisons', async () => {
  await act(async () => {
    tree = create(<LoanComparison {...props} hidden />);
    jest.advanceTimersByTime(250);
  });
  expect(comparePrepayments).not.toHaveBeenCalled();
  expect(text()).toContain('Reveal amounts');
});
