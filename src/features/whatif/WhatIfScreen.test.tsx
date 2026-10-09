/**
 * What-if: pick a category and a cut, see the month now and with the cut, and how much sooner a goal lands
 * (two pace lines). Sensitive categories hide their amounts. Made-up figures.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
let mockSensitive = false;
jest.mock('@/db/reports', () => ({
  getCategoryMonthlyAverages: async () => [
    { categoryId: 'food', name: 'Food', color: '#FFA8CE', totalMinor: 1200000, isSensitive: mockSensitive },
    { categoryId: 'fun', name: 'Fun', color: '#8FE8C8', totalMinor: 300000, isSensitive: false },
  ],
}));
let mockGoals: unknown[] = [];
jest.mock('@/db/savingsGoals', () => ({ listSavingsGoals: async () => mockGoals }));
jest.mock('@/db/ledger', () => ({ getAccountMonthlyGrowth: async () => 0 }));

import WhatIfScreen from '../../../app/whatif';
import { router } from 'expo-router';

jest.useFakeTimers();

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<WhatIfScreen />);
  });
  await act(async () => {});
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const press = (tree: ReactTestRenderer, label: string) =>
  act(() => {
    tree.root
      .findAll(
        (n) =>
          n.props.onPress &&
          (n.props.accessibilityLabel === label || texts({ root: n } as never).includes(label))
      )[0]
      .props.onPress();
  });

// A goal made a year ago with ₹10,000 of ₹1,00,000: about ₹833 a month, so a ₹2,400 extra lands it much sooner.
const goal = {
  id: 'g1',
  name: 'Goa trip',
  targetAmountMinor: 10000000,
  currentAmountMinor: 1000000,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2025-10-09 10:00:00',
};

beforeAll(async () => {
  await render();
}, 180000);

describe('What-if', () => {
  beforeEach(() => {
    mockGoals = [goal];
    mockHide = false;
    mockSensitive = false;
  });

  it('shows the month now and with the default 20% cut', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['Now, a month', 'New monthly spend', '₹12,000', '₹9,600']));
  });

  it('updates the figures when you pick another cut or category', async () => {
    const tree = await render();
    press(tree, '-50%');
    expect(texts(tree)).toContain('₹6,000');
    press(tree, 'Fun');
    expect(texts(tree)).toEqual(expect.arrayContaining(['₹3,000', '₹1,500']));
  });

  it('draws the current pace and the new one, and says how much sooner', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['Current pace', 'With this change']));
    expect(shown.some((t) => /(weeks?|days?) sooner$/.test(t))).toBe(true);
  });

  it('points to Savings goals when there is no open goal', async () => {
    mockGoals = [];
    const tree = await render();
    expect(texts(tree)).toContain('No open savings goals');
    press(tree, 'Set a savings goal');
    expect(router.push).toHaveBeenLastCalledWith('/savings-goals');
  });

  it('hides a sensitive category’s amounts while amounts are hidden', async () => {
    mockSensitive = true;
    mockHide = true;
    const shown = texts(await render());
    expect(shown).not.toContain('₹12,000');
    expect(shown).not.toContain('₹9,600');
  });
});
