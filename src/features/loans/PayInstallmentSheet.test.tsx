/** Paying one EMI: the payment is saved first, and nothing after it may report it as a failure. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

const mockPay = jest.fn(async (..._a: unknown[]) => {});
const mockUndoPay = jest.fn(async (..._a: unknown[]) => {});
const mockShowUndo = jest.fn();
const mockAlert = jest.fn();

jest.mock('@/db/loans', () => ({
  payInstallment: (...a: unknown[]) => mockPay(...a),
  undoInstallmentPayment: (...a: unknown[]) => mockUndoPay(...a),
}));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn() } }));
jest.mock('@/lib/dataEvents', () => ({ emitTransactionsChanged: jest.fn() }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/SheetCard', () => ({ SheetCard: () => null }));
jest.mock('@/components/DateField', () => ({
  DateField: (p: { value: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'paid-on', value: p.value }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { PayInstallmentSheet } from './PayInstallmentSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import type { LoanPayment } from '@/types';

const todayIso = toLocalIsoDate(new Date());

const installment = (dueDate: string): LoanPayment =>
  ({
    id: 'i1',
    loanId: 'l1',
    installmentNumber: 3,
    dueDate,
    emiAmountMinor: 500_000,
    principalComponentMinor: 400_000,
    interestComponentMinor: 100_000,
    status: 'pending',
  }) as LoanPayment;

async function render(
  due: string,
  onPaid: () => void | Promise<void> = jest.fn(),
  onClose: () => void = jest.fn()
) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <PayInstallmentSheet
        installment={installment(due)}
        account={{ id: 'a1', name: 'Main' }}
        categoryId="c1"
        onClose={onClose}
        onPaid={onPaid}
      />
    );
  });
  return { tree, onPaid, onClose };
}

const press = async (tree: ReactTestRenderer) => {
  await act(async () => {
    await tree.root.findByType(PrimaryButton).props.onPress();
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockPay.mockReset().mockResolvedValue(undefined);
  mockUndoPay.mockClear();
  mockShowUndo.mockClear();
  mockAlert.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('pay installment sheet', () => {
  it('dates an EMI that is already due on its due date', async () => {
    const due = addDaysToIsoDate(todayIso, -10);
    const { tree } = await render(due);
    await press(tree);
    expect(mockPay).toHaveBeenCalledWith('i1', { accountId: 'a1', categoryId: 'c1', paidDate: due });
  });

  it('dates an early payment today, never in the future', async () => {
    const { tree } = await render(addDaysToIsoDate(todayIso, 12));
    expect(tree.root.findByProps({ testID: 'paid-on' }).props.value).toBe(todayIso);
    await press(tree);
    expect(mockPay).toHaveBeenCalledWith('i1', { accountId: 'a1', categoryId: 'c1', paidDate: todayIso });
  });

  it('refreshes, offers undo and closes after a saved payment', async () => {
    const { tree, onPaid, onClose } = await render(todayIso);
    await press(tree);
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(mockShowUndo).toHaveBeenCalledWith('Marked EMI #3 paid', expect.any(Function));
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not report a failed payment when only the refresh fails', async () => {
    const onPaid = jest.fn(async () => {
      throw new Error('reload broke');
    });
    const { tree } = await render(todayIso, onPaid);
    await press(tree);
    expect(mockPay).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalledWith("Couldn't record payment", expect.anything());
    expect(mockAlert.mock.calls[0][0]).toBe("Payment saved, couldn't refresh");
    expect(mockShowUndo).toHaveBeenCalled();
  });

  it('reports a payment that really failed and closes without offering undo', async () => {
    mockPay.mockRejectedValueOnce(new Error('db locked'));
    const { tree, onPaid, onClose } = await render(todayIso);
    await press(tree);
    expect(mockAlert).toHaveBeenCalledWith("Couldn't record payment", 'db locked');
    expect(onPaid).not.toHaveBeenCalled();
    expect(mockShowUndo).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('records only once when pressed twice while busy', async () => {
    let release!: () => void;
    mockPay.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const { tree } = await render(todayIso);
    const button = tree.root.findByType(PrimaryButton);
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    await act(async () => release());
    expect(mockPay).toHaveBeenCalledTimes(1);
  });

  it('does not close a sheet that has already unmounted', async () => {
    const { tree, onClose } = await render(todayIso);
    await press(tree);
    act(() => tree.unmount());
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
