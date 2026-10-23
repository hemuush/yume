/**
 * A Home recent row never says its category twice: with a note the note leads and the category sits under it;
 * otherwise the category leads with the account under it. The day always ends the line. Figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/components/JustAddedGlow', () => ({ JustAddedGlow: () => null }));

import { RecentTransactionRow } from './RecentTransactionRow';
import { Category, Transaction } from '@/types';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';

const food = { id: 'food', name: 'Food & Dining', icon: 'food', color: '#FF9E7D' } as Category;
const today = toLocalIsoDate(new Date());
const tx = (note: string, date = today): Transaction => ({
  id: 't1',
  type: 'expense',
  accountId: 'sbi',
  toAccountId: null,
  categoryId: 'food',
  amountMinor: 15000,
  date,
  note,
  paymentMode: null,
  loanPaymentId: null,
  splitId: null,
  isRefund: false,
  createdAt: '2026-09-27T10:00:00.000Z',
});

function texts(note: string, date?: string, parentName?: string, omitToday = false, omitCategory = false) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <RecentTransactionRow
        tx={tx(note, date)}
        category={food}
        accountName="SBI"
        toAccountName={undefined}
        divider={false}
        parentName={parentName}
        omitToday={omitToday}
        omitCategory={omitCategory}
      />
    );
  });
  return r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string' || typeof c === 'number')
      .join('')
  );
}

describe('RecentTransactionRow', () => {
  it('shows only the account and day under the category when there is no note', () => {
    const all = texts('');
    expect(all).toContain('Food & Dining');
    expect(all).toContain('SBI · Today');
    expect(all).not.toContain('Food & Dining · SBI · Today');
  });

  it('puts the category under a note', () => {
    expect(texts('Lunch')).toEqual(expect.arrayContaining(['Lunch', 'Food & Dining · SBI · Today']));
  });

  it('leaves today out when asked (Home), and still names other days', () => {
    expect(texts('', today, undefined, true)).toContain('SBI');
    expect(texts('', addDaysToIsoDate(today, -1), undefined, true)).toContain('SBI · Yesterday');
  });

  it('says Yesterday for the day before', () => {
    expect(texts('', addDaysToIsoDate(today, -1))).toContain('SBI · Yesterday');
  });

  it('names the parent of a subcategory, as a path under a note and directly without one', () => {
    expect(texts('', undefined, 'Groceries')).toContain('Groceries · SBI · Today');
    expect(texts('Lunch', undefined, 'Groceries')).toContain('Groceries › Food & Dining · SBI · Today');
  });

  it('leaves the category out of the sub line when the screen is already that category', () => {
    const labelled = texts('Bistro', undefined, undefined, false, true);
    expect(labelled).toContain('Bistro');
    expect(labelled).toContain('SBI · Today');
    expect(labelled.join(' ')).not.toContain('Food & Dining');
    const bare = texts('', undefined, 'Dining', false, true);
    expect(bare).toContain('Food & Dining');
    expect(bare).toContain('SBI · Today');
    expect(bare.join(' ')).not.toContain('Dining ·');
  });
});
