/** Home's Accounts card: money in hand, a chip per account with its type, and adding the first one. */
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

  it('totals only everyday accounts in the default currency and masks savings', () => {
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
    expect(all).toEqual(
      expect.arrayContaining(['Bank, cash & wallets only · INR', 'SBI', 'Cash', 'Wise', 'Card', 'Pot'])
    );
    expect(all).toContain('₹10,500');
    expect(all.join(' ')).toContain('$50');
    expect(all.join(' ')).not.toContain('99,000');
  });

  it('says what kind each account is', () => {
    const all = texts(render({ accounts: [account('HDFC', 'credit_card', -400_000)] }));
    expect(all.some((text) => text.includes('credit card'))).toBe(true);
    expect(all).not.toContain('Bank, cash & wallets only');
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

it('keeps zero-balance accounts visible and reachable', () => {
  const open = jest.fn();
  const tree = render({ accounts: [account('Cash', 'cash', 0)], onOpenAccount: open });
  act(() =>
    tree.root
      .find((n) => n.props.accessibilityLabel === 'Cash, cash. Open summary' && n.props.onPress)
      .props.onPress()
  );
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'Cash' }));
});

it.each([
  { width: 320, fontScale: 1 },
  { width: 390, fontScale: 1.5 },
])('stacks account tiles at $width / $fontScale', (size) => {
  const dimensions = jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ ...size, height: 800, scale: 3 });
  try {
    const tree = render({ accounts: [account('Long account name', 'bank', 100)] });
    const tile = tree.root.find(
      (n) => n.props.accessibilityLabel === 'Long account name, bank. Open summary' && n.props.onPress
    );
    const style =
      typeof tile.props.style === 'function' ? tile.props.style({ pressed: false }) : tile.props.style;
    expect(StyleSheet.flatten(style).flexBasis).toBe('100%');
  } finally {
    dimensions.mockRestore();
  }
});

describe('Home accounts, grouped', () => {
  const mixed = [
    account('SBI', 'bank', 54_500),
    account('Cash', 'cash', 56_000),
    account('Pot', 'savings', 20_000_000),
    account('Gr', 'savings', 4_050_000),
  ];
  afterEach(() => {
    mockHideAmounts = true;
  });

  it('labels what is in hand, and splits everyday accounts from savings with a heading each', () => {
    const all = texts(render({ accounts: mixed }));
    expect(all).toEqual(expect.arrayContaining(['In hand now', 'Everyday', 'Savings']));
    expect(all).toContain('₹1,105');
  });

  it('gives savings a subtotal, masked like each savings account while amounts are hidden', () => {
    mockHideAmounts = false;
    expect(texts(render({ accounts: mixed }))).toContain('₹2,40,500');
    mockHideAmounts = true;
    const hidden = texts(render({ accounts: mixed })).join(' ');
    expect(hidden).not.toContain('2,40,500');
    expect(hidden).not.toContain('2,00,000');
  });

  it('leaves the subtotal out when savings are in more than one currency', () => {
    mockHideAmounts = false;
    const all = texts(render({ accounts: [...mixed, account('Wise', 'savings', 5_000, 'USD')] }));
    expect(all).toEqual(expect.arrayContaining(['Everyday', 'Savings']));
    expect(all).not.toContain('₹2,40,500');
  });

  it('has no headings when there is only one kind of account', () => {
    for (const accounts of [mixed.slice(0, 2), mixed.slice(2)]) {
      const all = texts(render({ accounts }));
      expect(all).not.toContain('Everyday');
      expect(all).not.toContain('Savings');
    }
  });

  it('puts the tiles in two even columns, one column when the screen is narrow', () => {
    const tile = (tree: ReactTestRenderer) => {
      const t = tree.root.find(
        (n) => n.props.accessibilityLabel === 'SBI, bank. Open summary' && n.props.onPress
      );
      return StyleSheet.flatten(
        typeof t.props.style === 'function' ? t.props.style({ pressed: false }) : t.props.style
      );
    };
    // The test environment's own screen has a 2x font scale, which stacks; a normal phone does not.
    const screen = (width: number, fontScale: number) =>
      jest
        .spyOn(require('react-native'), 'useWindowDimensions')
        .mockReturnValue({ width, fontScale, height: 800, scale: 3 });
    let dimensions = screen(390, 1);
    try {
      expect(tile(render({ accounts: mixed })).width).toBe('48.5%');
      dimensions.mockRestore();
      dimensions = screen(320, 1);
      expect(tile(render({ accounts: mixed })).flexBasis).toBe('100%');
    } finally {
      dimensions.mockRestore();
    }
  });

  it('announces the two group names as headings', () => {
    const headings = render({ accounts: mixed })
      .root.findAllByType(Text)
      .filter((t) => t.props.accessibilityRole === 'header')
      .map((t) => String(t.props.children).trim());
    expect(headings).toEqual(['Everyday', 'Savings']);
  });

  it('keeps each account reachable with its full description', () => {
    const open = jest.fn();
    const r = render({ accounts: mixed, onOpenAccount: open });
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'Pot, savings. Open summary' && n.props.onPress)
        .props.onPress()
    );
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'Pot' }));
  });

  it('does not repeat "savings" on tiles that are already under the Savings heading', () => {
    mockHideAmounts = false;
    const sub = texts(render({ accounts: mixed })).filter((t) => t.includes('·'));
    expect(sub.some((t) => t.toLowerCase().includes('savings'))).toBe(false);
  });
});
