/** Paying one EMI: the payment is saved first, and nothing after it may report it as a failure. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

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
jest.mock('@/components/DraftCard', () => ({ DraftCard: () => null }));
jest.mock('@/components/DateField', () => ({
  DateField: (p: { value: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'paid-on', value: p.value }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { PayInstallmentSheet } from './PayInstallmentSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DraftCard } from '@/components/DraftCard';
import { DateField } from '@/components/DateField';
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
  it('keeps an explicitly chosen past payment date and blocks a future date', async () => {
    const { tree } = await render(todayIso);
    act(() => tree.root.findByType(DateField).props.onChange(addDaysToIsoDate(todayIso, 1)));
    await press(tree);
    expect(mockPay).not.toHaveBeenCalled();
    const past = addDaysToIsoDate(todayIso, -2);
    act(() => tree.root.findByType(DateField).props.onChange(past));
    await press(tree);
    expect(mockPay).toHaveBeenCalledWith('i1', expect.objectContaining({ paidDate: past }));
  });

  it('distinguishes a completed undo from a subsequent refresh failure', async () => {
    const onPaid = jest.fn().mockResolvedValue(undefined);
    const { tree } = await render(todayIso, onPaid);
    await press(tree);
    onPaid.mockRejectedValueOnce(new Error('refresh failed'));
    await act(async () => mockShowUndo.mock.calls[0][1]());
    expect(mockUndoPay).toHaveBeenCalledWith('i1');
    expect(mockAlert).toHaveBeenCalledWith("Payment undone, couldn't refresh", expect.any(String));
    expect(mockAlert).not.toHaveBeenCalledWith("Couldn't undo", expect.any(String));
  });
  it('defaults the actual payment date to today even when the EMI is overdue', async () => {
    const due = addDaysToIsoDate(todayIso, -10);
    const { tree } = await render(due);
    expect(tree.root.findByType(DateField).props.maxDate).toBe(todayIso);
    await press(tree);
    expect(mockPay).toHaveBeenCalledWith('i1', { accountId: 'a1', categoryId: 'c1', paidDate: todayIso });
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
    expect(require('@/lib/haptics').haptics.confirm).toHaveBeenCalledTimes(1);
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

  it('keeps a failed payment open with the chosen date and allows retry', async () => {
    mockPay.mockRejectedValueOnce(new Error('db locked'));
    const { tree, onPaid, onClose } = await render(todayIso);
    await press(tree);
    expect(tree.root.findAllByType(Text).some((n) => n.props.children === 'db locked')).toBe(true);
    expect(onPaid).not.toHaveBeenCalled();
    expect(mockShowUndo).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await press(tree);
    expect(mockPay).toHaveBeenCalledTimes(2);
    expect(onPaid).toHaveBeenCalledTimes(1);
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

  it('does not refresh or close a new screen if the payment finishes after unmount', async () => {
    let release!: () => void;
    mockPay.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const { tree, onPaid, onClose } = await render(todayIso);
    let pending!: Promise<void>;
    act(() => {
      pending = tree.root.findByType(PrimaryButton).props.onPress();
    });
    act(() => tree.unmount());
    await act(async () => {
      release();
      await pending;
    });
    act(() => jest.advanceTimersByTime(1000));
    expect(onPaid).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShowUndo).not.toHaveBeenCalled();
  });

  it('describes a lent-loan receipt and adds it to the receiving account balance', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PayInstallmentSheet
          installment={installment(todayIso)}
          direction="lent"
          account={{ id: 'a1', name: 'Main' }}
          balanceMinor={100_000}
          categoryId="c1"
          onClose={jest.fn()}
          onPaid={jest.fn()}
        />
      );
    });
    expect(tree.root.findByType(DraftCard).props.title).toBe('Into Main');
    expect(tree.root.findByType(PrimaryButton).props.title).toBe('Record receipt');
    expect(tree.root.findByType(DraftCard).props.meta).toBe('Main after receiving: ₹6,000');
    await press(tree);
    expect(mockShowUndo).toHaveBeenCalledWith('Recorded EMI #3 received', expect.any(Function));
    act(() => tree.unmount());
  });
});
