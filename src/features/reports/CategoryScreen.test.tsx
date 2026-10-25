/**
 * The category page with data mocked: period total, where within the category money went, its budget, six
 * months of bars and latest entries; its buttons open What-if and Activity on that category.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);
let mockHidden = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden }) }));
afterEach(() => {
  mockHidden = false;
});

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/reports/RangeSheet', () => ({ RangeSheet: () => null }));
jest.mock('@/components/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/features/transactions/TransactionDetailModal', () => ({ TransactionDetailModal: () => null }));
const mockParams: { current: Record<string, string> } = { current: { id: 'food' } };
// The stack below this page: Budgets, then this category's page.
const mockStack = { routes: [{ name: 'budgets' }, { name: 'category/[id]', params: { id: 'food' } }] };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useNavigation: () => ({
    getState: () => ({ routes: mockStack.routes, index: mockStack.routes.length - 1 }),
  }),
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
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDefaultCurrency: async () => 'INR',
}));
jest.mock('@/db/ledger', () => ({
  listCategories: async () => [
    category('food', 'Food'),
    category('bistro', 'Bistro', 'food'),
    { ...category('loans', 'Loan EMI'), isSystem: true },
    category('rent', 'Rent'),
    category('private-parent', 'Private family'),
    { ...category('private-child', 'Hidden child', 'private-parent'), isSensitive: true },
    category('public-child', 'Visible sibling', 'private-parent'),
  ],
  listAccounts: async () => [{ id: 'bank', name: 'Bank', type: 'bank', currency: 'INR' }],
  listTransactions: jest.fn(async () => [
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
  ]),
}));
jest.mock('@/db/reports', () => ({
  getCategoryOverview: jest.fn(async () => ({
    totalMinor: 65000,
    count: 4,
    split: [
      { categoryId: 'bistro', name: 'Bistro', totalMinor: 50000, count: 3 },
      { categoryId: 'food', name: 'Other Food', totalMinor: 15000, count: 1 },
    ],
    months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month, i) => ({
      month,
      totalMinor: i === 5 ? 65000 : 0,
    })),
  })),
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
import { listTransactions } from '@/db/ledger';
import { getCategoryOverview } from '@/db/reports';

// Bars and rings animate to their values (useGrowFrom, at most the 700ms draw):
// let the last ones finish before the file ends, so no frame fires after teardown.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));

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
  it('hides old totals while loading another category and ignores a late old result', async () => {
    const tree = await render();
    let releaseFood!: (value: Awaited<ReturnType<typeof getCategoryOverview>>) => void;
    const food = { totalMinor: 90000, spentMinor: 90000, refundMinor: 0, count: 1, split: [], months: [] };
    jest.mocked(getCategoryOverview).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFood = resolve;
        })
    );
    // Start another read for this category, then navigate before it finishes.
    mockHidden = true;
    await act(async () => tree.update(<CategoryScreen />));
    expect(texts(tree)).not.toContain('₹650');
    mockParams.current = { id: 'rent' };
    jest.mocked(getCategoryOverview).mockResolvedValueOnce({ ...food, totalMinor: 12300 });
    try {
      await act(async () => tree.update(<CategoryScreen />));
      expect(texts(tree)).toContain('₹123');
      expect(texts(tree)).not.toContain('₹650');
      await act(async () => releaseFood(food));
      expect(texts(tree)).toContain('₹123');
      expect(texts(tree)).not.toContain('₹900');
    } finally {
      mockParams.current = { id: 'food' };
      mockHidden = false;
      act(() => tree.unmount());
    }
  });
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
        'Last 6 months',
        'Latest entries',
      ])
    );
    expect(shown).toContain('₹150 over');
    // Each place in the split: its share, and how often with the usual amount only when it was more than once.
    expect(shown).toEqual(expect.arrayContaining(['77%', '23%', '3 times · ₹167 each']));
    expect(shown).not.toContain('once');
    expect(shown).toEqual(expect.arrayContaining(['4 entries', '₹163 each']));
  });

  it('opens What-if and Activity on this category', async () => {
    const tree = await render();
    press(tree, 'What if I cut this?');
    expect(router.push).toHaveBeenCalledWith('/whatif?category=food');
    press(tree, 'See all');
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

  it('ignores an impossible calendar date in a custom range link', async () => {
    mockParams.current = { id: 'food', g: 'custom', from: '2026-02-31', to: '2026-06-30' };
    try {
      const tree = await render();
      press(tree, 'See all');
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(router.navigate).toHaveBeenLastCalledWith(`/transactions?category=food&month=${month}`);
    } finally {
      mockParams.current = { id: 'food' };
    }
  });

  it('goes back to Budgets when it opened this page, instead of stacking another copy', async () => {
    const tree = await render();
    const budget = tree.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.progress);
    act(() => budget[0].props.onPress());
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalledWith('/budgets');
  });
});

it('replaces casual spending cuts with Loans only for the protected EMI category', async () => {
  mockParams.current = { id: 'loans' };
  try {
    const tree = await render();
    expect(texts(tree)).toContain('View loans');
    expect(texts(tree)).not.toContain('What if I cut this?');
    expect(texts(tree).some((t) => t.endsWith(' a day'))).toBe(false);
    expect(texts(tree)).not.toContain('Set a monthly limit');
    press(tree, 'View loans');
    expect(router.push).toHaveBeenLastCalledWith('/loans');
    act(() => tree.unmount());
  } finally {
    mockParams.current = { id: 'food' };
  }
});
it('keeps planning tools available for ordinary categories instead of guessing fixed-spend behavior', async () => {
  mockParams.current = { id: 'rent' };
  try {
    const tree = await render();
    expect(texts(tree)).toContain('What if I cut this?');
    act(() => tree.unmount());
  } finally {
    mockParams.current = { id: 'food' };
  }
});

it.each(['private-parent', 'public-child'])('keeps private category-family totals out of %s', async (id) => {
  mockHidden = true;
  mockParams.current = { id };
  try {
    const tree = await render();
    expect(texts(tree)).toContain('Hidden for now');
    expect(texts(tree)).not.toContain('₹650');
    act(() => tree.unmount());
  } finally {
    mockParams.current = { id: 'food' };
  }
});

it('scopes the latest entries to the overview currency and preserves the category rollup', async () => {
  const tree = await render();
  expect(listTransactions).toHaveBeenLastCalledWith(
    expect.objectContaining({ currency: 'INR', categoryId: 'food', includeSubcategories: true })
  );
  act(() => tree.unmount());
});
