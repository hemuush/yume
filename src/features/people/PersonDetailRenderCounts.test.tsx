/**
 * What a person's sheet draws again for each thing done on it: typing the amount or a note and picking an account draw the
 * Settle page alone, and opening a history entry's menu draws the menu, not every entry.
 */
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
const mockDrawn = { card: 0, rows: 0 };
jest.mock('@/components/DraftCard', () => ({
  DraftCard: (props: any) => {
    mockDrawn.card++;
    return require('react').createElement(require('react-native').View, props);
  },
}));
// Every history entry draws two icons (its arrow and its ⋯ button) each time it is drawn; nothing else on the sheet uses one.
jest.mock('@expo/vector-icons/Feather', () => ({
  __esModule: true,
  default: () => {
    mockDrawn.rows += 0.5;
    return null;
  },
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (props: any) =>
    require('react').createElement(require('react-native').View, { testID: 'amount', ...props }),
}));
jest.mock('@/components/FormInput', () => ({
  FormInput: (props: any) =>
    require('react').createElement(require('react-native').View, { testID: 'note', ...props }),
}));
jest.mock('@/components/DateField', () => ({ DateField: () => null }));
const mockMenu: { visible: boolean } = { visible: false };
jest.mock('@/components/ActionSheet', () => ({
  ActionSheet: (props: { visible: boolean }) => {
    mockMenu.visible = props.visible;
    return null;
  },
}));
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
  listAccounts: jest.fn(async () => [
    { id: 'bank', name: 'SBI', currency: 'INR', type: 'bank' },
    { id: 'cash', name: 'Cash', currency: 'INR', type: 'cash' },
  ]),
  listCategories: jest.fn(async () => []),
}));
jest.mock('@/db/loans', () => ({ listLoansForPerson: jest.fn(async () => []) }));

import { PersonDetailModal } from './PersonDetailModal';
import { SheetTabs } from '@/components/SheetTabs';
import { Chip } from '@/components/Chip';
import { getPersonLedger } from '@/db/people';

const entry = (id: string, amountMinor: number, date: string) => ({
  id,
  personId: 'person',
  amountMinor,
  date,
  note: id,
  currency: 'INR',
});
const ledger = [
  entry('Dinner', 120000, '2026-10-09'),
  entry('Taxi', 30000, '2026-10-08'),
  entry('Gift', -50000, '2026-10-07'),
];
const person = { id: 'person', name: 'Friend', balanceMinor: 100000 } as any;
const trees: ReactTestRenderer[] = [];
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PersonDetailModal person={person} onClose={jest.fn()} onChanged={jest.fn()} />);
  });
  await act(async () => {});
  trees.push(tree);
  return tree;
}
const chip = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAllByType(Chip).find((c) => c.props.label === label)!;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockDrawn, { card: 0, rows: 0 });
  mockMenu.visible = false;
  (getPersonLedger as jest.Mock).mockResolvedValue(ledger);
});
afterEach(() => act(() => trees.splice(0).forEach((tree) => tree.unmount())));

describe('the Settle page', () => {
  it('draws only the form when the amount or the note is typed, or an account picked', async () => {
    const tree = await render();
    const card = mockDrawn.card;
    expect(card).toBeGreaterThan(0);
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('5'));
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('50'));
    act(() => tree.root.findByProps({ testID: 'note' }).props.onChangeText('Dinner'));
    act(() => chip(tree, 'SBI').props.onPress());
    act(() => chip(tree, 'Just adjust balance').props.onPress());
    expect(mockDrawn.card).toBe(card);
  });

  it('still shows what was typed and picked, and fills the whole balance from the chip', async () => {
    const tree = await render();
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('50'));
    act(() => tree.root.findByProps({ testID: 'note' }).props.onChangeText('Dinner'));
    act(() => chip(tree, 'SBI').props.onPress());
    expect(tree.root.findByProps({ testID: 'amount' }).props.value).toBe('50');
    expect(tree.root.findByProps({ testID: 'note' }).props.value).toBe('Dinner');
    expect(chip(tree, 'SBI').props.active).toBe(true);
    expect(chip(tree, 'Just adjust balance').props.active).toBe(false);
    act(() => chip(tree, 'Settle ₹1,000').props.onPress());
    expect(tree.root.findByProps({ testID: 'amount' }).props.value).toBe('1000');
    expect(chip(tree, 'Settle ₹1,000').props.active).toBe(true);
  });
});

describe('the history page', () => {
  async function openHistory() {
    const tree = await render();
    act(() => tree.root.findByType(SheetTabs).props.onChange('history'));
    return tree;
  }
  const menuButtons = (tree: ReactTestRenderer) =>
    tree.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('More for')
    );

  it('draws each entry once, and not again when the ⋯ menu opens and closes', async () => {
    const tree = await openHistory();
    expect(mockDrawn.rows).toBe(3);
    act(() => menuButtons(tree)[0].props.onPress({ stopPropagation: () => {} }));
    expect(mockMenu.visible).toBe(true);
    expect(mockDrawn.rows).toBe(3);
  });

  it('keeps what was typed while looking at the history, and back', async () => {
    const tree = await render();
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('7'));
    act(() => tree.root.findByProps({ testID: 'note' }).props.onChangeText('Lunch'));
    act(() => chip(tree, 'SBI').props.onPress());
    act(() => tree.root.findByType(SheetTabs).props.onChange('history'));
    act(() => tree.root.findByType(SheetTabs).props.onChange('settle'));
    expect(tree.root.findByProps({ testID: 'amount' }).props.value).toBe('7');
    expect(tree.root.findByProps({ testID: 'note' }).props.value).toBe('Lunch');
    expect(chip(tree, 'SBI').props.active).toBe(true);
  });
});
