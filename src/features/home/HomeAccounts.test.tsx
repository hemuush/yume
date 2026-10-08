/** Home's Accounts card: money in hand, a chip per account with its type, and adding the first one. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// Icons draw nothing here: their font load would update state after each test.
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: true, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

import { HomeAccounts } from './HomeAccounts';
import type { Account } from '@/types';

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join('')
  );
const account = (id: string, type: Account['type'], balance: number, currency = 'INR'): Account =>
  ({ id, name: id, type, currency, currentBalanceMinor: balance }) as Account;

function render(over: Partial<React.ComponentProps<typeof HomeAccounts>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <HomeAccounts
        accounts={[]}
        currency="INR"
        onOpenAccounts={jest.fn()}
        onOpenAccount={jest.fn()}
        onAddAccount={jest.fn()}
        {...over}
      />
    );
  });
  return r;
}

describe('Home accounts', () => {
  it('offers to add the first account', () => {
    const onAddAccount = jest.fn();
    const r = render({ onAddAccount });
    expect(texts(r)).toEqual(expect.arrayContaining(['Add one', 'A bank account, cash, or a UPI wallet']));
    act(() =>
      r.root.find((n) => n.props.accessibilityLabel === 'Add an account' && n.props.onPress).props.onPress()
    );
    expect(onAddAccount).toHaveBeenCalled();
  });

  it('adds up money in hand in the default currency, leaving savings, cards and other currencies out', () => {
    const all = texts(
      render({
        accounts: [
          account('SBI', 'bank', 1_000_000),
          account('Cash', 'cash', 50_000),
          account('Wise', 'wallet', 5_000, 'USD'),
          account('Card', 'credit_card', -400_000),
          account('Pot', 'savings', 9_900_000),
        ],
      })
    );
    expect(all).toContain('₹10,500');
    expect(all.join(' ')).not.toContain('99,000');
  });

  it('says what kind each account is', () => {
    const all = texts(render({ accounts: [account('HDFC', 'credit_card', -400_000)] }));
    expect(all.some((t) => t.startsWith('credit card · '))).toBe(true);
    expect(all).not.toContain('In bank, cash and wallets');
  });

  it('lets each chip be reached on its own, and the heading open the list', () => {
    const onOpenAccount = jest.fn();
    const onOpenAccounts = jest.fn();
    const r = render({ accounts: [account('SBI', 'bank', 100)], onOpenAccount, onOpenAccounts });
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'SBI, bank. Open summary' && n.props.onPress)
        .props.onPress()
    );
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'Accounts, 1. See all' && n.props.onPress)
        .props.onPress()
    );
    expect(onOpenAccount).toHaveBeenCalled();
    expect(onOpenAccounts).toHaveBeenCalled();
  });
});
