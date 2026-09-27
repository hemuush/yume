/**
 * An entry's detail sheet: "Log again today" saves the same entry for
 * today with an undo, "Make it recurring" opens the rule form filled in
 * from it (monthly, from its next same day of the month), and the category
 * name opens that category's page. Entries tied to a loan get none of these.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
// The stack: Activity only, unless a test puts a category page on it.
const mockStack = { routes: [{ name: '(tabs)' }] as { name: string; params?: object }[] };
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
  useNavigation: () => ({
    getState: () => ({ routes: mockStack.routes, index: mockStack.routes.length - 1 }),
  }),
}));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
const mockRule = {
  current: null as null | { visible: boolean; prefill?: { nextRunDate: string; amountMinor: number } },
};
jest.mock('@/features/recurring/RuleModal', () => ({
  RuleModal: (props: typeof mockRule.current) => {
    mockRule.current = props;
    return null;
  },
}));
const mockLink = { current: null as null | { kind: string; loanPaymentId?: string } };
jest.mock('@/db/ledger', () => ({
  createTransaction: jest.fn(async () => ({ id: 'again' })),
  deleteTransaction: jest.fn(),
  restoreTransaction: jest.fn(),
  getTransactionLink: jest.fn(async () => mockLink.current),
}));
jest.mock('@/db/loans', () => ({ undoInstallmentPayment: jest.fn() }));
jest.mock('@/db/people', () => ({ undoPersonTransaction: jest.fn() }));

import { TransactionDetailModal } from './TransactionDetailModal';
import { createTransaction } from '@/db/ledger';
import { router } from 'expo-router';
import { toLocalIsoDate } from '@/lib/date';

const lunch = {
  id: 't1',
  type: 'expense' as const,
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  amountMinor: 11000,
  date: '2026-01-15',
  note: 'Lunch',
  paymentMode: null,
  loanPaymentId: null,
  splitId: null,
  isRefund: false,
  loanId: null,
  createdAt: '',
};

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TransactionDetailModal
        tx={lunch as any}
        accounts={[{ id: 'bank', name: 'Bank' } as any]}
        categories={[{ id: 'food', name: 'Food', icon: 'food', color: '#FF9E7D' } as any]}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onChanged={jest.fn()}
      />
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
}
const titled = (tree: ReactTestRenderer, title: string) =>
  tree.root.findAll((n) => n.props.title === title && typeof n.props.onPress === 'function');

beforeEach(() => {
  mockLink.current = null;
});

beforeAll(async () => {
  await render();
}, 180000);

describe('entry detail', () => {
  it('logs the same entry again for today, with an undo', async () => {
    const tree = await render();
    await act(async () => {
      await titled(tree, 'Log again today')[0].props.onPress();
    });
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'food',
        amountMinor: 11000,
        note: 'Lunch',
        date: toLocalIsoDate(new Date()),
      })
    );
    expect(mockShowUndo).toHaveBeenCalledWith('Logged again for today', expect.any(Function));
  });

  it('opens the rule form filled in, monthly from its next same day still ahead', async () => {
    const tree = await render();
    await act(async () => {
      titled(tree, 'Make it recurring')[0].props.onPress();
    });
    expect(mockRule.current?.visible).toBe(true);
    const next = mockRule.current!.prefill!.nextRunDate;
    expect(next > toLocalIsoDate(new Date())).toBe(true);
    expect(next.slice(8)).toBe('15');
    expect(mockRule.current?.prefill?.amountMinor).toBe(11000);
  });

  it("just closes when opened from that category's own page", async () => {
    mockStack.routes = [{ name: '(tabs)' }, { name: 'category/[id]', params: { id: 'food' } }];
    try {
      const tree = await render();
      const link = tree.root.find(
        (n) =>
          typeof n.props.onPress === 'function' &&
          n.findAllByType(Text).some((t) => t.props.children?.join?.('') === 'See everything in Food')
      );
      (router.push as jest.Mock).mockClear();
      act(() => link.props.onPress());
      expect(router.push).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    } finally {
      mockStack.routes = [{ name: '(tabs)' }];
    }
  });

  it("opens the entry's category page", async () => {
    const tree = await render();
    const link = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => t.props.children?.join?.('') === 'See everything in Food')
    );
    act(() => link.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/category/food');
  });

  it('offers none of this for an entry tied to a loan', async () => {
    mockLink.current = { kind: 'loan', loanPaymentId: 'p1' };
    const tree = await render();
    expect(titled(tree, 'Log again today')).toHaveLength(0);
    expect(titled(tree, 'Make it recurring')).toHaveLength(0);
  });
});
