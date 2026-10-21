import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { LoanSchedule } from './LoanSchedule';
import type { LoanPayment } from '@/types';
import { dayMonthYear } from '@/lib/dateLabels';

jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
const entry = (over: Partial<LoanPayment>) =>
  ({
    id: 'p1',
    loanId: 'loan',
    installmentNumber: 1,
    dueDate: '2026-10-05',
    paidDate: '2026-10-21',
    status: 'paid',
    emiAmountMinor: 10000,
    principalComponentMinor: 9000,
    interestComponentMinor: 1000,
    outstandingAfterMinor: 0,
    transactionId: 'tx',
    ...over,
  }) as LoanPayment;

it.each(['borrowed', 'lent'] as const)('shows the actual movement date for a %s loan', (direction) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<LoanSchedule direction={direction} schedule={[entry({})]} />);
  });
  const labels = tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
  expect(labels).toContain(`${direction === 'lent' ? 'Received' : 'Paid'} ${dayMonthYear('2026-10-21')}`);
  act(() => tree.unmount());
});

it('distinguishes imported paid history from an account transaction', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<LoanSchedule schedule={[entry({ paidDate: null, transactionId: null })]} />);
  });
  expect(tree.root.findAllByType(Text).map((n) => n.props.children)).toContain(
    'Paid before tracking · no account entry'
  );
  act(() => tree.unmount());
});

it('does not call a real transaction pre-tracking history when its date is missing', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<LoanSchedule schedule={[entry({ paidDate: null })]} />);
  });
  expect(tree.root.findAllByType(Text).map((n) => n.props.children)).toContain(
    'Recorded payment · date unavailable'
  );
  act(() => tree.unmount());
});
