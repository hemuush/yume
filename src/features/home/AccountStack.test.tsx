/**
 * Home's account stack: one card per account, back to front as savings, banks, cards, wallets, cash.
 * Checks what is on screen, the order and what a tap does (nothing animates). All figures are made up.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import type { Account } from '@/types';

let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHide, toggleHideAmounts: jest.fn() }),
}));

import { AccountStack } from './AccountStack';
import { STACK, stackHeight } from './stackLayout';

afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));
beforeEach(() => {
  mockHide = false;
});

const account = (id: string, type: Account['type'] = 'bank', over: Partial<Account> = {}): Account => ({
  id,
  name: `Account ${id}`,
  type,
  currency: 'INR',
  openingBalanceMinor: 0,
  currentBalanceMinor: 123400,
  creditLimitMinor: null,
  statementDay: null,
  dueDay: null,
  interestRateAnnualBp: null,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

async function render(list: Account[], onOpen = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AccountStack accounts={list} onOpen={onOpen} />);
  });
  return { tree, onOpen };
}

const flat = (node: ReactTestInstance | string): string =>
  typeof node === 'string' ? node : node.children.map((c) => flat(c as ReactTestInstance | string)).join('');

const cards = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (n) =>
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith('account-card-') &&
      typeof n.type === 'string'
  );
/** The ids in drawing order: the first is at the back, the last is the front card. */
const order = (tree: ReactTestRenderer) =>
  cards(tree).map((n) => n.props.testID.replace('account-card-', ''));
const card = (tree: ReactTestRenderer, id: string) =>
  tree.root.find((n) => n.props.testID === `account-card-${id}` && typeof n.type === 'string');
const button = (tree: ReactTestRenderer, id: string) =>
  card(tree, id).find((n) => n.props.accessibilityRole === 'button');

describe('AccountStack', () => {
  it('draws savings at the back and cash in front, banks between', async () => {
    const { tree } = await render([
      account('cash', 'cash'),
      account('bank', 'bank'),
      account('sav', 'savings'),
      account('upi', 'wallet'),
      account('card', 'credit_card'),
    ]);
    expect(order(tree)).toEqual(['sav', 'bank', 'card', 'upi', 'cash']);
  });

  it('keeps accounts of one kind in the order they came in', async () => {
    const { tree } = await render([
      account('b2', 'bank'),
      account('s2', 'savings'),
      account('b1', 'bank'),
      account('s1', 'savings'),
    ]);
    expect(order(tree)).toEqual(['s2', 's1', 'b2', 'b1']);
  });

  it('shows every account, with no cap and no pager dots', async () => {
    const list = Array.from({ length: 10 }, (_, i) => account(String(i)));
    const { tree } = await render(list);
    expect(cards(tree)).toHaveLength(10);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Account 3 of 10')).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.testID === 'account-stack-dots')).toHaveLength(0);
  });

  it('puts each card one strip below the one behind it, in a stack as tall as the strips plus the front card', async () => {
    const { tree } = await render([account('a', 'savings'), account('b', 'bank'), account('c', 'cash')]);
    const tops = cards(tree).map((n) => n.props.style.find((s: object) => s && 'top' in s).top);
    expect(tops).toEqual([0, STACK.peek, STACK.peek * 2]);
    const stack = tree.root.find((n) => n.props.testID === 'account-stack' && typeof n.type === 'string');
    const height = (stack.props.style as object[]).find((s) => s && 'height' in s) as { height: number };
    expect(height.height).toBe(stackHeight(3));
  });

  it('shows each card with its name, type and balance', async () => {
    const { tree } = await render([
      account('w', 'wallet', { name: 'UPI wallet', currentBalanceMinor: 250000 }),
    ]);
    const text = flat(card(tree, 'w'));
    expect(text).toContain('UPI wallet');
    expect(text).toContain('wallet');
    expect(text).toContain('2,500');
  });

  it('opens the account that was tapped, including one behind another', async () => {
    const { tree, onOpen } = await render([
      account('s', 'savings'),
      account('b', 'bank'),
      account('c', 'cash'),
    ]);
    await act(async () => button(tree, 's').props.onPress());
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 's' }));
    await act(async () => button(tree, 'c').props.onPress());
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c' }));
  });

  it('labels each card for a screen reader and offers no swipe action', async () => {
    const { tree } = await render([account('s', 'savings'), account('c', 'cash')]);
    expect(button(tree, 's').props.accessibilityLabel).toBe('Account s, savings. Open summary');
    expect(button(tree, 'c').props.accessibilityLabel).toBe('Account c, cash. Open summary');
    expect(tree.root.findAll((n) => Array.isArray(n.props.accessibilityActions))).toHaveLength(0);
  });

  it('masks a savings balance when amounts are hidden, but not a bank balance', async () => {
    mockHide = true;
    const { tree } = await render([account('s', 'savings'), account('b', 'bank')]);
    expect(flat(card(tree, 's'))).toContain('••••');
    expect(flat(card(tree, 'b'))).toContain('1,234');
  });

  it('shows the gain pill on a tracked account only', async () => {
    const tracked = account('t', 'savings', {
      name: 'Index fund',
      investment: {
        investedMinor: 1000000,
        takenOutMinor: 0,
        gainMinor: 120000,
        valuedAt: '2026-09-30',
        lastValueMinor: 1120000,
      },
    });
    const { tree } = await render([tracked, account('b', 'bank')]);
    expect(flat(card(tree, 't'))).toContain('savings · tracked');
    expect(flat(card(tree, 't'))).toContain('+');
    expect(flat(card(tree, 'b'))).not.toContain('+');
  });

  it('renders an empty stack without crashing', async () => {
    const { tree } = await render([]);
    expect(cards(tree)).toHaveLength(0);
  });
});
