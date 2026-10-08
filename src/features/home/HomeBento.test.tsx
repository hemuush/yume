/** Home's bento tiles: the next thing due, budgets on track, and the accounts. Figures are made up. */
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

import { HomeBento } from './HomeBento';
import type { Account } from '@/types';
import type { BudgetProgress } from '@/db/budgets';

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join('')
  );

const account = (id: string, type: Account['type'], balance: number): Account =>
  ({ id, name: id, type, currency: 'INR', currentBalanceMinor: balance }) as Account;
const budget = (id: string, percentUsed: number): BudgetProgress =>
  ({ budget: { id }, percentUsed, overBudget: percentUsed > 100 }) as unknown as BudgetProgress;

function render(over: Partial<React.ComponentProps<typeof HomeBento>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <HomeBento
        upcoming={{ items: [], next: null }}
        budgets={[]}
        accounts={[]}
        currency="INR"
        onOpenUpcoming={jest.fn()}
        onOpenBudgets={jest.fn()}
        onOpenAccounts={jest.fn()}
        onOpenAccount={jest.fn()}
        onAddAccount={jest.fn()}
        {...over}
      />
    );
  });
  return r;
}

describe('Home bento', () => {
  it('shows the next thing due with its date as a tag', () => {
    const all = texts(
      render({
        upcoming: {
          items: [
            {
              key: 'loan-1',
              icon: 'calendar',
              iconBg: '#fff',
              title: 'Home loan EMI',
              subtitle: 'Due tomorrow',
              amountMinor: 1_840_000,
              sign: '-',
              sortDate: '2026-10-09',
              route: '/loans',
              urgent: false,
              payable: true,
              pinned: true,
            },
          ],
          next: null,
        },
      })
    );
    expect(all).toEqual(expect.arrayContaining(['₹18,400', 'Home loan EMI', 'Due tomorrow']));
  });

  it('says a quiet week when nothing is due, and offers a budget when there is none', () => {
    const all = texts(render());
    expect(all).toEqual(
      expect.arrayContaining(['All clear', 'Quiet week', 'None yet', 'Set a monthly limit'])
    );
  });

  it('counts budgets on track and flags the ones over or close', () => {
    expect(texts(render({ budgets: [budget('a', 40), budget('b', 120), budget('c', 85)] }))).toEqual(
      expect.arrayContaining(['2 of 3', 'on track', '1 over'])
    );
    expect(texts(render({ budgets: [budget('a', 40), budget('c', 85)] }))).toContain('1 close');
    expect(texts(render({ budgets: [budget('a', 40)] }))).toContain('All good');
  });

  it('counts money in hand in the default currency only, and shows no figure without any', () => {
    const usd = { ...account('Wise', 'wallet', 5_000), currency: 'USD' } as Account;
    const all = texts(render({ accounts: [account('SBI', 'bank', 1_000_000), usd] }));
    expect(all).toContain('₹10,000');
    expect(texts(render({ accounts: [account('Card', 'credit_card', -400_000)] }))).not.toContain(
      'In bank, cash and wallets'
    );
  });

  it('lets each account chip be reached on its own, and the heading open the list', () => {
    const onOpenAccount = jest.fn();
    const onOpenAccounts = jest.fn();
    const r = render({ accounts: [account('SBI', 'bank', 100)], onOpenAccount, onOpenAccounts });
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'SBI. Open summary' && n.props.onPress)
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

  it('adds up money in hand without savings or cards, and masks savings when amounts are hidden', () => {
    const all = texts(
      render({
        accounts: [
          account('SBI', 'bank', 1_000_000),
          account('Cash', 'cash', 50_000),
          account('Card', 'credit_card', -400_000),
          account('Pot', 'savings', 9_900_000),
        ],
      })
    );
    expect(all).toEqual(expect.arrayContaining(['₹10,500', 'SBI', 'Pot']));
    expect(all.join(' ')).not.toContain('99,000');
  });
});
