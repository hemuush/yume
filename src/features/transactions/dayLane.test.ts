/**
 * Activity's timeline day: transfers become notes, repeats of a category
 * stack in the place of the newest of them, and nothing is lost or counted twice.
 */
import { buildDayLane, dropIndex, laneOrderIds, moveLine } from './transactions.helpers';
import { Transaction } from '@/types';

it('never stacks face values from different currencies together', () => {
  const items = [
    tx('inr1', {}),
    tx('inr2', {}),
    tx('usd1', { accountId: 'usd' }),
    tx('usd2', { accountId: 'usd' }),
  ];
  const lane = buildDayLane(items, '2026-09-25', (id) => (id === 'usd' ? 'USD' : 'INR'));
  expect(lane.lines).toHaveLength(2);
  expect(lane.lines.map((l) => (l.kind === 'stack' ? l.items.map((t) => t.id) : []))).toEqual([
    ['inr1', 'inr2'],
    ['usd1', 'usd2'],
  ]);
});

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
      lines.map((l) => (l.kind === 'single' ? l.tx.id : `${l.categoryId}×${l.items.length}=${l.totalMinor}`))
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

    it('shows each part as its own plain line, with no split heading, and never stacks a part by category', () => {
      const { lines: l } = buildDayLane(splitDay, '2026-09-27');
      expect(l.map((x) => (x.kind === 'single' ? x.tx.id : `stack:${x.items.map((t) => t.id)}`))).toEqual([
        'p1',
        'stack:x,y',
        'p2',
      ]);
    });
  });

  describe('a day arranged by hand', () => {
    const ranked = [
      tx('c', { categoryId: 'rapido', dayRank: 0 }),
      tx('p1', { categoryId: 'groceries', splitId: 's1', dayRank: 1 }),
      tx('a', { dayRank: 2 }),
      tx('p2', { categoryId: 'household', splitId: 's1', dayRank: 3 }),
      tx('f', { categoryId: 'rapido', dayRank: 4 }),
      tx('t', { type: 'transfer', categoryId: null, toAccountId: 'hdfc', dayRank: 5 }),
    ];
    const name = (l: ReturnType<typeof buildDayLane>['lines'][number]) =>
      l.kind === 'single' ? l.tx.id : l.key.split('|')[2];

    it('keeps each line where it was dragged, split parts and stacks included', () => {
      const { lines } = buildDayLane(ranked, '2026-09-25');
      expect(lines.map(name)).toEqual(['rapido', 'p1', 'a', 'p2']);
    });

    it('lists a moved line as ids top to bottom, with transfers last', () => {
      const { lines, transfers } = buildDayLane(ranked, '2026-09-25');
      expect(laneOrderIds(moveLine(lines, 2, 0), transfers)).toEqual(['a', 'c', 'f', 'p1', 'p2', 't']);
    });

    it('ignores a move that goes nowhere or off the list', () => {
      const { lines } = buildDayLane(ranked, '2026-09-25');
      expect(moveLine(lines, 1, 1)).toBe(lines);
      expect(moveLine(lines, 0, 9)).toBe(lines);
    });
  });

  describe('dropIndex', () => {
    const rows = [52, 52, 104, 52];

    it('stays put for a small drag and follows the finger past the next line', () => {
      expect(dropIndex(rows, 0, 10)).toBe(0);
      expect(dropIndex(rows, 0, 60)).toBe(1);
      expect(dropIndex(rows, 3, -60)).toBe(2);
    });

    it('measures a tall line by its middle and clamps at either end', () => {
      expect(dropIndex(rows, 2, -40)).toBe(2);
      expect(dropIndex(rows, 2, -60)).toBe(1);
      expect(dropIndex(rows, 0, 900)).toBe(3);
      expect(dropIndex(rows, 3, -900)).toBe(0);
    });
  });
});
