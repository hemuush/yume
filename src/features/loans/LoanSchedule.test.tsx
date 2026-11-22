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

describe('a year with EMIs still to pay', () => {
  const emi = (n: number, status: LoanPayment['status']) =>
    entry({
      id: 'p' + n,
      installmentNumber: n,
      dueDate: '2026-' + String(n + 5).padStart(2, '0') + '-05',
      status,
    });
  const labels = (tree: ReactTestRenderer) =>
    tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));

  it('folds the paid EMIs into one line, so the next EMI is in view, and shows them on tap', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <LoanSchedule schedule={[emi(1, 'paid'), emi(2, 'paid'), emi(3, 'pending'), emi(4, 'pending')]} />
      );
    });
    expect(labels(tree)).toContain('2 paid · Show');
    expect(labels(tree).some((t) => t.startsWith('#3 '))).toBe(true);
    expect(labels(tree).some((t) => t.startsWith('#1 '))).toBe(false);
    act(() => {
      tree.root
        .find(
          (n) =>
            typeof n.props.onPress === 'function' &&
            n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === '2 paid · Show')
        )
        .props.onPress();
    });
    expect(labels(tree).some((t) => t.startsWith('#1 '))).toBe(true);
    expect(labels(tree)).not.toContain('2 paid · Show');
    act(() => tree.unmount());
  });

  it('shows every EMI of a year that is all paid, with no fold', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(<LoanSchedule schedule={[emi(1, 'paid'), emi(2, 'paid')]} />);
    });
    expect(labels(tree).some((t) => t.includes('Show'))).toBe(false);
    expect(labels(tree).filter((t) => t.startsWith('#'))).toHaveLength(2);
    act(() => tree.unmount());
  });
});
