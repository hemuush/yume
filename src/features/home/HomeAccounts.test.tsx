/** The live Home account grid: order, currency, privacy, navigation and responsive layout. */
import { Text, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// Icons draw nothing here: their font load would update state after each test.
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
let mockHideAmounts = true;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
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
        onOpenAccounts={jest.fn()}
        onOpenAccount={jest.fn()}
        onAddAccount={jest.fn()}
        {...over}
      />
    );
  });
  return r;
}

afterEach(() => {
  mockHideAmounts = true;
});

it('offers a direct action to add the first account', () => {
  const add = jest.fn();
  const tree = render({ onAddAccount: add });
  expect(texts(tree)).toContain('A fresh start');
  act(() =>
    tree.root.find((n) => n.props.onPress && n.props.accessibilityLabel === 'Add an account').props.onPress()
  );
  expect(add).toHaveBeenCalledTimes(1);
});

it('keeps per-account currencies without inventing a combined total, and skips accounts with no balance', () => {
  mockHideAmounts = false;
  const tree = render({
    accounts: [
      account('Empty', 'bank', 0),
      account('Foreign', 'wallet', 5000, 'USD'),
      account('Pot', 'savings', 999900),
      account('Card', 'credit_card', -2500),
    ],
  });
  const copy = texts(tree).join(' ');
  expect(copy).not.toContain('Empty');
  expect(copy).toContain('$50');
  expect(copy).toContain('₹9,999');
  expect(copy).toContain('Card');
});

it('keeps an account with no balance reachable under View all and still offers Add account', () => {
  const onOpenAccounts = jest.fn();
  const add = jest.fn();
  const tree = render({ accounts: [account('Empty', 'bank', 0)], onOpenAccounts, onAddAccount: add });
  expect(texts(tree)).not.toContain('Empty');
  act(() =>
    tree.root
      .find((n) => n.props.accessibilityLabel === 'View all — Accounts' && n.props.onPress)
      .props.onPress()
  );
  act(() =>
    tree.root.find((n) => n.props.onPress && n.props.accessibilityLabel === 'Add an account').props.onPress()
  );
  expect(onOpenAccounts).toHaveBeenCalledTimes(1);
  expect(add).toHaveBeenCalledTimes(1);
});

it('limits the row to eight accounts while leaving the full list reachable', () => {
  const tree = render({
    accounts: Array.from({ length: 10 }, (_, i) => account(`Bank ${i}`, 'bank', (i + 1) * 100)),
  });
  expect(texts(tree)).toContain('Bank 7');
  expect(texts(tree)).not.toContain('Bank 8');
  expect(
    tree.root.findAll((n) => n.props.onPress && n.props.accessibilityLabel === 'View all — Accounts')
  ).not.toHaveLength(0);
});

it('groups spending and savings previews while keeping the complete account list reachable', () => {
  const onOpenAccounts = jest.fn();
  const tree = render({
    accounts: [
      account('Pot', 'savings', 999900),
      account('SBI', 'bank', 100000),
      account('Cash', 'cash', 20000),
      account('Wise', 'wallet', 10000, 'USD'),
    ],
    onOpenAccounts,
  });
  expect(texts(tree)).toEqual(expect.arrayContaining(['Accounts', 'SBI', 'Cash']));
  expect(texts(tree)).toContain('Pot');
  expect(texts(tree)).toContain('Wise');
  act(() =>
    tree.root
      .find((n) => n.props.accessibilityLabel === 'View all — Accounts' && n.props.onPress)
      .props.onPress()
  );
  expect(onOpenAccounts).toHaveBeenCalledTimes(1);
});
it('masks a savings-only preview and never invents an everyday balance', () => {
  const tree = render({ accounts: [account('Pot', 'savings', 999900)] });
  expect(texts(tree)).toContain('Pot');
  expect(texts(tree).join(' ')).not.toContain('9,999');
});

it.each([
  [320, 1],
  [390, 1],
  [390, 1.5],
])('keeps every account in the row tappable at width %s and text scale %s', (width, fontScale) => {
  const dimensions = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, fontScale, scale: 1 });
  try {
    const open = jest.fn();
    const tree = render({
      accounts: [account('First bank account', 'bank', 100), account('Cash', 'cash', 200)],
      onOpenAccount: open,
    });
    for (const name of ['First bank account', 'Cash'])
      act(() =>
        tree.root
          .find((n) => n.props.onPress && String(n.props.accessibilityLabel).startsWith(`${name},`))
          .props.onPress()
      );
    expect(open.mock.calls.map((call) => call[0].id)).toEqual(['First bank account', 'Cash']);
    act(() => tree.unmount());
  } finally {
    dimensions.mockRestore();
  }
});

it('widens the tiles with the text size so a balance keeps one line', () => {
  const widthOf = (fontScale: number) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 390, height: 800, fontScale, scale: 1 });
    try {
      const tree = render({ accounts: [account('Bank', 'bank', 100)] });
      const tile = tree.root.find(
        (n) => String(n.props.accessibilityLabel).startsWith('Bank,') && n.props.onPress
      );
      const style = StyleSheet.flatten(
        typeof tile.props.style === 'function' ? tile.props.style({ pressed: false }) : tile.props.style
      );
      act(() => tree.unmount());
      return style.width as number;
    } finally {
      dimensions.mockRestore();
    }
  };
  expect(widthOf(1)).toBe(148);
  expect(widthOf(1.5)).toBe(192);
});

it('ends the row with an Add account tile', () => {
  const add = jest.fn();
  const tree = render({ accounts: [account('Bank', 'bank', 100)], onAddAccount: add });
  act(() =>
    tree.root.find((n) => n.props.onPress && n.props.accessibilityLabel === 'Add an account').props.onPress()
  );
  expect(add).toHaveBeenCalledTimes(1);
});
