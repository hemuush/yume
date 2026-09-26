/**
 * Loan-state integrity fixes, against a real SQLite engine:
 *   - undoing an EMI paid after a prepayment restores the post-prepayment
 *     balance (it used to put the prepaid amount back on the loan)
 *   - keepTenure rate changes never add a phantom rounding installment
 *   - a lent loan's prepayment charge is filed under an expense category
 *   - loan-linked transactions carry their kind (loan_tx_kind)
 *   - prepayments count as principal repaid in the net-worth trend
 *   - runMigrations backfills loan_tx_kind and repairs month-end due dates
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
// Only the native modules client.ts touches at import time — runMigrations
// itself is exercised for real, against the harness below.
jest.mock('expo-sqlite', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('@/db/client', () => ({
  ...jest.requireActual('@/db/client'),
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({
  scheduleLoanDueReminder: async () => {},
  cancelLoanDueReminder: async () => {},
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { runMigrations, consumeLoanDueDateRepairs } from '@/db/client';
import { createAccount, createCategory } from '@/db/ledger';
import {
  createLoan,
  getLoanSchedule,
  getLoanById,
  payInstallment,
  undoInstallmentPayment,
  applyPrepayment,
  applyRateChange,
  deleteLoan,
  previewPrepayment,
  CreateLoanInput,
} from '@/db/loans';
import { getNetWorthTrend } from '@/db/reports';
import { setDefaultCurrency } from '@/db/settings';

describe('loan integrity', () => {
  let accountId: string;
  let emiCategoryId: string;
  let salaryCategoryId: string;
  let repaymentCategoryId: string;
  let feesCategoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    accountId = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
      .id;
    emiCategoryId = (await createCategory({ name: 'Loan EMI', kind: 'expense', sortOrder: 22 })).id;
    salaryCategoryId = (await createCategory({ name: 'Salary', kind: 'income', sortOrder: 0 })).id;
    repaymentCategoryId = (await createCategory({ name: 'Loan Repayment', kind: 'income', sortOrder: 5 })).id;
    feesCategoryId = (await createCategory({ name: 'Fees & Charges', kind: 'expense', sortOrder: 28 })).id;
    await mockTestDb.runAsync('UPDATE categories SET is_system = 1 WHERE id IN (?, ?, ?)', [
      emiCategoryId,
      repaymentCategoryId,
      feesCategoryId,
    ]);
  });

  const borrowed = (counterparty: string, extra: Partial<CreateLoanInput> = {}) =>
    createLoan({
      direction: 'borrowed',
      counterparty,
      principalMinor: 600000,
      interestRateAnnualBp: 1200,
      tenureMonths: 6,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId, categoryId: salaryCategoryId },
      ...extra,
    });

  it('undoing an EMI paid after a prepayment restores the post-prepayment balance, not the pre-prepayment one', async () => {
    const loan = await borrowed('Undo-After-Prepay Bank');
    let schedule = await getLoanSchedule(loan.id);
    await payInstallment(schedule[0].id, { accountId, categoryId: emiCategoryId, paidDate: '2026-01-01' });
    await applyPrepayment(loan.id, {
      amountMinor: 100000,
      accountId,
      categoryId: emiCategoryId,
      date: '2026-01-15',
    });
    const afterPrepay = (await getLoanById(loan.id))!.outstandingPrincipalMinor;
    expect(afterPrepay).toBe(schedule[0].outstandingAfterMinor - 100000);

    schedule = await getLoanSchedule(loan.id);
    const second = schedule.find((p) => p.installmentNumber === 2)!;
    await payInstallment(second.id, { accountId, categoryId: emiCategoryId, paidDate: '2026-02-01' });
    await undoInstallmentPayment(second.id);

    const restored = (await getLoanById(loan.id))!.outstandingPrincipalMinor;
    expect(restored).toBe(afterPrepay);
    // And the pending schedule is internally consistent with that balance again.
    const pendingSecond = (await getLoanSchedule(loan.id)).find((p) => p.installmentNumber === 2)!;
    expect(pendingSecond.status).toBe('pending');
    expect(pendingSecond.outstandingAfterMinor + pendingSecond.principalComponentMinor).toBe(restored);
  });

  it('undoing the very first EMI of a never-prepaid loan still restores the full principal', async () => {
    const loan = await borrowed('Plain Undo Bank');
    const [first] = await getLoanSchedule(loan.id);
    await payInstallment(first.id, { accountId, categoryId: emiCategoryId, paidDate: '2026-01-01' });
    await undoInstallmentPayment(first.id);
    expect((await getLoanById(loan.id))!.outstandingPrincipalMinor).toBe(600000);
  });

  it('a keepTenure rate change keeps exactly the remaining installments — no 1-paisa phantom EMI past the payoff date', async () => {
    const loan = await borrowed('KeepTenure Bank', { startDate: '2026-01-31' });
    const before = await getLoanSchedule(loan.id);
    await applyRateChange(loan.id, {
      newAnnualRateBp: 1200,
      effectiveDate: '2026-02-01',
      mode: 'keepTenure',
    });
    const after = await getLoanSchedule(loan.id);
    expect(after).toHaveLength(6);
    expect(after[after.length - 1].dueDate).toBe(before[before.length - 1].dueDate);
    expect(after[after.length - 1].outstandingAfterMinor).toBe(0);
    expect(after.reduce((s, p) => s + p.principalComponentMinor, 0)).toBe(600000);
    expect(after.every((p) => p.emiAmountMinor > 100)).toBe(true);
  });

  it("a lent loan's prepayment charge is filed as an expense under Fees & Charges, not the income category", async () => {
    const loan = await createLoan({
      direction: 'lent',
      counterparty: 'Lent Charge Friend',
      principalMinor: 300000,
      interestRateAnnualBp: 0,
      tenureMonths: 3,
      startDate: '2026-01-01',
    });
    await applyPrepayment(loan.id, {
      amountMinor: 50000,
      accountId,
      categoryId: repaymentCategoryId,
      date: '2026-01-10',
      chargeAmountMinor: 1000,
    });
    const rows = await mockTestDb.getAllAsync<{ type: string; category_id: string; loan_tx_kind: string }>(
      'SELECT type, category_id, loan_tx_kind FROM transactions WHERE loan_id = ? ORDER BY loan_tx_kind',
      [loan.id]
    );
    expect(rows).toEqual([
      { type: 'income', category_id: repaymentCategoryId, loan_tx_kind: 'prepayment' },
      { type: 'expense', category_id: feesCategoryId, loan_tx_kind: 'prepayment_charge' },
    ]);
  });

  it("a borrowed loan's prepayment charge keeps its existing category (unchanged behavior)", async () => {
    const loan = await borrowed('Borrowed Charge Bank');
    await applyPrepayment(loan.id, {
      amountMinor: 50000,
      accountId,
      categoryId: emiCategoryId,
      date: '2026-01-10',
      chargeAmountMinor: 1000,
    });
    const charge = await mockTestDb.getFirstAsync<{ category_id: string }>(
      `SELECT category_id FROM transactions WHERE loan_id = ? AND loan_tx_kind = 'prepayment_charge'`,
      [loan.id]
    );
    expect(charge!.category_id).toBe(emiCategoryId);
  });

  it('tags every loan-linked transaction with its kind, and deleteLoan still refuses a prepaid loan', async () => {
    const loan = await borrowed('Kinds Bank', {
      disbursement: {
        accountId,
        categoryId: salaryCategoryId,
        feeAmountMinor: 2000,
        feeCategoryId: feesCategoryId,
      },
    });
    let kinds = await mockTestDb.getAllAsync<{ loan_tx_kind: string }>(
      'SELECT loan_tx_kind FROM transactions WHERE loan_id = ? ORDER BY loan_tx_kind',
      [loan.id]
    );
    expect(kinds.map((k) => k.loan_tx_kind)).toEqual(['disbursement', 'fee']);

    await applyPrepayment(loan.id, {
      amountMinor: 10000,
      accountId,
      categoryId: emiCategoryId,
      date: '2026-01-05',
    });
    kinds = await mockTestDb.getAllAsync<{ loan_tx_kind: string }>(
      'SELECT loan_tx_kind FROM transactions WHERE loan_id = ? ORDER BY loan_tx_kind',
      [loan.id]
    );
    expect(kinds.map((k) => k.loan_tx_kind)).toEqual(['disbursement', 'fee', 'prepayment']);
    await expect(deleteLoan(loan.id)).rejects.toThrow('prepayment');
  });

  it('a prepayment leaves net worth unchanged (cash out, debt down) instead of showing phantom debt', async () => {
    const reference = new Date(2026, 1, 20); // Feb 20, 2026
    const loan = await borrowed('NetWorth Prepay Bank');
    const before = (await getNetWorthTrend(1, reference))[0].netWorthMinor;
    await applyPrepayment(loan.id, {
      amountMinor: 150000,
      accountId,
      categoryId: emiCategoryId,
      date: '2026-01-20',
    });
    const after = (await getNetWorthTrend(1, reference))[0].netWorthMinor;
    expect(after).toBe(before);
  });

  it('a loan closed by a full prepayment contributes no debt to the net-worth trend afterwards', async () => {
    const reference = new Date(2026, 1, 20);
    const loan = await borrowed('NetWorth Close Bank');
    const before = (await getNetWorthTrend(1, reference))[0].netWorthMinor;
    await applyPrepayment(loan.id, {
      amountMinor: 600000,
      accountId,
      categoryId: emiCategoryId,
      date: '2026-01-20',
    });
    expect((await getLoanById(loan.id))!.status).toBe('closed');
    const after = (await getNetWorthTrend(1, reference))[0].netWorthMinor;
    expect(after).toBe(before);
  });

  it('runMigrations backfills loan_tx_kind from the historical notes and repairs month-end due dates, idempotently', async () => {
    const loan = await borrowed('Migration Bank', {
      startDate: '2026-01-31',
      disbursement: {
        accountId,
        categoryId: salaryCategoryId,
        feeAmountMinor: 1500,
        feeCategoryId: feesCategoryId,
      },
    });
    // What an install on the old code actually had on disk: untagged loan
    // transactions, and pending dates from the old overflow month math.
    await mockTestDb.runAsync('UPDATE transactions SET loan_tx_kind = NULL WHERE loan_id = ?', [loan.id]);
    const legacyDates = ['2026-01-31', '2026-03-03', '2026-03-31', '2026-05-01', '2026-05-31', '2026-07-01'];
    for (let n = 1; n <= 6; n++) {
      await mockTestDb.runAsync(
        'UPDATE loan_payments SET due_date = ? WHERE loan_id = ? AND installment_number = ?',
        [legacyDates[n - 1], loan.id, n]
      );
    }
    consumeLoanDueDateRepairs(); // clear anything earlier tests left behind

    await runMigrations(mockTestDb);

    const kinds = await mockTestDb.getAllAsync<{ loan_tx_kind: string }>(
      'SELECT loan_tx_kind FROM transactions WHERE loan_id = ? ORDER BY loan_tx_kind',
      [loan.id]
    );
    expect(kinds.map((k) => k.loan_tx_kind)).toEqual(['disbursement', 'fee']);
    expect((await getLoanSchedule(loan.id)).map((p) => p.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
    ]);
    expect(consumeLoanDueDateRepairs()).toBe(3); // #2, #4, #6 — #3 and #5 were already right
    expect(consumeLoanDueDateRepairs()).toBe(0); // read once

    await runMigrations(mockTestDb);
    expect(consumeLoanDueDateRepairs()).toBe(0); // nothing left to repair
  });

  it('the due-date repair never touches paid installments', async () => {
    const loan = await borrowed('Paid History Bank', { startDate: '2026-01-31' });
    const [first, second] = await getLoanSchedule(loan.id);
    await payInstallment(first.id, { accountId, categoryId: emiCategoryId, paidDate: '2026-01-31' });
    await payInstallment(second.id, { accountId, categoryId: emiCategoryId, paidDate: '2026-02-28' });
    await mockTestDb.runAsync('UPDATE loan_payments SET due_date = ? WHERE id = ?', [
      '2026-03-03',
      second.id,
    ]);

    await runMigrations(mockTestDb);

    const paidSecond = (await getLoanSchedule(loan.id)).find((p) => p.id === second.id)!;
    expect(paidSecond.dueDate).toBe('2026-03-03');
  });

  it('previewPrepayment matches exactly what applyPrepayment then records, and writes nothing', async () => {
    const loan = await borrowed('Preview Bank', { startDate: '2026-01-31' });
    const [first] = await getLoanSchedule(loan.id);
    await payInstallment(first.id, { accountId, categoryId: emiCategoryId, paidDate: '2026-01-31' });

    const countRows = async () =>
      (await mockTestDb.getFirstAsync<{ n: number }>(
        'SELECT (SELECT COUNT(*) FROM transactions) + (SELECT COUNT(*) FROM loan_payments) AS n'
      ))!.n;
    const before = await countRows();
    const scheduleBefore = await getLoanSchedule(loan.id);

    const preview = await previewPrepayment(loan.id, 150000, '2026-02-10');
    expect(await countRows()).toBe(before);
    expect(await getLoanSchedule(loan.id)).toEqual(scheduleBefore);
    expect(preview).not.toBeNull();
    expect(preview!.neverPaysOff).toBe(false);
    expect(preview!.interestSavedMinor).toBeGreaterThan(0);

    const applied = await applyPrepayment(loan.id, {
      amountMinor: 150000,
      accountId,
      categoryId: emiCategoryId,
      date: '2026-02-10',
    });
    const { neverPaysOff, ...previewSummary } = preview!;
    expect(neverPaysOff).toBe(false);
    expect(applied).toEqual(previewSummary);
  });

  it('previewPrepayment returns null for an amount that could not be applied', async () => {
    const loan = await borrowed('Preview Null Bank');
    expect(await previewPrepayment(loan.id, 0, '2026-01-10')).toBeNull();
    expect(await previewPrepayment(loan.id, Number.NaN, '2026-01-10')).toBeNull();
    expect(await previewPrepayment(loan.id, 600001, '2026-01-10')).toBeNull(); // more than owed
    expect(await previewPrepayment('no-such-loan', 1000, '2026-01-10')).toBeNull();
    const full = await previewPrepayment(loan.id, 600000, '2026-01-10');
    expect(full).toMatchObject({ newRemainingCount: 0, neverPaysOff: false });
  });
});
