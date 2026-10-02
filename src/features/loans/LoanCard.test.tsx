/**
 * A loan card shows how far along the loan is and, while it is open, the
 * next EMI with a Pay pill; the pill and the card are separate tap targets.
 * A closed loan says "Paid off" and has no pill. All figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/components/GrowFill', () => ({ GrowFill: () => null }));
jest.mock('@/components/CountUpAmount', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  const { formatMoney } = jest.requireActual('@/lib/money');
  return { CountUpAmount: ({ minor }: { minor: number }) => <RNText>{formatMoney(minor)}</RNText> };
});

import { LoanCard } from './LoanCard';
import type { Loan } from '@/types';
import type { LoanProgress } from '@/db/loans';

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  direction: 'borrowed',
  counterparty: 'Sample Bank',
  principalMinor: 10000000,
  interestRateAnnualBp: 900,
  tenureMonths: 36,
  startDate: '2026-01-05',
  emiAmountMinor: 180700,
  outstandingPrincipalMinor: 8900000,
  status: 'active',
  linkedAccountId: null,
  rateType: 'fixed',
  personId: null,
  notes: '',
  createdAt: '2026-01-05T00:00:00.000Z',
  nextDueDate: '2026-10-05',
  assetLabel: null,
  assetValueMinor: null,
  ...over,
});

const progress: LoanProgress = {
  loanId: 'l1',
  paidCount: 5,
  totalCount: 36,
  nextDueDate: '2026-10-05',
  nextEmiMinor: 180700,
  lastDueDate: '2029-04-05',
  pendingInterestMinor: 1146800,
};

function render(l: Loan, p: LoanProgress | undefined, onPress = jest.fn(), onPay = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <LoanCard loan={l} hue="#FBF0CE" progress={p} fadeStyle={{}} onPress={onPress} onPay={onPay} />
    );
  });
  const text = r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' | ');
  return { r, text, onPress, onPay };
}

describe('LoanCard', () => {
  it('shows EMIs paid, the debt-free month and the next EMI', () => {
    const { text } = render(loan(), progress);
    expect(text).toContain('5 of 36 EMIs');
    expect(text).toContain('Debt-free');
    expect(text).toContain('Next EMI');
    expect(text).toContain('Pay');
  });

  it('opens the pay sheet from the pill without opening the card', () => {
    const { r, onPress, onPay } = render(loan(), progress);
    const pill = r.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Pay next EMI') &&
        typeof n.props.onPress === 'function'
    );
    act(() => pill.props.onPress());
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('says Received on a lent loan', () => {
    const { text } = render(loan({ direction: 'lent' }), progress);
    expect(text).toContain('Received');
    expect(text).toContain('Lent');
  });

  it('shows Paid off and no pill for a closed loan', () => {
    const { text } = render(loan({ status: 'closed', outstandingPrincipalMinor: 0 }), {
      ...progress,
      nextDueDate: null,
      nextEmiMinor: null,
      lastDueDate: null,
    });
    expect(text).toContain('Paid off');
    expect(text).not.toContain('Next EMI');
  });
});
