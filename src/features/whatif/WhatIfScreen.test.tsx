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
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
let mockParams: { category?: string; cut?: string } = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
let mockSensitive = false;
let mockExtraCategories = 0;
let mockRent = false;
// Three finished months and the one running: 1,00,000 in and 90,000 out a month.
let mockFlow = [1, 2, 3, 4].map((m) => ({
  label: `m${m}`,
  incomeMinor: 10_000_000,
  expenseMinor: 9_000_000,
  recorded: true,
}));
jest.mock('@/db/reports', () => ({
  getMonthlyCashFlow: async () => mockFlow,
  // Biggest first, as the real query returns them: rent (when a test asks for it) leads.
  getCategoryMonthlyAverages: async () => [
    ...(mockRent
      ? [{ categoryId: 'rent', name: 'Rent', color: '#ccc', totalMinor: 2500000, isSensitive: false }]
      : []),
    ...Array.from({ length: mockExtraCategories }, (_, i) => ({
      categoryId: `x${i}`,
      name: `Extra ${i}`,
      color: '#ccc',
      totalMinor: 100000 - i * 1000,
      isSensitive: false,
    })),
    { categoryId: 'food', name: 'Food', color: '#FFA8CE', totalMinor: 1200000, isSensitive: mockSensitive },
    { categoryId: 'fun', name: 'Fun', color: '#8FE8C8', totalMinor: 300000, isSensitive: false },
  ],
}));
let mockGoals: unknown[] = [];
jest.mock('@/db/savingsGoals', () => ({ listSavingsGoals: async () => mockGoals }));
jest.mock('@/db/ledger', () => ({ getAccountMonthlyGrowth: async () => 0 }));

// Counts how often the purchase check below is drawn.
const mockPurchaseDraws = { count: 0 };
jest.mock('./PurchaseCheck', () => ({
  PurchaseCheck: () => {
    mockPurchaseDraws.count++;
    // A real amount field, as the purchase check has: whether the page gives it the app's pad is what is tested.
    const { AmountField } = require('@/components/AmountField');
    return <AmountField label="Planned purchase" value="" onChangeText={() => {}} placeholder="purchase" />;
  },
}));
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
  it('gives the purchase amount the app’s own pad, not the phone keyboard', async () => {
    const tree = await render();
    const input = tree.root.find((n) => typeof n.type === 'string' && n.props.placeholder === 'purchase');
    expect(input.props.showSoftInputOnFocus).toBe(false);
  });

  it('does not draw the purchase check again when a category, a cut or a goal is picked', async () => {
    mockGoals = [goal];
    const tree = await render();
    const drawn = mockPurchaseDraws.count;
    expect(drawn).toBeGreaterThan(0);
    press(tree, 'Fun');
    press(tree, '-30%');
    press(tree, 'Goa trip');
    press(tree, 'Reset');
    expect(mockPurchaseDraws.count).toBe(drawn);
    // The page itself did follow the choices.
    expect(texts(tree)).toContain('Fun');
  });

  beforeEach(() => {
    mockParams = {};
    mockGoals = [goal];
    mockHide = false;
    mockSensitive = false;
    mockExtraCategories = 0;
    mockRent = false;
    mockFlow = [1, 2, 3, 4].map((m) => ({
      label: `m${m}`,
      incomeMinor: 10_000_000,
      expenseMinor: 9_000_000,
      recorded: true,
    }));
  });

  it('shows the six biggest categories and the rest behind "N more"', async () => {
    mockExtraCategories = 8;
    const tree = await render();
    // Food and Fun lead (₹12,000 and ₹3,000 a month), then four extras: ten categories in all.
    let shown = texts(tree);
    expect(shown).toContain('Food');
    expect(shown).toContain('Extra 3');
    expect(shown).not.toContain('Extra 4');
    expect(shown).toContain('4 more');
    await press(tree, '4 more');
    shown = texts(tree);
    expect(shown).toContain('Extra 7');
    expect(shown).toContain('Fewer');
  });

  it('starts on the biggest category that is a choice, not on rent, though rent can still be picked', async () => {
    mockRent = true;
    const tree = await render();
    // Rent is the biggest (₹25,000) but fixed: the sandbox opens on Food (₹12,000, ₹9,600 after a 20% cut).
    expect(texts(tree)).toEqual(expect.arrayContaining(['₹12,000', '₹9,600']));
    expect(texts(tree)).not.toContain('₹20,000');
    // Rent is still a chip, for someone who really is moving.
    await press(tree, 'Rent');
    expect(texts(tree)).toEqual(expect.arrayContaining(['₹25,000', '₹20,000']));
    act(() => tree.unmount());
  });

  it('shows the month now and with the default 20% cut', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining(['Now, a month', 'With the cut, a month', '₹12,000', '₹9,600'])
    );
  });

  it('keeps the category and 5% cut selected on Plan', async () => {
    mockParams = { category: 'fun', cut: '5' };
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['₹3,000', '₹2,850']));
    act(() => tree.unmount());
  });
  it('rejects an invalid requested cut and uses the default', async () => {
    mockParams = { cut: '150' };
    const tree = await render();
    expect(texts(tree)).toContain('₹9,600');
    act(() => tree.unmount());
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

  it('says where to save from three months of income and spending', async () => {
    const shown = texts(await render());
    expect(shown).toContain('Where you can save');
    expect(shown).toContain('You keep 10% of what you earn');
  });

  it('leaves the advice out when nothing is recorded', async () => {
    mockFlow = [];
    expect(texts(await render())).not.toContain('Where you can save');
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
