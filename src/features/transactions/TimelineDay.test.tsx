/**
 * One day on Activity: its heading says only the day and the date, every
 * entry sits in the day's one card (transfers too, as quiet rows at the
 * end), two or more entries of one category stack into a line that says
 * how many and opens in place, and every entry of the day can still be
 * tapped — nothing hides behind a "+N more".
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { TimelineDay } from './TimelineDay';
import { Category, Transaction } from '@/types';

// Bars, rings and the new-entry glow animate (useGrowFrom, JustAddedGlow); fake
// timers keep those frames inside the test instead of firing after it ends.
jest.useFakeTimers();

const DATE = '2026-09-25';

function tx(id: string, over: Partial<Transaction>): Transaction {
  return {
    id,
    type: 'expense',
    accountId: 'bank',
    toAccountId: null,
    categoryId: 'food',
    amountMinor: 10000,
    date: DATE,
    note: '',
    paymentMode: null,
    loanPaymentId: null,
    splitId: null,
    isRefund: false,
    createdAt: `${DATE}T10:00:00.000Z`,
    ...over,
  };
}

const items = [
  tx('t1', { categoryId: 'food', amountMinor: 12000, note: 'Lunch', createdAt: `${DATE}T13:00:00.000Z` }),
  tx('t2', { type: 'transfer', categoryId: null, toAccountId: 'cash', amountMinor: 300000 }),
  tx('t3', { categoryId: 'travel', amountMinor: 5000 }),
  tx('t4', { categoryId: 'food', amountMinor: 8000, note: 'Tea', createdAt: `${DATE}T09:00:00.000Z` }),
  tx('t5', { type: 'income', categoryId: 'salary', amountMinor: 50000 }),
];

const categories = [
  { id: 'food', name: 'Food', icon: 'food', color: '#FF9E7D' },
  { id: 'travel', name: 'Travel', icon: 'car', color: '#8CCED6' },
  { id: 'salary', name: 'Salary', icon: 'cash', color: '#8FE8C8' },
] as Category[];
const names: Record<string, string> = { food: 'Food', travel: 'Travel', salary: 'Salary' };
const accounts: Record<string, string> = { bank: 'Bank', cash: 'Cash' };

function texts(r: ReactTestRenderer): string[] {
  return r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
}

function byLabel(r: ReactTestRenderer, start: string) {
  // The composite Pressable, not the host views it renders.
  return r.root.findAll(
    (n) =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(start),
    { deep: false }
  );
}

function render(openStacks: Set<string>, onToggleStack = jest.fn(), onPressTx = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <TimelineDay
        date={DATE}
        label="Yesterday"
        dateLabel="25 Sept"
        items={items}
        categories={categories}
        accountName={(id) => accounts[id] ?? id}
        categoryName={(id) => (id ? names[id] : 'Transfer')}
        onPressTx={onPressTx}
        openStacks={openStacks}
        onToggleStack={onToggleStack}
      />
    );
  });
  return r;
}

describe('TimelineDay', () => {
  it('shows the day, its date and net, with the transfer as a row in the card', () => {
    const r = render(new Set());
    const all = texts(r).join('\n');
    expect(all).toContain('25 Sept');
    expect(all).not.toContain('5 entries');
    // Salary +500, minus food 200 and travel 50; the transfer moves nothing.
    expect(all).toContain('+₹250');
    expect(all).toContain('Bank → Cash');
    expect(all).toContain('Moved between your accounts');
    expect(byLabel(r, '₹3,000 moved from Bank to Cash')).toHaveLength(1);
  });

  it('stacks two Food entries into one closed line', () => {
    const toggle = jest.fn();
    const r = render(new Set(), toggle);
    // The count is the stack's second line, with its one account, like a single entry's.
    expect(texts(r)).toContain('2 entries · Bank');
    expect(byLabel(r, 'Food, Lunch')).toHaveLength(0);
    const stack = byLabel(r, 'Food, 2 entries, ₹200');
    expect(stack).toHaveLength(1);
    act(() => stack[0].props.onPress());
    expect(toggle).toHaveBeenCalledWith(`${DATE}|expense|food`);
  });

  it('an open stack lists each entry, and every entry of the day can be tapped', () => {
    const onPress = jest.fn();
    const r = render(new Set([`${DATE}|expense|food`]), jest.fn(), onPress);
    expect(texts(r)).toEqual(expect.arrayContaining(['Lunch', 'Tea']));
    const tappable = [
      ...byLabel(r, 'Food, Lunch'),
      ...byLabel(r, 'Food, Tea'),
      ...byLabel(r, 'Travel,'),
      ...byLabel(r, 'Salary,'),
      ...byLabel(r, '₹3,000 moved'),
    ];
    tappable.forEach((p) => act(() => p.props.onPress()));
    expect(onPress.mock.calls.map(([t]) => t.id).sort()).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });
});
