/**
 * Tidy up screen with mocked data: lists what was found, each fix calls the right thing and offers undo,
 * "keep" choices are saved, and it says "All tidy" when empty.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));

const pair = {
  key: 'expense|bank|||5000|2026-09-23',
  ids: ['t1', 't2'],
  savedAt: ['2026-09-23 08:23:27', '2026-09-24 03:38:40'],
  type: 'expense',
  amountMinor: 5000,
  date: '2026-09-23',
  accountName: 'Bank',
  toAccountName: null,
  categoryName: 'Food',
  categoryIcon: 'food',
  categoryColor: '#FF9E7D',
};
const oldBalance = {
  key: 'bank|prev',
  accountId: 'bank',
  accountName: 'Bank',
  categoryName: 'Previous',
  ids: ['i1', 'i2'],
  totalMinor: 1_200_000,
  firstDate: '2026-08-01',
  lastDate: '2026-09-01',
};
const mockReport = { current: { repeats: [pair], startingBalances: [oldBalance], fractionalCount: 0 } };
jest.mock('@/db/tidyUp', () => ({
  getTidyUpReport: async () => mockReport.current,
  keepRepeatGroup: jest.fn(async () => {}),
  keepAsIncome: jest.fn(async () => {}),
  deleteNewestOfGroup: jest.fn(async () => ({ table: 'transactions', row: {} })),
  undoDeleteNewestOfGroup: jest.fn(async () => {}),
  moveToOpeningBalance: jest.fn(async () => ({
    transaction: {},
    accountId: 'bank',
    previousOpeningMinor: 0,
  })),
  undoMoveToOpeningBalance: jest.fn(async () => {}),
}));
jest.mock('@/db/maintenance', () => ({ roundLedgerAmountsToWholeRupees: jest.fn() }));

import TidyUpScreen from '../../../app/tidy-up';
import { roundLedgerAmountsToWholeRupees } from '@/db/maintenance';
import { showAlert } from '@/components/AppDialog';
import { keepRepeatGroup, deleteNewestOfGroup, moveToOpeningBalance, keepAsIncome } from '@/db/tidyUp';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<TidyUpScreen />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
async function tap(tree: ReactTestRenderer, title: string) {
  await act(async () => {
    await tree.root
      .find((n) => n.props.title === title && typeof n.props.onPress === 'function')
      .props.onPress();
  });
}

beforeAll(async () => {
  await render();
}, 180000);

describe('Tidy up screen', () => {
  it('lists repeats and old balances', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['Same entry twice?', 'Old balances logged as income']));
    expect(shown.some((t) => t.startsWith('₹50 · Food · Bank'))).toBe(true);
    expect(shown.some((t) => t.startsWith('₹12,000 · Previous · Bank'))).toBe(true);
  });

  it('deletes one of a pair with an undo, or keeps both', async () => {
    const tree = await render();
    await tap(tree, 'Delete one');
    expect(deleteNewestOfGroup).toHaveBeenCalledWith(pair);
    expect(mockShowUndo).toHaveBeenCalledWith('Repeat moved to Recently deleted', expect.any(Function));
    await tap(tree, 'Keep both');
    expect(keepRepeatGroup).toHaveBeenCalledWith(pair.key);
  });

  it('moves a group of old balances to the opening balance with an undo, or keeps them as income', async () => {
    const tree = await render();
    await tap(tree, 'Move to opening balance');
    expect(moveToOpeningBalance).toHaveBeenCalledWith(oldBalance);
    expect(mockShowUndo).toHaveBeenCalledWith("Moved to Bank's opening balance", expect.any(Function));
    await tap(tree, "They're real income");
    expect(keepAsIncome).toHaveBeenCalledWith('bank|prev');
  });

  it('rounds amounts only after a confirm, then offers an undo that puts them back', async () => {
    const saved = mockReport.current;
    mockReport.current = { repeats: [], startingBalances: [], fractionalCount: 3 };
    const undo = jest.fn(async () => {});
    (roundLedgerAmountsToWholeRupees as jest.Mock).mockResolvedValueOnce({ total: 3, undo });
    const tree = await render();
    await tap(tree, 'Round them');
    expect(roundLedgerAmountsToWholeRupees).not.toHaveBeenCalled();
    const [, message, buttons] = jest.mocked(showAlert).mock.calls.at(-1)!;
    expect(message).not.toContain('cannot be undone');
    await act(async () => {
      await buttons!.find((b) => b.text === 'Round them')!.onPress!();
    });
    expect(mockShowUndo).toHaveBeenCalledWith('Rounded 3 amounts to whole rupees', expect.any(Function));
    await act(async () => mockShowUndo.mock.calls.at(-1)![1]());
    expect(undo).toHaveBeenCalledTimes(1);
    mockReport.current = saved;
  });

  it('says all tidy when there is nothing', async () => {
    const saved = mockReport.current;
    mockReport.current = { repeats: [], startingBalances: [], fractionalCount: 0 };
    expect(texts(await render())).toContain('All tidy');
    mockReport.current = saved;
  });
});
