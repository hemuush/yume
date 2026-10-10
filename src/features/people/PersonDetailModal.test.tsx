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
jest.mock('@/components/SheetCard', () => ({
  SheetCard: (props: any) =>
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
import { SegmentedControl } from '@/components/SegmentedControl';
import { getPersonLedger, addLedgerEntry } from '@/db/people';

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
  expect(tree.root.findByProps({ testID: 'balance' }).props.amount).toContain('1,200');
  expect(button(tree, 'They repaid').props.disabled).toBe(true);
  await act(async () => {
    resolve(ledger);
  });
  expect(button(tree, 'They repaid').props.disabled).toBe(false);
});

it('keeps the balance on a failed fetch and recovers through Retry', async () => {
  (getPersonLedger as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const tree = await render();
  expect(tree.root.findByProps({ testID: 'balance' }).props.amount).toContain('1,200');
  expect(button(tree, 'They repaid').props.disabled).toBe(true);
  await act(async () => {
    await button(tree, 'Retry').props.onPress();
  });
  expect(button(tree, 'They repaid').props.disabled).toBe(false);
});

it('uses a history-only footer and preserves the settlement controls on returning', async () => {
  const tree = await render();
  act(() => tree.root.findByType(SegmentedControl).props.onChange('history'));
  expect(tree.root.findAllByType(PrimaryButton).map((n) => n.props.title)).toEqual(['Done']);
  act(() => tree.root.findByType(SegmentedControl).props.onChange('settle'));
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
