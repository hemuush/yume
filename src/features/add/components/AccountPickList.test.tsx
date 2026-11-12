/** The account picker names an investment as an investment (not "savings") and gives it the trend icon. */
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { Account } from '@/types';

jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#C9B8FF' }),
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/components/Amount', () => ({ Amount: () => null }));
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('@expo/vector-icons/Feather', () => 'Feather');

import { AccountPickList } from './AccountPickList';

const account = (over: Partial<Account>): Account =>
  ({
    id: 'a',
    name: 'Groww',
    type: 'savings',
    currency: 'INR',
    currentBalanceMinor: 4563900,
    ...over,
  }) as Account;

function render(accounts: Account[]) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<AccountPickList accounts={accounts} activeId={null} onPick={jest.fn()} />);
  });
  return tree;
}
const subs = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .filter((t) => t.includes('·'));
const icons = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => (n.type as unknown) === 'MaterialCommunityIcons').map((n) => n.props.name);

describe('AccountPickList', () => {
  it('names an investment as an investment, with its kind and the trend icon', () => {
    const tree = render([account({ investment: { kind: 'mutual_fund' } as Account['investment'] })]);
    expect(subs(tree)[0]).toMatch(/^investment · mutual fund/);
    expect(icons(tree)).toEqual(['trending-up']);
  });

  it('keeps a plain savings account as savings with the piggy bank', () => {
    const tree = render([account({ name: 'HDFC Savings' })]);
    expect(subs(tree)[0]).toMatch(/^savings/);
    expect(icons(tree)).toEqual(['piggy-bank']);
  });
});
