/** Home's quick-entry row: plain shortcuts until entries repeat, then one-tap chips that save for today with Undo. */
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import type { RepeatEntry } from '@/db/ledger';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@/components/CategoryIcon', () => ({ CategoryIcon: () => null }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn() } }));
const mockPush = jest.fn();
jest.mock('@/lib/pushOnce', () => ({ pushOnce: (path: string) => mockPush(path) }));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
const mockRepeats = jest.fn(async (): Promise<RepeatEntry[]> => []);
const mockCreate = jest.fn(async (input: unknown) => ({ id: 'new', ...(input as object) }));
jest.mock('@/db/ledger', () => ({
  getRepeatEntries: () => mockRepeats(),
  createTransaction: (input: unknown) => mockCreate(input),
  deleteTransaction: jest.fn(),
}));

import { HeroActions } from './HeroActions';

const tea: RepeatEntry = {
  type: 'expense',
  accountId: 'bank',
  accountCurrency: 'INR',
  categoryId: 'food',
  categoryName: 'Food',
  parentName: null,
  categoryIcon: 'coffee',
  categoryColor: '#f80',
  amountMinor: 31500,
  note: 'Office Cafeteria',
  timesLogged: 6,
};

const labels = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.onPress)
    .map((n) => n.props.accessibilityLabel as string);

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<HeroActions />);
  });
  return tree;
}

beforeEach(() => {
  mockHide = false;
  mockRepeats.mockReset();
  mockCreate.mockClear();
  mockShowUndo.mockClear();
});

it('shows Expense, Income and Transfer while nothing repeats yet', async () => {
  mockRepeats.mockResolvedValue([]);
  const tree = await render();
  expect(labels(tree)).toEqual(['Add expense', 'Add income', 'Add transfer']);
  act(() => tree.unmount());
});

it('leads with repeated entries, then Income and Transfer (Expense is the + button)', async () => {
  mockRepeats.mockResolvedValue([tea]);
  const tree = await render();
  expect(labels(tree)).toEqual(['Log Office Cafeteria, ₹315, again for today', 'Add income', 'Add transfer']);
  act(() => tree.unmount());
});

it('saves a chip once for today and offers Undo', async () => {
  mockRepeats.mockResolvedValue([tea]);
  const tree = await render();
  const chip = tree.root.findAll(
    (n) => n.props.accessibilityLabel?.startsWith?.('Log ') && n.props.onPress
  )[0];
  await act(async () => {
    chip.props.onPress();
    chip.props.onPress();
  });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'expense', accountId: 'bank', categoryId: 'food', amountMinor: 31500 })
  );
  expect(mockShowUndo).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it('leaves out private entries while amounts are hidden', async () => {
  mockHide = true;
  mockRepeats.mockResolvedValue([{ ...tea, isSensitive: true }]);
  const tree = await render();
  expect(labels(tree)).toEqual(['Add expense', 'Add income', 'Add transfer']);
  act(() => tree.unmount());
});
