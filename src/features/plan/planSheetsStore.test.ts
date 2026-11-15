/** Which of Plan's sheets are open, and the payment lookup that opens one: one thing open at a time, newest request only. */
import type { Transaction } from '@/types';

const mockContext = jest.fn();
jest.mock('@/db/loans', () => ({ getLoanPaymentContext: (id: string) => mockContext(id) }));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));

import { createPlanSheets } from './planSheetsStore';

const tea = { id: 'tea' } as Transaction;
const context = { installment: { id: 'i1' }, direction: 'borrowed', account: null, categoryId: null };
beforeEach(() => {
  mockContext.mockReset();
  mockAlert.mockReset();
});

it('starts with everything closed', () => {
  expect(createPlanSheets().get()).toEqual({
    detail: null,
    refundTx: null,
    paying: null,
    creationMenu: false,
    comparisonOpen: false,
  });
});

it('opens a detail, and puts a refund’s entry away', () => {
  const sheets = createPlanSheets();
  sheets.openRefund(tea);
  sheets.openDetail('budget', 'b1');
  expect(sheets.get()).toMatchObject({ detail: { kind: 'budget', id: 'b1' }, refundTx: null });
  sheets.closeDetail();
  expect(sheets.get().detail).toBeNull();
});

it('opens a refund’s entry, and puts a detail away', () => {
  const sheets = createPlanSheets();
  sheets.openDetail('loan', 'l1');
  sheets.openRefund(tea);
  expect(sheets.get()).toMatchObject({ detail: null, refundTx: tea });
  sheets.closeRefund();
  expect(sheets.get().refundTx).toBeNull();
});

it('picks a row of "Add to your plan": the menu closes and the form opens', () => {
  const sheets = createPlanSheets();
  sheets.openMenu();
  expect(sheets.get().creationMenu).toBe(true);
  sheets.pickNew('new-goal');
  expect(sheets.get()).toMatchObject({ creationMenu: false, detail: { kind: 'new-goal', id: '' } });
});

it('opens and closes the loan comparison on its own', () => {
  const sheets = createPlanSheets();
  sheets.openDetail('loan', 'l1');
  sheets.openComparison();
  expect(sheets.get()).toMatchObject({ comparisonOpen: true, detail: { kind: 'loan', id: 'l1' } });
  sheets.closeComparison();
  expect(sheets.get().comparisonOpen).toBe(false);
});

it('tells subscribers on every change, and stops once they unsubscribe', () => {
  const sheets = createPlanSheets();
  const listener = jest.fn();
  const off = sheets.subscribe(listener);
  sheets.openMenu();
  sheets.closeMenu();
  expect(listener).toHaveBeenCalledTimes(2);
  off();
  sheets.openMenu();
  expect(listener).toHaveBeenCalledTimes(2);
});

describe('paying an installment from Coming up', () => {
  it('puts any detail or entry away, then opens the payment once its account and category are known', async () => {
    mockContext.mockResolvedValue(context);
    const sheets = createPlanSheets();
    sheets.openDetail('loan', 'l1');
    const paying = sheets.payEmi('l1');
    expect(sheets.get().detail).toBeNull();
    await paying;
    expect(mockContext).toHaveBeenCalledWith('l1');
    expect(sheets.get().paying).toBe(context);
    sheets.closePaying();
    expect(sheets.get().paying).toBeNull();
  });

  it('says so when nothing is due, and when the lookup fails', async () => {
    const sheets = createPlanSheets();
    mockContext.mockResolvedValueOnce(null);
    await sheets.payEmi('l1');
    expect(mockAlert).toHaveBeenCalledWith('Nothing to pay', expect.stringContaining('no installment'));
    mockContext.mockRejectedValueOnce(new Error('db locked'));
    await sheets.payEmi('l1');
    expect(mockAlert).toHaveBeenLastCalledWith('Couldn’t open the payment', 'db locked');
    expect(sheets.get().paying).toBeNull();
  });

  it('takes a second tap for nothing while the first is looking up', async () => {
    let finish!: (c: unknown) => void;
    mockContext.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const sheets = createPlanSheets();
    const first = sheets.payEmi('l1');
    await sheets.payEmi('l2');
    expect(mockContext).toHaveBeenCalledTimes(1);
    finish(context);
    await first;
    expect(sheets.get().paying).toBe(context);
  });

  it('never covers a detail opened after it, however slow the lookup', async () => {
    let finish!: (c: unknown) => void;
    mockContext.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const sheets = createPlanSheets();
    const paying = sheets.payEmi('l1');
    sheets.openDetail('budget', 'b1');
    finish(context);
    await paying;
    expect(sheets.get().paying).toBeNull();
    expect(sheets.get().detail).toEqual({ kind: 'budget', id: 'b1' });
    // And a new payment is accepted straight away.
    mockContext.mockResolvedValue(context);
    await sheets.payEmi('l1');
    expect(sheets.get().paying).toBe(context);
  });

  it('drops a lookup still in flight when Plan is left', async () => {
    let finish!: (c: unknown) => void;
    mockContext.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const sheets = createPlanSheets();
    const paying = sheets.payEmi('l1');
    sheets.cancelPayment();
    finish(context);
    await paying;
    expect(sheets.get().paying).toBeNull();
  });
});
