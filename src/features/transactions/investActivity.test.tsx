/** Activity and investments: the Invest chip, how invested money and value updates read on a day. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHide, toggleHideAmounts: jest.fn() }),
}));
jest.useFakeTimers();

import { TimelineDay } from './TimelineDay';
import { filterActivity, groupWithNotes, type ValueNote } from './transactions.helpers';
import type { Category, Transaction } from '@/types';
import { dayMonth } from '@/lib/dateLabels';

const DATE = '2026-10-05';
const tx = (id: string, over: Partial<Transaction>): Transaction => ({
  id,
  type: 'transfer',
  accountId: 'bank',
  toAccountId: 'fund',
  categoryId: null,
  amountMinor: 1_000_000,
  date: DATE,
  note: '',
  paymentMode: null,
  loanPaymentId: null,
  splitId: null,
  isRefund: false,
  ruleId: null,
  createdAt: `${DATE}T10:00:00.000Z`,
  ...over,
});
const names: Record<string, string> = { bank: 'HDFC', fund: 'Nifty 50', gold: 'Gold', cash: 'Cash' };
const investmentIds = new Set(['fund', 'gold']);
const categories: Category[] = [];

const expense = tx('e', { type: 'expense', toAccountId: null, categoryId: 'food', amountMinor: 4200 });
const sip = tx('sip', { ruleId: 'r1' });
const lump = tx('lump', { date: '2026-10-02', amountMinor: 500_000 });
const out = tx('out', { accountId: 'gold', toAccountId: 'bank', date: '2026-10-01' });
const plain = tx('plain', { accountId: 'bank', toAccountId: 'cash', date: '2026-10-03' });
const all = [expense, sip, lump, out, plain];
const f = (type: 'all' | 'invest' | 'transfer' | 'expense') =>
  filterActivity(all, { type, categoryIds: [], accountIds: [] }, categories, investmentIds).map((t) => t.id);

describe('the Invest chip', () => {
  it('shows only money moved into or out of an investment', () => {
    expect(f('invest')).toEqual(['sip', 'lump', 'out']);
  });
  it('leaves those out of Transfers, which keeps the ordinary transfers', () => {
    expect(f('transfer')).toEqual(['plain']);
  });
  it('still counts them all under All and does not touch Spent', () => {
    expect(f('all')).toHaveLength(5);
    expect(f('expense')).toEqual(['e']);
  });
  it('treats every transfer as ordinary when there are no investments', () => {
    expect(
      filterActivity(all, { type: 'transfer', categoryIds: [], accountIds: [] }, categories).map((t) => t.id)
    ).toEqual(['sip', 'lump', 'out', 'plain']);
  });
  it('still narrows by account within Invest', () => {
    expect(
      filterActivity(
        all,
        { type: 'invest', categoryIds: [], accountIds: ['gold'] },
        categories,
        investmentIds
      ).map((t) => t.id)
    ).toEqual(['out']);
  });
});

describe('days that have only a value update', () => {
  const note = (id: string, date: string): ValueNote => ({
    id,
    accountId: 'fund',
    date,
    valueMinor: 438000_00,
    previousMinor: 433600_00,
    previousDate: '2026-09-12',
  });
  it('are added to the list, newest first, beside days with entries', () => {
    const days = groupWithNotes(
      [
        { date: '2026-10-05', items: [sip] },
        { date: '2026-10-01', items: [out] },
      ],
      [note('n1', '2026-10-24'), note('n2', '2026-10-05')]
    );
    expect(days.map((d) => d.date)).toEqual(['2026-10-24', '2026-10-05', '2026-10-01']);
    expect(days[0]).toMatchObject({ items: [], notes: [{ id: 'n1' }] });
    expect(days[1].items).toEqual([sip]);
    expect(days[1].notes.map((n) => n.id)).toEqual(['n2']);
  });
});

function render(props: Partial<React.ComponentProps<typeof TimelineDay>> & { items: Transaction[] }) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <TimelineDay
        date={DATE}
        label="Mon"
        dateLabel="5 Oct"
        categories={categories}
        accountName={(id) => names[id] ?? id}
        categoryName={() => 'Food'}
        accountCurrency={() => 'INR'}
        onPressTx={jest.fn()}
        openStacks={new Set()}
        onToggleStack={jest.fn()}
        investmentIds={investmentIds}
        savingsAccountIds={investmentIds}
        {...props}
      />
    );
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

describe('a day with investing on it', () => {
  beforeEach(() => {
    mockHide = false;
  });

  it('reads a SIP as Invested in, with SIP and where it came from, never as a plain transfer', () => {
    const shown = texts(render({ items: [sip] }));
    expect(shown).toContain('Invested in Nifty 50');
    expect(shown).toContain('SIP · from HDFC');
    expect(shown.join(' ')).not.toContain('→');
  });

  it('reads a withdrawal, and leaves an ordinary transfer as it was', () => {
    const shown = texts(render({ items: [tx('w', { accountId: 'gold', toAccountId: 'bank' }), plain] }));
    expect(shown).toContain('Withdrawn from Gold');
    expect(shown).toContain('HDFC → Cash');
  });

  it('keeps invested money out of the day total', () => {
    const shown = texts(
      render({
        items: [
          expense,
          sip,
          tx('x', { type: 'expense', toAccountId: null, categoryId: 'food', amountMinor: 1000 }),
        ],
      })
    ).join(' ');
    // 4,200 + 1,000 minor units is ₹52 spent; the ₹10,000 invested is not part of the day's total.
    expect(shown).toContain('−₹52');
    expect(shown).not.toContain('−₹10,0');
  });

  it('masks the amount while savings are hidden, as it did as a transfer', () => {
    mockHide = true;
    const shown = texts(render({ items: [sip] }));
    expect(shown.join(' ')).not.toContain('10,000');
    expect(shown.join(' ')).toContain('••••');
  });

  it('lists a value update as a quiet line with the change since last time', () => {
    const note: ValueNote = {
      id: 'n',
      accountId: 'fund',
      date: DATE,
      valueMinor: 438_000_00,
      previousMinor: 433_600_00,
      previousDate: '2026-09-12',
    };
    const shown = texts(render({ items: [], notes: [note] }));
    expect(shown.some((t) => t.startsWith('Nifty 50 now worth'))).toBe(true);
    expect(
      shown.some((t) => t.startsWith('Value update · +') && t.includes(`since ${dayMonth('2026-09-12')}`))
    ).toBe(true);
  });

  it('hides a value update’s figures while savings are hidden', () => {
    mockHide = true;
    const note: ValueNote = {
      id: 'n',
      accountId: 'fund',
      date: DATE,
      valueMinor: 438_000_00,
      previousMinor: 1,
      previousDate: '2026-09-12',
    };
    const shown = texts(render({ items: [], notes: [note] })).join(' ');
    expect(shown).not.toContain('4,38,000');
    expect(shown).not.toContain('since');
  });
});

describe('a value update line', () => {
  it('opens the investments when tapped, and is plain text when nothing handles it', () => {
    const note: ValueNote = {
      id: 'n',
      accountId: 'fund',
      date: DATE,
      valueMinor: 100,
      previousMinor: null,
      previousDate: null,
    };
    const press = jest.fn();
    const live = render({ items: [], notes: [note], onPressNote: press });
    act(() => live.root.find((n) => n.props.accessibilityRole === 'button').props.onPress());
    expect(press).toHaveBeenCalledWith(note);
    const quiet = render({ items: [], notes: [note] });
    expect(quiet.root.findAll((n) => n.props.accessibilityRole === 'button')).toHaveLength(0);
  });
});
