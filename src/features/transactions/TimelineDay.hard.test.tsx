/** One Activity day with extreme data: 1000 entries, 12-digit and paise amounts, long, emoji and RTL names. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.useFakeTimers();

import { createStackStore } from './stackStore';
import { TimelineDay } from './TimelineDay';
import type { Category, Transaction } from '@/types';
import { formatMoneyExact } from '@/lib/money';

const DATE = '2026-09-25';
const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
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
});
const cats = (name: string) => [{ id: 'food', name, icon: 'food', color: '#FF9E7D' }] as Category[];

function render(items: Transaction[], name = 'Food', accountName = 'Bank') {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <TimelineDay
        date={DATE}
        label="Today"
        dateLabel="25 Sept"
        items={items}
        categories={cats(name)}
        accountName={() => accountName}
        categoryName={() => name}
        onPressTx={jest.fn()}
        stacks={createStackStore()}
      />
    );
  });
  return r;
}
const all = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      [t.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' | ');

it('renders an empty day', () => {
  expect(() => render([])).not.toThrow();
});

it('renders 1000 entries in one day and still shows the day total', () => {
  const r = render(Array.from({ length: 1000 }, (_, i) => tx(`t${i}`, { amountMinor: 100 })));
  expect(all(r)).toContain(formatMoneyExact(100_000));
});

it('shows paise and 12-digit amounts as typed', () => {
  const r = render([
    tx('a', { amountMinor: 4444 }),
    tx('b', { amountMinor: 99_999_999_999_99, categoryId: null }),
  ]);
  expect(all(r)).toContain('₹44.44');
  expect(all(r)).toContain('₹99,99,99,99,999.99');
});

it.each([
  ['200 characters', 'N'.repeat(200)],
  ['emoji', '🍔🍟👨‍👩‍👧‍👦'],
  ['RTL text', 'طعام وشراب שלום'],
])('renders category, account and note with %s', (_n, name) => {
  const r = render([tx('a', { note: name })], name, name);
  expect(all(r)).toContain(name);
});
