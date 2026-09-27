/**
 * The category page, with its data mocked: it shows the period's total,
 * where within the category the money went, its budget, six months of bars
 * and the latest entries — and its buttons open What-if and Activity on
 * that category.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/reports/RangeSheet', () => ({ RangeSheet: () => null }));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/features/transactions/TransactionDetailModal', () => ({ TransactionDetailModal: () => null }));
const mockParams: { current: Record<string, string> } = { current: { id: 'food' } };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockParams.current,
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));

const category = (id: string, name: string, parentId: string | null = null) => ({
  id,
  name,
  kind: 'expense',
  icon: 'food',
  color: '#FF9E7D',
  parentId,
  archived: false,
});
jest.mock('@/db/ledger', () => ({
  listCategories: async () => [category('food', 'Food'), category('bistro', 'Bistro', 'food')],
  listAccounts: async () => [{ id: 'bank', name: 'Bank', type: 'bank', currency: 'INR' }],
  listTransactions: async () => [
    {
      id: 't1',
      type: 'expense',
      accountId: 'bank',
      toAccountId: null,
      categoryId: 'bistro',
      amountMinor: 30000,
      date: '2026-09-10',
      note: '',
    },
  ],
}));
jest.mock('@/db/reports', () => ({
  getCategoryOverview: async () => ({
    totalMinor: 65000,
    count: 4,
    split: [
      { categoryId: 'bistro', name: 'Bistro', totalMinor: 50000 },
      { categoryId: 'food', name: 'Other Food', totalMinor: 15000 },
    ],
    months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month, i) => ({
      month,
      totalMinor: i === 5 ? 65000 : 0,
    })),
  }),
  usualMonthly: () => null,
}));
jest.mock('@/db/budgets', () => ({
  listBudgetsForMonth: async () => [
    {
      budget: {
        id: 'b1',
        categoryId: 'food',
        periodMonth: '2026-09',
        limitAmountMinor: 50000,
        rollover: false,
      },
      categoryName: 'Food',
      categoryIcon: 'food',
      categoryColor: '#FF9E7D',
      spentMinor: 65000,
      effectiveLimitMinor: 50000,
      remainingMinor: -15000,
      percentUsed: 130,
      overBudget: true,
    },
  ],
}));

import CategoryScreen from '../../../app/category/[id]';
import { router } from 'expo-router';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CategoryScreen />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
function press(tree: ReactTestRenderer, label: string) {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label)
  );
  act(() => node.props.onPress());
}

beforeAll(async () => {
  await render();
}, 180000);

describe('Category page', () => {
  it('shows the total, the split, the budget and the latest entries', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        '₹650',
        'Where it went',
        'Bistro',
        '₹500',
        'Other Food',
        'Budget',
        'By month',
        'Latest entries',
      ])
    );
    expect(shown.some((t) => t.startsWith('4 entries'))).toBe(true);
    expect(shown).toContain('₹150 over budget');
  });

  it('opens What-if and Activity on this category', async () => {
    const tree = await render();
    press(tree, 'What if I cut this?');
    expect(router.push).toHaveBeenCalledWith('/whatif?category=food');
    press(tree, 'See all in Activity');
    expect(router.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/transactions\?category=food&month=\d{4}-\d{2}$/)
    );
  });

  it('opens a custom range longer than a month at its last month, and says so', async () => {
    mockParams.current = { id: 'food', g: 'custom', from: '2026-04-01', to: '2026-06-30' };
    try {
      const tree = await render();
      const label = texts(tree).find((t) => t.startsWith('See ') && t.endsWith(' in Activity'))!;
      expect(label).toMatch(/June/);
      press(tree, label);
      expect(router.navigate).toHaveBeenLastCalledWith('/transactions?category=food&month=2026-06');
    } finally {
      mockParams.current = { id: 'food' };
    }
  });
});
