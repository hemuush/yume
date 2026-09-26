/**
 * The + long-press "Log again" sheet: one tap saves the entry for today and
 * offers Undo; Undo deletes exactly that entry; Home/Activity are told to
 * refresh both times; a double tap can't log it twice.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// The first render loads React Native's component tree, which on a cold, fully
// parallel run (CI, or the whole suite at once) can take longer than Jest's
// 5s default — seen failing that way, never on its own. Generous, not slow.
jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ haptics: { confirm: jest.fn(), tap: jest.fn(), warn: jest.fn() } }));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/components/ActionSheet', () => ({
  // Render each item as a plain pressable stub the test can find by label.
  ActionSheet: ({ items, subtitle }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text>{subtitle}</Text>
        {items.map((i: any) => (
          <Pressable key={i.key} accessibilityLabel={i.label} onPress={i.onPress} />
        ))}
      </View>
    );
  },
}));
const metro = {
  type: 'expense',
  accountId: 'acc-1',
  accountCurrency: 'INR',
  categoryId: 'cat-1',
  categoryName: 'Transport',
  categoryIcon: 'car',
  categoryColor: '#8FCBFF',
  amountMinor: 15000,
  note: 'Metro',
  timesLogged: 6,
};
jest.mock('@/db/ledger', () => ({
  getRepeatEntries: jest.fn(async () => [metro]),
  createTransaction: jest.fn(async () => ({ id: 'tx-new' })),
  deleteTransaction: jest.fn(async () => ({})),
}));
jest.mock('@/lib/dataEvents', () => ({ emitTransactionsChanged: jest.fn() }));

import { RepeatEntrySheet, repeatEntryLabel } from './RepeatEntrySheet';
import { createTransaction, deleteTransaction } from '@/db/ledger';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { router } from 'expo-router';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RepeatEntrySheet visible onClose={() => {}} />);
  });
  return tree;
}
/** One macrotask: lets every already-queued promise (the mocks resolve immediately) finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress);

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold, fully parallel run (CI) their first load can
// outlast a single test's time limit, which failed this file intermittently.
beforeAll(async () => {
  await render();
}, 180000);

describe('RepeatEntrySheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it("labels an entry with its note (or category) and amount in the account's currency", () => {
    expect(repeatEntryLabel(metro as any)).toBe(`Metro · ${formatMoney(15000, 'INR')}`);
    expect(repeatEntryLabel({ ...metro, note: '  ' } as any)).toBe(
      `Transport · ${formatMoney(15000, 'INR')}`
    );
  });

  it('one tap logs it for today, refreshes screens, and offers an Undo that deletes exactly it', async () => {
    const tree = await render();
    await act(async () => {
      byLabel(tree, repeatEntryLabel(metro as any)).props.onPress();
      await settle(); // onPress fires `void logAgain()` — wait for it
    });
    expect(createTransaction).toHaveBeenCalledWith({
      type: 'expense',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      amountMinor: 15000,
      date: toLocalIsoDate(new Date()),
      note: 'Metro',
    });
    expect(emitTransactionsChanged).toHaveBeenCalledTimes(1);
    expect(mockShowUndo).toHaveBeenCalledTimes(1);

    const undo = mockShowUndo.mock.calls[0][1];
    await act(async () => {
      await undo();
    });
    expect(deleteTransaction).toHaveBeenCalledWith('tx-new');
    expect(emitTransactionsChanged).toHaveBeenCalledTimes(2);
  });

  it('a double tap logs it only once', async () => {
    const tree = await render();
    const row = byLabel(tree, repeatEntryLabel(metro as any));
    await act(async () => {
      row.props.onPress();
      row.props.onPress();
      await settle();
    });
    expect(createTransaction).toHaveBeenCalledTimes(1);
  });

  it('always offers a way into the full Add screen', async () => {
    const tree = await render();
    act(() => byLabel(tree, 'Open Add screen').props.onPress());
    expect(router.push).toHaveBeenCalledWith('/add-transaction');
  });
});
