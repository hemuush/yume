/**
 * A Home recent-activity row never says its category twice: with a note,
 * the note leads and the category sits under it; without one, the category
 * leads and only the account sits under it. All figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/components/JustAddedGlow', () => ({ JustAddedGlow: () => null }));

import { RecentTransactionRow } from './RecentTransactionRow';
import { Category, Transaction } from '@/types';

const food = { id: 'food', name: 'Food & Dining', icon: 'food', color: '#FF9E7D' } as Category;
const tx = (note: string): Transaction => ({
  id: 't1',
  type: 'expense',
  accountId: 'sbi',
  toAccountId: null,
  categoryId: 'food',
  amountMinor: 15000,
  date: '2026-09-27',
  note,
  paymentMode: null,
  loanPaymentId: null,
  splitId: null,
  isRefund: false,
  createdAt: '2026-09-27T10:00:00.000Z',
});

function texts(note: string) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <RecentTransactionRow
        tx={tx(note)}
        category={food}
        accountName="SBI"
        toAccountName={undefined}
        divider={false}
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
  it('shows only the account under the category when there is no note', () => {
    const all = texts('');
    expect(all).toContain('Food & Dining');
    expect(all).toContain('SBI');
    expect(all).not.toContain('Food & Dining · SBI');
  });

  it('puts the category under a note', () => {
    expect(texts('Lunch')).toEqual(expect.arrayContaining(['Lunch', 'Food & Dining · SBI']));
  });
});
