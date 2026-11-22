import { getDb } from './client';
import { recalculateAfterPrepayment } from '@/lib/loan';
import { scheduleAnchor } from './loanRows';
import type { LoanPaymentRow, LoanRow } from './rows';

const DONE_KEY = 'loans_whole_rupees_v1';
const wholeRupees = (minor: number) => Math.round(minor / 100) * 100;

/**
 * One-time tidy of loans saved before schedules were built in whole rupees: a bank debits a whole-rupee EMI, so an active
 * loan's EMI, balance and still-to-pay schedule go to whole rupees, and the entries of EMIs already paid are made the
 * whole-rupee amount the bank took. Paid history in the schedule and closed loans are left as they were. A loan whose
 * rounded EMI would not cover its interest is left untouched. Runs once (see DONE_KEY), in one transaction.
 * Returns how many loans changed.
 */
export async function convertLoansToWholeRupees(): Promise<number> {
  const db = await getDb();
  let changed = 0;
  await db.withTransactionAsync(async (tx) => {
    // Checked inside the transaction, so two overlapping runs cannot both go ahead.
    if (await tx.getFirstAsync('SELECT 1 FROM settings WHERE key = ?', [DONE_KEY])) return;
    const loans = await tx.getAllAsync<LoanRow>(
      "SELECT * FROM loans WHERE status = 'active' AND (emi_amount_minor % 100 != 0 OR outstanding_principal_minor % 100 != 0)"
    );
    for (const loan of loans) {
      let emi = Math.max(100, wholeRupees(loan.emi_amount_minor));
      const outstanding = wholeRupees(loan.outstanding_principal_minor);
      const pending = await tx.getAllAsync<LoanPaymentRow>(
        "SELECT * FROM loan_payments WHERE loan_id = ? AND status IN ('pending', 'overdue') ORDER BY installment_number",
        [loan.id]
      );
      if (pending.length === 0 || outstanding <= 0) continue;
      const first = pending[0];
      const anchor = await scheduleAnchor(tx, loan.id, first.installment_number, first.due_date);
      const build = () =>
        recalculateAfterPrepayment({
          loanId: loan.id,
          outstandingPrincipalMinor: outstanding,
          annualRateBp: loan.interest_rate_annual_bp,
          emiAmountMinor: emi,
          fromInstallmentNumber: first.installment_number,
          fromDate: anchor.fromDate,
          anchorInstallmentNumber: anchor.anchorInstallmentNumber,
        });
      let schedule = build();
      // An EMI rounded down can need one instalment more than the loan has left: take it up a rupee at a time (a few at most)
      // so the loan still ends on its last date.
      for (let i = 0; i < 20 && schedule.length > pending.length; i++) {
        emi += 100;
        schedule = build();
      }
      // The EMI did not cover the interest (or ran past the iteration cap): keep the loan as it is.
      if (schedule.length === 0 || schedule[schedule.length - 1].outstandingAfterMinor !== 0) continue;

      await tx.runAsync("DELETE FROM loan_payments WHERE loan_id = ? AND status IN ('pending', 'overdue')", [
        loan.id,
      ]);
      for (const inst of schedule) {
        await tx.runAsync(
          `INSERT INTO loan_payments
            (id, loan_id, installment_number, due_date, emi_amount_minor,
             principal_component_minor, interest_component_minor, outstanding_after_minor, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            inst.id,
            inst.loanId,
            inst.installmentNumber,
            inst.dueDate,
            inst.emiAmountMinor,
            inst.principalComponentMinor,
            inst.interestComponentMinor,
            inst.outstandingAfterMinor,
          ]
        );
      }
      // The last paid row's balance follows the loan's, so an Undo still sees the balance as unmoved.
      await tx.runAsync(
        `UPDATE loan_payments SET outstanding_after_minor = ?
         WHERE loan_id = ? AND status = 'paid' AND installment_number = ?`,
        [outstanding, loan.id, first.installment_number - 1]
      );
      await tx.runAsync(
        'UPDATE loans SET emi_amount_minor = ?, outstanding_principal_minor = ? WHERE id = ?',
        [emi, outstanding, loan.id]
      );
      // The entries of EMIs already paid become what the bank took: a whole rupee.
      await tx.runAsync(
        `UPDATE transactions SET amount_minor = ROUND(amount_minor / 100.0) * 100
         WHERE amount_minor % 100 != 0 AND ROUND(amount_minor / 100.0) > 0
           AND id IN (SELECT transaction_id FROM loan_payments WHERE loan_id = ? AND status = 'paid' AND transaction_id IS NOT NULL)`,
        [loan.id]
      );
      changed++;
    }
    await tx.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', [DONE_KEY, '1']);
  });
  return changed;
}

/** Whether the conversion is still to do: not yet run, and some active loan carries paise. */
export async function loansNeedWholeRupees(): Promise<boolean> {
  const db = await getDb();
  if (await db.getFirstAsync('SELECT 1 FROM settings WHERE key = ?', [DONE_KEY])) return false;
  return !!(await db.getFirstAsync(
    "SELECT 1 FROM loans WHERE status = 'active' AND (emi_amount_minor % 100 != 0 OR outstanding_principal_minor % 100 != 0) LIMIT 1"
  ));
}
