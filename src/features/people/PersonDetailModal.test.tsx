import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (fn: () => void) => require('react').useEffect(fn, [fn]),
}));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: any) => (
    <>
      {children}
      {footer}
    </>
  ),
}));
jest.mock('@/components/DraftCard', () => ({
  DraftCard: (props: any) =>
    require('react').createElement(require('react-native').View, { testID: 'balance', ...props }),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (props: any) =>
    require('react').createElement(require('react-native').View, { testID: 'amount', ...props }),
}));
jest.mock('@/components/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: jest.fn() }) }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#A6B4F2' }) }));
jest.mock('@/db/settings', () => ({ getCachedCurrency: () => 'INR' }));
jest.mock('@/db/people', () => ({
  getPersonLedger: jest.fn(),
  addLedgerEntry: jest.fn(),
  recordMoneyGivenToPerson: jest.fn(),
  recordMoneyReceivedFromPerson: jest.fn(),
  deleteLedgerEntry: jest.fn(),
  restoreLedgerEntry: jest.fn(),
}));
jest.mock('@/db/ledger', () => ({
  listAccounts: jest.fn(async () => []),
  listCategories: jest.fn(async () => []),
}));
jest.mock('@/db/loans', () => ({ listLoansForPerson: jest.fn(async () => []) }));

import { PersonDetailModal } from './PersonDetailModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SheetTabs } from '@/components/SheetTabs';
import {
  getPersonLedger,
  addLedgerEntry,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
} from '@/db/people';
import { Chip } from '@/components/Chip';
import { listAccounts, listCategories } from '@/db/ledger';

const ledger = [
  {
    id: 'entry',
    personId: 'person',
    amountMinor: 120000,
    date: '2026-10-09',
    note: 'Dinner',
    currency: 'INR',
  },
];
const trees: ReactTestRenderer[] = [];
const person = { id: 'person', name: 'Friend', balanceMinor: 120000 } as any;
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PersonDetailModal person={person} onClose={jest.fn()} onChanged={jest.fn()} />);
  });
  trees.push(tree);
  return tree;
}
const button = (tree: ReactTestRenderer, title: string) =>
  tree.root.findAllByType(PrimaryButton).find((node) => node.props.title === title)!;

beforeEach(() => {
  jest.clearAllMocks();
  (getPersonLedger as jest.Mock).mockResolvedValue(ledger);
  (addLedgerEntry as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => act(() => trees.splice(0).forEach((tree) => tree.unmount())));

it('keeps the known balance while loading, and blocks settlement until details arrive', async () => {
  let resolve!: (value: unknown) => void;
  (getPersonLedger as jest.Mock).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const tree = await render();
  expect(tree.root.findByProps({ testID: 'balance' }).props.kicker).toBe('Owes you');
  expect(tree.root.findByProps({ testID: 'balance' }).props.figure).toContain('1,200');
  expect(button(tree, 'They repaid').props.disabled).toBe(true);
  await act(async () => {
    resolve(ledger);
  });
  expect(button(tree, 'They repaid').props.disabled).toBe(false);
});

it('keeps the balance on a failed fetch and recovers through Retry', async () => {
  (getPersonLedger as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const tree = await render();
  expect(tree.root.findByProps({ testID: 'balance' }).props.figure).toContain('1,200');
  expect(button(tree, 'They repaid').props.disabled).toBe(true);
  await act(async () => {
    await button(tree, 'Retry').props.onPress();
  });
  expect(button(tree, 'They repaid').props.disabled).toBe(false);
});

it('uses a history-only footer and preserves the settlement controls on returning', async () => {
  const tree = await render();
  act(() => tree.root.findByType(SheetTabs).props.onChange('history'));
  expect(tree.root.findAllByType(PrimaryButton).map((n) => n.props.title)).toEqual(['Settle up']);
  act(() => tree.root.findByType(SheetTabs).props.onChange('settle'));
  expect(button(tree, 'They owe more')).toBeDefined();
  expect(button(tree, 'They repaid')).toBeDefined();
});

it('records only once when settlement is tapped twice before rendering', async () => {
  let finish!: () => void;
  (addLedgerEntry as jest.Mock).mockImplementation(
    () =>
      new Promise<void>((done) => {
        finish = done;
      })
  );
  const tree = await render();
  act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('100'));
  const press = button(tree, 'They repaid').props.onPress;
  let first!: Promise<void>;
  act(() => {
    first = press();
    void press();
  });
  expect(addLedgerEntry).toHaveBeenCalledTimes(1);
  expect(addLedgerEntry).toHaveBeenCalledWith(
    expect.objectContaining({ amountMinor: -10000, personId: 'person' })
  );
  await act(async () => {
    finish();
    await first;
  });
});

it('can open directly on history, with settlement available as an explicit next action', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <PersonDetailModal person={person} initialTab="history" onClose={jest.fn()} onChanged={jest.fn()} />
    );
  });
  trees.push(tree);
  expect(tree.root.findByType(SheetTabs).props.value).toBe('history');
  expect(button(tree, 'They repaid')).toBeUndefined();
  act(() => button(tree, 'Settle up').props.onPress());
  expect(tree.root.findByType(SheetTabs).props.value).toBe('settle');
  expect(button(tree, 'They repaid')).toBeDefined();
});

