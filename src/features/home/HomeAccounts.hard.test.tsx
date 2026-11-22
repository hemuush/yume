/** Home’s account grid with extreme data: none, many, paise, negatives, huge amounts, long, emoji and RTL names. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

import { HomeAccounts } from './HomeAccounts';
import type { Account } from '@/types';

const all = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      [t.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string')
        .join('')
    )
    .join(' | ');
const acc = (name: string, balance: number, type: Account['type'] = 'bank', i = 0): Account =>
  ({ id: `a${i}`, name, type, currency: 'INR', currentBalanceMinor: balance }) as Account;

function render(accounts: Account[]) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <HomeAccounts
        accounts={accounts}
        onOpenAccounts={jest.fn()}
        onOpenAccount={jest.fn()}
        onAddAccount={jest.fn()}
      />
    );
  });
  return r;
}

it('renders with no accounts and offers a first one', () => {
  expect(all(render([]))).toContain('A fresh start');
});

it('renders fifty accounts, showing at most eight', () => {
  const r = render(Array.from({ length: 50 }, (_, i) => acc(`Acct${i}x`, 100 + i, 'bank', i)));
  expect(all(r)).toContain('Acct0x');
  expect(all(r)).not.toContain('Acct8x');
});

it('hides an account worth under 50 paise rather than showing ₹0', () => {
  expect(all(render([acc('Dust', 44)]))).not.toContain('Dust');
});

it.each([
  ['paise just over the hide threshold', 4450, '₹45'],
  ['a negative balance', -12_345_67, '-₹12,346'],
  ['a 12-digit amount', 99_999_999_999_99, '₹1,00,00,00,00,000'],
])('shows %s', (_n, minor, expected) => {
  const r = render([acc('Main', minor)]);
  const t = all(r);
  expect(t).toContain('Main');
  expect(t).toContain(expected);
});

it.each([
  ['200 characters', 'N'.repeat(200)],
  ['emoji', '🏦💰👨‍👩‍👧‍👦'],
  ['RTL text', 'حساب البنك שלום'],
])('renders a name with %s', (_n, name) => {
  const r = render([acc(name, 500)]);
  expect(all(r)).toContain(name);
});
