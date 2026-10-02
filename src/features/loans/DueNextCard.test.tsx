/**
 * "Due next" lists every open loan's next EMI soonest first, with a Pay pill
 * (Received for money lent) that is a separate tap target from the row.
 * All figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { DueNextCard, dueNextItems } from './DueNextCard';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import type { Loan } from '@/types';
import type { LoanProgress } from '@/db/loans';

const today = toLocalIsoDate(new Date());
const inDays = (n: number) => addDaysToIsoDate(today, n);

const loan = (id: string, over: Partial<Loan> = {}): Loan => ({
  id,
  direction: 'borrowed',
  counterparty: `Loan ${id}`,
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
  nextDueDate: inDays(10),
  assetLabel: null,
  assetValueMinor: null,
  ...over,
});

const prog = (loanId: string, nextDueDate: string | null, nextEmiMinor: number | null): LoanProgress => ({
  loanId,
  paidCount: 1,
  totalCount: 36,
  nextDueDate,
  nextEmiMinor,
  lastDueDate: '2029-04-05',
  pendingInterestMinor: 0,
});

describe('dueNextItems', () => {
  it('sorts by next due date, uses the progress row first, and skips closed loans and loans with no EMI left', () => {
    const a = loan('a');
    const b = loan('b');
    const c = loan('c', { status: 'closed' });
    const d = loan('d', { nextDueDate: null });
    const items = dueNextItems([a, b, c, d], {
      a: prog('a', inDays(6), 111100),
      b: prog('b', inDays(2), 222200),
      c: prog('c', inDays(1), 333300),
      d: prog('d', null, null),
    });
    expect(items.map((i) => i.loan.id)).toEqual(['b', 'a']);
    expect(items[0].emiMinor).toBe(222200);
  });

  it("falls back to the loan's own next date and EMI without a progress row", () => {
    const items = dueNextItems([loan('a', { nextDueDate: inDays(4) })], {});
    expect(items).toEqual([expect.objectContaining({ dueDate: inDays(4), emiMinor: 180700 })]);
  });
});

function render(items: ReturnType<typeof dueNextItems>, onOpen = jest.fn(), onPay = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<DueNextCard items={items} onOpen={onOpen} onPay={onPay} />);
  });
  const text = r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' | ');
  return { r, text, onOpen, onPay };
}

describe('DueNextCard', () => {
  it('renders nothing when there is nothing due', () => {
    const { r } = render([]);
    expect(r.toJSON()).toBeNull();
  });

  it('shows each loan with its due phrase and a Pay pill; money lent says Received', () => {
    const items = dueNextItems(
      [loan('a', { nextDueDate: inDays(2) }), loan('b', { direction: 'lent', nextDueDate: inDays(8) })],
      {}
    );
    const { text } = render(items);
    expect(text).toContain('Due next');
    expect(text).toContain('Loan a');
    expect(text).toContain('Due in 2 days');
    expect(text).toContain('Pay');
    expect(text).toContain('Received');
  });

  it('opens the pay sheet from the pill without opening the loan, and opens the loan from the row', () => {
    const items = dueNextItems([loan('a')], {});
    const { r, onOpen, onPay } = render(items);
    const pill = r.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Pay next EMI') &&
        typeof n.props.onPress === 'function'
    );
    act(() => pill.props.onPress());
    expect(onPay).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(onOpen).not.toHaveBeenCalled();
    const row = r.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Loan a,')
    );
    act(() => row.props.onPress());
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });
});