describe('recording money with an account', () => {
  const bank = { id: 'bank', name: 'SBI', currency: 'INR', type: 'bank' };
  const categories = [
    { id: 'misc', kind: 'expense', name: 'Miscellaneous', isSystem: false },
    { id: 'ff-out', kind: 'expense', name: 'Friends & Family', isSystem: true },
    { id: 'other-in', kind: 'income', name: 'Other Income', isSystem: false },
    { id: 'ff-in', kind: 'income', name: 'Friends & Family', isSystem: true },
  ];
  async function renderWithAccount() {
    (listAccounts as jest.Mock).mockResolvedValue([bank]);
    (listCategories as jest.Mock).mockResolvedValue(categories);
    const tree = await render();
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('250'));
    const chip = (label: string) => tree.root.findAllByType(Chip).find((c) => c.props.label === label)!;
    return { tree, chip };
  }

  it('files money you gave under the Friends & Family expense category, taken from that account', async () => {
    const { tree, chip } = await renderWithAccount();
    act(() => chip('SBI').props.onPress());
    await act(async () => {
      await button(tree, 'They owe more').props.onPress();
    });
    expect(recordMoneyGivenToPerson).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'person',
        accountId: 'bank',
        categoryId: 'ff-out',
        amountMinor: 25000,
      })
    );
    expect(addLedgerEntry).not.toHaveBeenCalled();
  });

  it('files money you got back under the Friends & Family income category, added to that account', async () => {
    const { tree, chip } = await renderWithAccount();
    act(() => chip('SBI').props.onPress());
    await act(async () => {
      await button(tree, 'They repaid').props.onPress();
    });
    expect(recordMoneyReceivedFromPerson).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'bank', categoryId: 'ff-in', amountMinor: 25000 })
    );
    expect(addLedgerEntry).not.toHaveBeenCalled();
  });

  it('only adjusts the balance, signed, when no cash moved', async () => {
    const { tree, chip } = await renderWithAccount();
    act(() => chip('Just adjust balance').props.onPress());
    await act(async () => {
      await button(tree, 'They owe more').props.onPress();
    });
    expect(addLedgerEntry).toHaveBeenLastCalledWith(
      expect.objectContaining({ personId: 'person', amountMinor: 25000 })
    );
    expect(recordMoneyGivenToPerson).not.toHaveBeenCalled();
  });

  it('refuses, and says why, when the Friends & Family category is missing, instead of misfiling it', async () => {
    (listAccounts as jest.Mock).mockResolvedValue([bank]);
    (listCategories as jest.Mock).mockResolvedValue([categories[0]]); // only an unrelated expense category
    const tree = await render();
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('250'));
    act(() =>
      tree.root
        .findAllByType(Chip)
        .find((c) => c.props.label === 'SBI')!
        .props.onPress()
    );
    await act(async () => {
      await button(tree, 'They repaid').props.onPress();
    });
    expect(recordMoneyReceivedFromPerson).not.toHaveBeenCalled();
    expect(recordMoneyGivenToPerson).not.toHaveBeenCalled();
    const shown = tree.root
      .findAll((n) => typeof n.props.children === 'string')
      .map((n) => n.props.children as string);
    expect(
      shown.some((t) => t.includes('Friends & Family') && t.includes('income') && t.includes('missing'))
    ).toBe(true);
  });

  it('asks for a valid amount, and records nothing, when it is empty or zero', async () => {
    const tree = await render();
    for (const value of ['', '0']) {
      act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText(value));
      await act(async () => {
        await button(tree, 'They repaid').props.onPress();
      });
      const shown = tree.root
        .findAll((n) => typeof n.props.children === 'string')
        .map((n) => n.props.children);
      expect(shown).toContain('Enter a valid amount');
    }
    expect(addLedgerEntry).not.toHaveBeenCalled();
  });
});
