import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children, footer }: any) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
jest.mock('@/components/LimitMeter', () => ({ LimitMeter: () => null }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('@/db/ledger', () => ({ listTransactions: jest.fn() }));
const mockRowProps: Record<string, unknown>[] = [];
jest.mock('@/features/home/RecentTransactionRow', () => ({
  RecentTransactionRow: (props: any) => {
    mockRowProps.push(props);
    return require('react').createElement(require('react-native').Text, null, props.tx.note);
  },
}));
jest.mock('./AddBudgetModal', () => ({
  AddBudgetModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'budget-edit' }),
}));
import { BudgetDetailModal } from './BudgetDetailModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listTransactions } from '@/db/ledger';
import type { BudgetProgress } from '@/db/budgets';
import type { Category } from '@/types';
const progress: BudgetProgress = {
  budget: { id: 'b1', categoryId: 'food', periodMonth: '2026-02', limitAmountMinor: 100000, rollover: false },
  categoryName: 'Food',
  categoryColor: '#FFA8CE',
  categoryIcon: 'food',
  spentMinor: 30000,
  effectiveLimitMinor: 100000,
  remainingMinor: 70000,
  percentUsed: 30,
  overBudget: false,
};
const categories = [
  { id: 'food', name: 'Food', parentId: null, isSensitive: false },
  { id: 'private', name: 'Private', parentId: 'food', isSensitive: true },
] as Category[];
const changed = jest.fn(),
  close = jest.fn();
const roots: ReactTestRenderer[] = [];
const words = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' ');
const button = (tree: ReactTestRenderer, title: string) =>
  tree.root.findAllByType(PrimaryButton).find((n) => n.props.title === title)!;
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BudgetDetailModal
        progress={progress}
        categories={categories}
        accounts={[]}
        currency="INR"
        onClose={close}
        onChanged={changed}
      />
    );
  });
  roots.push(tree);
  return tree;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRowProps.length = 0;
  mockHide = false;
  jest.mocked(listTransactions).mockResolvedValue([
    {
      id: 'tx',
      type: 'expense',
      categoryId: 'food',
      note: 'Lunch',
      accountId: 'bank',
      toAccountId: null,
    } as any,
  ]);
});
afterEach(() => act(() => roots.splice(0).forEach((tree) => tree.unmount())));
it('opens a read-only monthly overview and fetches category entries with the correct month and currency', async () => {
  const tree = await render();
  expect(words(tree)).toContain('Lunch');
  expect(words(tree)).toContain('₹700');
  expect(listTransactions).toHaveBeenCalledWith({
    categoryId: 'food',
    includeSubcategories: true,
    spendingOnly: true,
    currency: 'INR',
    fromDate: '2026-02-01',
    toDate: '2026-02-28',
    limit: 8,
  });
  expect(tree.root.findAllByProps({ testID: 'budget-edit' })).toHaveLength(0);
  expect(changed).not.toHaveBeenCalled();
});
it('keeps editing separate, returns from cancel, and refreshes after a successful edit', async () => {
  const tree = await render();
  act(() => button(tree, 'Edit limit').props.onPress());
  const edit = () => tree.root.findByProps({ testID: 'budget-edit' });
  expect(edit().props.editing.budget.id).toBe('b1');
  expect(edit().props.backLabel).toBe('Back to budget overview');
  act(() => edit().props.onClose());
  expect(words(tree)).toContain('Lunch');
  expect(changed).not.toHaveBeenCalled();
  act(() => button(tree, 'Edit limit').props.onPress());
  await act(async () => {
    await edit().props.onSaved();
  });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
});
it('reports an entry read failure and retries without discarding the known budget', async () => {
  jest.mocked(listTransactions).mockRejectedValueOnce(new Error('offline'));
  const tree = await render();
  expect(words(tree)).toContain('offline');
  expect(words(tree)).toContain('₹700');
  await act(async () => button(tree, 'Retry').props.onPress());
  expect(words(tree)).toContain('Lunch');
  expect(words(tree)).not.toContain('offline');
});
it('does not expose sensitive-category entries in privacy mode', async () => {
  mockHide = true;
  jest.mocked(listTransactions).mockResolvedValueOnce([
    {
      id: 'private-tx',
      type: 'expense',
      categoryId: 'private',
      note: 'Hidden purchase',
      accountId: 'bank',
      toAccountId: null,
    } as any,
  ]);
  const tree = await render();
  expect(words(tree)).not.toContain('Hidden purchase');
  expect(words(tree)).toContain('No visible spending entries this month.');
});

it('puts the spent-of-limit figures, month and status in the one header card', async () => {
  const tree = await render();
  const text = words(tree);
  expect(text).toContain('₹300');
  expect(text).toContain('spent of');
  expect(text).toContain('₹1,000');
  expect(text).toContain('Remaining for this month · Feb 2026');
  expect(text).toContain('Monthly budget');
  expect(text).not.toContain('Available limit');
  expect(text).not.toContain('No rollover');
});

it('says when unspent money rolls over', async () => {
  const rolling = { ...progress, budget: { ...progress.budget, rollover: true } };
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <BudgetDetailModal
        progress={rolling}
        categories={categories}
        accounts={[]}
        currency="INR"
        onClose={close}
        onChanged={changed}
      />
    );
  });
  roots.push(tree);
  expect(words(tree)).toContain('Monthly budget · Rolls over');
});

it('lists entries densely without repeating the budget category, and counts them', async () => {
  const tree = await render();
  expect(mockRowProps.length).toBeGreaterThan(0);
  expect(mockRowProps.every((p) => p.dense === true && p.omitCategory === true)).toBe(true);
  expect(words(tree)).toContain('1 this month');
});
