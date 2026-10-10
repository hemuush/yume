/**
 * Entry detail sheet: "Log again today" saves it for today with undo; "Make it recurring" opens a prefilled
 * rule form (monthly, from its next same day); the category row opens its page. Loan-tied entries get none.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHideAmounts }) }));

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
  SheetFooter: ({ children }: { children: React.ReactNode }) => children,
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
const mockLink = { current: null as null | { kind: string; loanPaymentId?: string }, fail: false };
jest.mock('@/db/ledger', () => ({
  createTransaction: jest.fn(async () => ({ id: 'again' })),
  deleteTransaction: jest.fn(),
  restoreTransaction: jest.fn(),
  getTransactionLink: jest.fn(async () => {
    if (mockLink.fail) throw new Error('db locked');
    return mockLink.current;
  }),
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

const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
});
async function render(
  entry: object = lunch,
  categories = [{ id: 'food', name: 'Food', icon: 'food', color: '#FF9E7D' } as any]
) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <TransactionDetailModal
        tx={entry as any}
        accounts={[{ id: 'bank', name: 'Bank' } as any]}
        categories={categories}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onChanged={jest.fn()}
      />
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  mounted.push(tree);
  return tree;
}
/** The pressable rows and buttons labelled `label` — actions and links in the sheet. */
const rows = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (n) =>
      (n.props.label === label || n.props.accessibilityLabel === label) &&
      typeof n.props.onPress === 'function'
  );

beforeEach(() => {
  mockHideAmounts = false;
  mockLink.current = null;
  mockLink.fail = false;
  (createTransaction as jest.Mock).mockClear();
});

beforeAll(async () => {
  await render();
}, 180000);

describe('entry detail', () => {
  it('logs the same entry again for today, with an undo', async () => {
    const tree = await render();
    await act(async () => {
      await rows(tree, 'Log again today')[0].props.onPress();
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

  it('keeps the refund flag when a refund is logged again', async () => {
    const tree = await render({ ...lunch, type: 'income', isRefund: true });
    await act(async () => {
      await rows(tree, 'Log again today')[0].props.onPress();
    });
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', isRefund: true })
    );
  });

  it('does not turn an ordinary entry into a refund', async () => {
    const tree = await render();
    await act(async () => {
      await rows(tree, 'Log again today')[0].props.onPress();
    });
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ isRefund: false }));
  });

  it('leaves the checking state and keeps Edit usable when the link lookup fails', async () => {
    mockLink.fail = true;
    const tree = await render();
    const text = JSON.stringify(tree.toJSON());
    expect(text).not.toContain('Checking…');
    expect(text).toContain("Couldn't check whether this entry is tied to a loan or a person");
    expect(
      tree.root.findAll((n) => n.props.title === 'Edit' && typeof n.props.onPress === 'function').length
    ).toBeGreaterThan(0);
  });

  it('opens the rule form filled in, monthly from its next same day still ahead', async () => {
    const tree = await render();
    await act(async () => {
      rows(tree, 'Make it recurring')[0].props.onPress();
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
      const link = rows(tree, 'Food')[0];
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
    const link = rows(tree, 'Food')[0];
    act(() => link.props.onPress());
    expect(router.push).toHaveBeenCalledWith('/category/food');
  });

  it('offers none of this for an entry tied to a loan', async () => {
    mockLink.current = { kind: 'loan', loanPaymentId: 'p1' };
    const tree = await render();
    // No "Do more" page at all, so nothing to switch to.
    expect(tree.root.findAll((n) => n.props.value === 'details' && n.props.onChange)).toHaveLength(0);
    expect(rows(tree, 'Log again today')).toHaveLength(0);
    expect(rows(tree, 'Make it recurring')).toHaveLength(0);
  });
});

describe('deleting from the sheet', () => {
  it('asks once in place before it deletes', async () => {
    const tree = await render();
    const bin = () => rows(tree, 'Delete entry')[0] ?? rows(tree, 'Delete, tap again to confirm')[0];
    act(() => bin().props.onPress());
    expect(rows(tree, 'Delete, tap again to confirm').length).toBeGreaterThan(0);
  });

  it('puts the actions under the card, with no second page', async () => {
    const tree = await render();
    expect(tree.root.findAll((n) => n.props.value === 'details' && n.props.onChange)).toHaveLength(0);
    expect(rows(tree, 'Log again today').length).toBeGreaterThan(0);
    expect(rows(tree, 'Got money back').length).toBeGreaterThan(0);
  });
});

it('keeps a sensitive parent category masked when opening a child entry detail', async () => {
  mockHideAmounts = true;
  const tree = await render(lunch, [
    { id: 'parent', name: 'Investments', icon: 'tag', color: '#999999', isSensitive: true },
    { id: 'food', name: 'Child', icon: 'tag', color: '#999999', parentId: 'parent', isSensitive: false },
  ]);
  const shown = tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' ');
  expect(shown).toContain('••••');
  expect(shown).not.toContain('₹110');
});
