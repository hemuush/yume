/**
 * Activity's timeline day: transfers become notes, repeats of a category
 * stack in the place of the newest of them, and nothing is lost or counted twice.
 */
import { buildDayLane } from './transactions.helpers';
import { Transaction } from '@/types';

const tx = (id: string, over: Partial<Transaction>): Transaction =>
  ({
    id,
    type: 'expense',
    accountId: 'sbi',
    toAccountId: null,
    categoryId: 'food',
    amountMinor: 10000,
    date: '2026-09-25',
    note: '',
    paymentMode: null,
    loanPaymentId: null,
    splitId: null,
    isRefund: false,
    loanId: null,
    createdAt: '',
    ...over,
  }) as Transaction;

describe('buildDayLane', () => {
  const day = [
    tx('a', { amountMinor: 18400 }),
    tx('b', {
      type: 'transfer',
      categoryId: null,
      accountId: 'hdfc',
      toAccountId: 'sbi',
      amountMinor: 300000,
    }),
    tx('c', { categoryId: 'rapido', amountMinor: 4200 }),
    tx('d', { amountMinor: 4400 }),
    tx('e', { categoryId: 'health', amountMinor: 27600, note: 'Medicine' }),
    tx('f', { categoryId: 'rapido', amountMinor: 3400 }),
    tx('g', { type: 'income', categoryId: 'food', amountMinor: 5000 }),
  ];
  const { transfers, lines } = buildDayLane(day, '2026-09-25');

  it('takes transfers out as notes', () => {
    expect(transfers.map((t) => t.id)).toEqual(['b']);
  });

  it('stacks repeats of a category where the newest of them was, and keeps the rest as lines', () => {
    expect(
      lines.map((l) =>
        l.kind === 'single'
          ? l.tx.id
          : l.kind === 'stack'
            ? `${l.categoryId}×${l.items.length}=${l.totalMinor}`
            : l.splitId
      )
    ).toEqual(['food×2=22800', 'rapido×2=7600', 'e', 'g']);
  });

  it('never stacks spending with income of the same category', () => {
    expect(lines.find((l) => l.kind === 'single' && l.tx.id === 'g')).toBeTruthy();
  });

  it('keeps every entry exactly once', () => {
    const ids = [
      ...transfers.map((t) => t.id),
      ...lines.flatMap((l) => (l.kind === 'single' ? [l.tx.id] : l.items.map((t) => t.id))),
    ].sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  describe('split payments', () => {
    const splitDay = [
      tx('p1', { categoryId: 'groceries', amountMinor: 120000, splitId: 's1', note: 'DMart' }),
      tx('x', { categoryId: 'groceries', amountMinor: 5000 }),
      tx('p2', { categoryId: 'household', amountMinor: 65000, splitId: 's1', note: 'DMart' }),
      tx('y', { categoryId: 'groceries', amountMinor: 7000 }),
    ];

    it('shows a split as one line, biggest part first, and never stacks its parts by category', () => {
      const { lines: l } = buildDayLane(splitDay, '2026-09-27');
      const split = l.find((x) => x.kind === 'split');
      expect(split).toMatchObject({ splitId: 's1', totalMinor: 185000 });
      expect(split && split.kind === 'split' ? split.items.map((t) => t.id) : []).toEqual(['p1', 'p2']);
      const stack = l.find((x) => x.kind === 'stack');
      expect(stack && stack.kind === 'stack' ? stack.items.map((t) => t.id) : []).toEqual(['x', 'y']);
    });

    it('shows a lone part (after a category filter) as a plain line', () => {
      const { lines: l } = buildDayLane([splitDay[0]], '2026-09-27');
      expect(l).toEqual([{ kind: 'single', tx: splitDay[0] }]);
    });
  });
});
