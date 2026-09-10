import { getDb } from './client';
import { newId } from '@/lib/id';
import { Loan, LoanPayment } from '@/types';
import { calculateEmi, generateAmortizationSchedule, recalculateAfterPrepayment } from '@/lib/loan';
import { formatMoney } from '@/lib/money';
import { scheduleLoanDueReminder, cancelLoanDueReminder } from '@/lib/notifications';

/** Schedules a reminder for the loan's next pending installment, or cancels any reminder if none remains. */
async function syncDueReminder(loanId: string): Promise<void> {
  const db = await getDb();
  const [loan, next] = await Promise.all([
    db.getFirstAsync<any>('SELECT * FROM loans WHERE id = ?', [loanId]),
    db.getFirstAsync<any>(
      `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'pending' ORDER BY installment_number ASC LIMIT 1`,
      [loanId]
    ),
  ]);
  if (!loan || !next || loan.direction !== 'borrowed' || loan.status !== 'active') {
    await cancelLoanDueReminder(loanId);
    return;
  }
  await scheduleLoanDueReminder(loanId, next.due_date, loan.counterparty, next.emi_amount_minor);
}

function rowToLoan(row: any): Loan {
  return {
    id: row.id,
    direction: row.direction,
    counterparty: row.counterparty,
    principalMinor: row.principal_minor,
    interestRateAnnualBp: row.interest_rate_annual_bp,
    tenureMonths: row.tenure_months,
    startDate: row.start_date,
    emiAmountMinor: row.emi_amount_minor,
    outstandingPrincipalMinor: row.outstanding_principal_minor,
    status: row.status,
    linkedAccountId: row.linked_account_id,
    rateType: row.rate_type ?? 'fixed',
    personId: row.person_id ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    nextDueDate: row.next_due_date ?? null,
    assetLabel: row.asset_label ?? null,
    assetValueMinor: row.asset_value_minor ?? null,
  };
}

// Shared by every query that returns full Loan rows — joins in the earliest
// pending installment's due date so the list screen can show "Next due"
// without a second round-trip per loan.
const LOAN_SELECT = `
  SELECT l.*,
    (SELECT due_date FROM loan_payments WHERE loan_id = l.id AND status = 'pending'
     ORDER BY installment_number ASC LIMIT 1) AS next_due_date
  FROM loans l`;

function rowToLoanPayment(row: any): LoanPayment {
  return {
    id: row.id,
    loanId: row.loan_id,
    transactionId: row.transaction_id,
    installmentNumber: row.installment_number,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    emiAmountMinor: row.emi_amount_minor,
    principalComponentMinor: row.principal_component_minor,
    interestComponentMinor: row.interest_component_minor,
    outstandingAfterMinor: row.outstanding_after_minor,
    status: row.status,
  };
}

export interface CreateLoanInput {
  direction: Loan['direction'];
  counterparty: string;
  principalMinor: number;
  interestRateAnnualBp: number;
  tenureMonths: number;
  startDate: string;
  linkedAccountId?: string | null;
  rateType?: Loan['rateType'];
  personId?: string | null;
  notes?: string;
  /**
   * What this loan financed (e.g. "Home", "Car") and its current value —
   * only meaningful for a borrowed loan. Recording one offsets this loan's
   * own net-worth contribution with the asset's real equity instead of
   * counting pure debt with nothing behind it. Omit both for a loan with no
   * real-world asset (a personal loan, a credit card) — the original
   * "assets aren't tracked" behavior for anyone who doesn't set one.
   */
  assetLabel?: string | null;
  assetValueMinor?: number | null;
  /**
   * How many installments were already paid before you started tracking
   * this loan in Yume (0 for a brand-new loan). Those installments are
   * marked 'paid' with no linked transaction — the app never fabricates
   * historical cash movements it didn't witness — and the loan's starting
   * outstanding balance is taken from the schedule at that point, not the
   * original principal. Mutually exclusive with `disbursement`: a loan you
   * already owe money on was disbursed before you started using the app.
   */
  alreadyPaidInstallments?: number;
  /**
   * The date the first EMI is actually due — separate from `startDate`
   * (the disbursement/sanction date) because real lenders routinely leave a
   * gap between the two (money disbursed mid-month, first EMI due the 1st
   * of a later month). Only meaningful alongside `disbursement`; ignored
   * for an already-in-progress loan, where `startDate` already means "first
   * EMI period" with no separate disbursement to offset from. Defaults to
   * `startDate` itself if omitted, matching the old undifferentiated behavior.
   */
  emiStartDate?: string;
  /**
   * If this loan's cash is moving right now (a new loan being taken out or
   * money being lent this moment), records that disbursement as a real
   * transaction in the same account: income for a borrowed loan (cash
   * arrives), expense for a lent loan (cash leaves). Omit for a
   * pre-existing loan (alreadyPaidInstallments > 0) — the disbursement
   * already happened outside the app and fabricating it now would distort
   * the account's current balance.
   *
   * `feeAmountMinor` covers the processing/documentation/franking charges a
   * lender almost always deducts at disbursement — a real, separate cash
   * outflow that has nothing to do with the loan principal or its
   * amortization schedule (the schedule always runs on the full sanctioned
   * amount). Recorded as its own expense transaction, same date and
   * account, rather than netted invisibly against the disbursement, so it
   * shows up in Reports/Categories like the real charge it is. Needs its
   * own `feeCategoryId` — for a borrowed loan, `categoryId` above is an
   * INCOME category (matching the disbursement itself), which can't also
   * tag an expense.
   */
  disbursement?: {
    accountId: string;
    categoryId: string;
    feeAmountMinor?: number;
    feeCategoryId?: string;
  } | null;
}

/**
 * Creates the loan and its full amortization schedule (plus, optionally,
 * the disbursement transaction) in one atomic write. Without a recorded
 * disbursement, adding a loan changes no account balance — it only starts
 * tracking payments from here on, which is correct for a loan you already
 * had before using the app but would silently overstate/understate net
 * worth for a brand-new loan if `disbursement` were skipped there too.
 */
export async function createLoan(input: CreateLoanInput): Promise<Loan> {
  if (
    !Number.isFinite(input.principalMinor) ||
    input.principalMinor <= 0 ||
    !Number.isFinite(input.interestRateAnnualBp) ||
    input.interestRateAnnualBp < 0 ||
    !Number.isFinite(input.tenureMonths) ||
    input.tenureMonths <= 0
  ) {
    throw new Error('Loan principal, interest rate, and tenure must be valid numbers');
  }
  const db = await getDb();
  const id = newId();
  const emi = calculateEmi(input.principalMinor, input.interestRateAnnualBp, input.tenureMonths);
  // A recorded disbursement can have its own date, distinct from when the
  // first EMI is actually due (see emiStartDate doc above) — an
  // already-in-progress loan has no disbursement to offset from, so its
  // single startDate always doubles as the schedule's own reference point.
  const scheduleStartDate = input.disbursement ? input.emiStartDate || input.startDate : input.startDate;
  const schedule = generateAmortizationSchedule({
    loanId: id,
    principalMinor: input.principalMinor,
    annualRateBp: input.interestRateAnnualBp,
    tenureMonths: input.tenureMonths,
    startDate: scheduleStartDate,
  });

  // Capped by the schedule's actual length, not tenureMonths — rounding can
  // make generateAmortizationSchedule close the loan out a installment or
  // two early (an "overshoot" closure absorbing residual paise), so a
  // tenureMonths-only cap could let `alreadyPaid` index past the real
  // schedule, silently falling back to the full original principal while
  // every generated installment still gets marked 'paid' below.
  const alreadyPaid = Math.max(0, Math.min(input.alreadyPaidInstallments ?? 0, schedule.length));
  const startingOutstanding =
    alreadyPaid > 0 && schedule[alreadyPaid - 1]
      ? schedule[alreadyPaid - 1].outstandingAfterMinor
      : input.principalMinor;
  const startingStatus = startingOutstanding === 0 ? 'closed' : 'active';

  const disbursementTxId = input.disbursement && alreadyPaid === 0 ? newId() : null;
  const feeAmountMinor = input.disbursement?.feeAmountMinor ?? 0;
  if (feeAmountMinor < 0 || !Number.isFinite(feeAmountMinor)) {
    throw new Error('Disbursement fee must be a valid, non-negative number');
  }
  if (
    input.assetValueMinor != null &&
    (!Number.isFinite(input.assetValueMinor) || input.assetValueMinor < 0)
  ) {
    throw new Error('Asset value must be a valid, non-negative number');
  }

  await db.withTransactionAsync(async (tx) => {
    // The loan row is inserted before its disbursement/fee transactions —
    // those now carry a loan_id FK back to this row (ON DELETE CASCADE), so
    // the loan must already exist or the insert would violate that
    // constraint.
    await tx.runAsync(
      `INSERT INTO loans
        (id, direction, counterparty, principal_minor, interest_rate_annual_bp, tenure_months,
         start_date, emi_amount_minor, outstanding_principal_minor, status, linked_account_id,
         rate_type, person_id, notes, asset_label, asset_value_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.direction,
        input.counterparty,
        input.principalMinor,
        input.interestRateAnnualBp,
        input.tenureMonths,
        input.startDate,
        emi,
        startingOutstanding,
        startingStatus,
        input.disbursement?.accountId ?? input.linkedAccountId ?? null,
        input.rateType ?? 'fixed',
        input.personId ?? null,
        input.notes ?? '',
        input.assetLabel ?? null,
        input.assetValueMinor ?? null,
      ]
    );

    if (disbursementTxId && input.disbursement) {
      await tx.runAsync(
        `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          disbursementTxId,
          input.direction === 'borrowed' ? 'income' : 'expense',
          input.disbursement.accountId,
          input.disbursement.categoryId,
          input.principalMinor,
          input.startDate,
          `Loan disbursement — ${input.counterparty}`,
          id,
        ]
      );
      if (feeAmountMinor > 0) {
        // Always an expense regardless of loan direction — deducted by the
        // lender (borrowed) or paid to formalize lending your own money out
        // (lent), either way real cash left the account through processing/
        // documentation charges, separate from the principal itself.
        await tx.runAsync(
          `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id)
           VALUES (?, 'expense', ?, ?, ?, ?, ?, ?)`,
          [
            newId(),
            input.disbursement.accountId,
            // For a lent loan, categoryId is already an expense category
            // (the disbursement itself is an expense) and doubles as the
            // fee's category too; for a borrowed loan it's an income
            // category and the caller must supply feeCategoryId instead.
            input.disbursement.feeCategoryId ?? input.disbursement.categoryId,
            feeAmountMinor,
            input.startDate,
            `Loan processing fee — ${input.counterparty}`,
            id,
          ]
        );
      }
    }

    for (let idx = 0; idx < schedule.length; idx++) {
      const inst = schedule[idx];
      const isAlreadyPaid = idx < alreadyPaid;
      await tx.runAsync(
        `INSERT INTO loan_payments
          (id, loan_id, installment_number, due_date, emi_amount_minor,
           principal_component_minor, interest_component_minor, outstanding_after_minor, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inst.id,
          inst.loanId,
          inst.installmentNumber,
          inst.dueDate,
          inst.emiAmountMinor,
          inst.principalComponentMinor,
          inst.interestComponentMinor,
          inst.outstandingAfterMinor,
          isAlreadyPaid ? 'paid' : 'pending',
        ]
      );
    }
  });

  await syncDueReminder(id);
  const row = await db.getFirstAsync<any>('SELECT * FROM loans WHERE id = ?', [id]);
  return rowToLoan(row);
}

export async function listLoans(): Promise<Loan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(`${LOAN_SELECT} ORDER BY l.created_at DESC`);
  return rows.map(rowToLoan);
}

/**
 * Re-schedules due reminders for every active borrowed loan — needed when
 * the "Bill & EMI due alerts" preference is turned on after loans already
 * exist, since reminders otherwise only get (re)scheduled at the moment a
 * loan is created or paid.
 */
export async function resyncAllLoanReminders(): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM loans WHERE direction = 'borrowed' AND status = 'active'`
  );
  for (const row of rows) {
    await syncDueReminder(row.id);
  }
}

export async function listLoansForPerson(personId: string): Promise<Loan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(`${LOAN_SELECT} WHERE l.person_id = ? ORDER BY l.created_at DESC`, [
    personId,
  ]);
  return rows.map(rowToLoan);
}

export async function getLoanById(id: string): Promise<Loan | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`${LOAN_SELECT} WHERE l.id = ?`, [id]);
  return row ? rowToLoan(row) : null;
}

export async function getLoanSchedule(loanId: string): Promise<LoanPayment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY installment_number ASC',
    [loanId]
  );
  return rows.map(rowToLoanPayment);
}

export interface LoanRateChange {
  id: string;
  loanId: string;
  oldRateAnnualBp: number;
  newRateAnnualBp: number;
  effectiveDate: string;
  mode: 'keepEmi' | 'keepTenure';
  oldEmiAmountMinor: number;
  newEmiAmountMinor: number;
}

/** Every recorded rate change for a loan, most recent effective date first — the answer to "when did this actually change". */
export async function getLoanRateHistory(loanId: string): Promise<LoanRateChange[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM loan_rate_changes WHERE loan_id = ? ORDER BY effective_date DESC, created_at DESC',
    [loanId]
  );
  return rows.map((row) => ({
    id: row.id,
    loanId: row.loan_id,
    oldRateAnnualBp: row.old_rate_annual_bp,
    newRateAnnualBp: row.new_rate_annual_bp,
    effectiveDate: row.effective_date,
    mode: row.mode,
    oldEmiAmountMinor: row.old_emi_amount_minor,
    newEmiAmountMinor: row.new_emi_amount_minor,
  }));
}

export interface NextDueInstallment {
  loanId: string;
  counterparty: string;
  emiAmountMinor: number;
  dueDate: string;
}

/** The single nearest pending installment across every active borrowed loan, for a Home-screen reminder. */
export async function getNextDueInstallment(): Promise<NextDueInstallment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT lp.emi_amount_minor as emi_amount_minor, lp.due_date as due_date, l.id as loan_id, l.counterparty as counterparty
     FROM loan_payments lp
     JOIN loans l ON l.id = lp.loan_id
     WHERE lp.status = 'pending' AND l.direction = 'borrowed' AND l.status = 'active'
     ORDER BY lp.due_date ASC
     LIMIT 1`
  );
  if (!row) return null;
  return {
    loanId: row.loan_id,
    counterparty: row.counterparty,
    emiAmountMinor: row.emi_amount_minor,
    dueDate: row.due_date,
  };
}

/**
 * Marks an installment paid: creates the linked transaction (expense if
 * borrowed, income if lent — money moving the opposite direction) and
 * updates the loan's outstanding principal.
 */
export async function payInstallment(
  loanPaymentId: string,
  opts: { accountId: string; categoryId: string; paidDate: string }
): Promise<void> {
  const db = await getDb();
  const payment = await db.getFirstAsync<any>('SELECT * FROM loan_payments WHERE id = ?', [loanPaymentId]);
  if (!payment) throw new Error('Loan payment not found');
  if (payment.status === 'paid') throw new Error('This installment has already been paid');
  const loan = await db.getFirstAsync<any>('SELECT * FROM loans WHERE id = ?', [payment.loan_id]);
  if (!loan) throw new Error('Loan not found');

  // The transaction insert lives inside the same withTransactionAsync block
  // as the loan_payments/loans updates (rather than going through the
  // higher-level createTransaction() beforehand) so a mid-write failure can
  // never leave an expense recorded with the loan's schedule left stale.
  const txId = newId();
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        loan.direction === 'borrowed' ? 'expense' : 'income',
        opts.accountId,
        opts.categoryId,
        payment.emi_amount_minor,
        opts.paidDate,
        `EMI #${payment.installment_number} — ${loan.counterparty}`,
      ]
    );
    await tx.runAsync(
      `UPDATE loan_payments SET status = 'paid', paid_date = ?, transaction_id = ? WHERE id = ?`,
      [opts.paidDate, txId, loanPaymentId]
    );
    await tx.runAsync(`UPDATE loans SET outstanding_principal_minor = ? WHERE id = ?`, [
      payment.outstanding_after_minor,
      payment.loan_id,
    ]);
    if (payment.outstanding_after_minor === 0) {
      await tx.runAsync(`UPDATE loans SET status = 'closed' WHERE id = ?`, [payment.loan_id]);
    }
  });
  await syncDueReminder(payment.loan_id);
}

/**
 * Records a rate change on a floating-rate loan. Real lenders offer the
 * borrower exactly this choice whenever the rate moves — reduce/increase
 * the EMI and keep paying off in the same number of months, or keep the
 * EMI exactly as-is and let the remaining tenure shrink/stretch instead:
 *
 * - `mode: 'keepEmi'` (the original, still the default) keeps the EMI fixed
 *   and regenerates the remaining schedule at the new rate — tenure
 *   lengthens (rate rose) or shortens (rate fell) instead. Same
 *   re-amortization approach `applyPrepayment` uses for a balance drop.
 * - `mode: 'keepTenure'` recomputes the EMI needed to still finish in
 *   exactly the same number of remaining installments at the new rate —
 *   the EMI itself drops (rate fell) or rises (rate rose) instead, and the
 *   payoff date never moves.
 */
export async function applyRateChange(
  loanId: string,
  opts: { newAnnualRateBp: number; effectiveDate: string; mode?: 'keepEmi' | 'keepTenure' }
): Promise<void> {
  if (!Number.isFinite(opts.newAnnualRateBp) || opts.newAnnualRateBp < 0) {
    throw new Error('New interest rate must be a valid, non-negative number');
  }
  if (!opts.effectiveDate) {
    throw new Error('Enter the date this rate change actually took effect');
  }
  const mode = opts.mode ?? 'keepEmi';
  const db = await getDb();
  const loan = await db.getFirstAsync<any>('SELECT * FROM loans WHERE id = ?', [loanId]);
  if (!loan) throw new Error('Loan not found');
  if (loan.rate_type !== 'floating') {
    throw new Error('Only floating-rate loans can have their rate updated');
  }
  if (opts.effectiveDate < loan.start_date) {
    throw new Error("The effective date can't be before the loan itself started.");
  }

  const paidInstallments = await db.getAllAsync<any>(
    `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'paid' ORDER BY installment_number DESC LIMIT 1`,
    [loanId]
  );
  const nextInstallmentNumber = paidInstallments.length ? paidInstallments[0].installment_number + 1 : 1;
  // Anchored to the installment's own original due date, not the date the
  // rate change was actually made — otherwise every future installment's
  // due-day silently shifts to whatever day of the month this happened to
  // be done on (e.g. a loan due on the 5th permanently moving to the 20th
  // just because that's when the rate was updated).
  const nextPending = await db.getFirstAsync<{ due_date: string }>(
    `SELECT due_date FROM loan_payments WHERE loan_id = ? AND installment_number = ?`,
    [loanId, nextInstallmentNumber]
  );
  const scheduleAnchorDate = nextPending?.due_date ?? opts.effectiveDate;

  // The EMI recalculateAfterPrepayment amortizes against — fixed (the old
  // EMI) in keepEmi mode, or freshly computed to close out in exactly the
  // remaining number of installments in keepTenure mode. Either way it's
  // then fed through the same schedule-regeneration path.
  const remainingMonths = loan.tenure_months - (nextInstallmentNumber - 1);
  if (mode === 'keepTenure' && remainingMonths <= 0) {
    throw new Error('This loan has no remaining installments to recalculate a tenure-preserving EMI over.');
  }
  const emiForSchedule =
    mode === 'keepTenure'
      ? calculateEmi(loan.outstanding_principal_minor, opts.newAnnualRateBp, remainingMonths)
      : loan.emi_amount_minor;

  const newSchedule =
    loan.outstanding_principal_minor > 0
      ? recalculateAfterPrepayment({
          loanId,
          outstandingPrincipalMinor: loan.outstanding_principal_minor,
          annualRateBp: opts.newAnnualRateBp,
          emiAmountMinor: emiForSchedule,
          fromInstallmentNumber: nextInstallmentNumber,
          fromDate: scheduleAnchorDate,
        })
      : [];

  // A rate high enough that the existing EMI no longer covers even the
  // interest accruing on the outstanding balance can never amortize —
  // recalculateAfterPrepayment defensively stops rather than looping
  // forever, which without this check would silently leave the loan
  // "active" with its full outstanding balance and zero future
  // installments: no error, no schedule, no way to ever pay it off again.
  // Only reachable in keepEmi mode — keepTenure always solves for an EMI
  // that covers the remaining term by construction.
  const stillOwesAfterSchedule = newSchedule.length
    ? newSchedule[newSchedule.length - 1].outstandingAfterMinor
    : loan.outstanding_principal_minor;
  if (mode === 'keepEmi' && stillOwesAfterSchedule > 0) {
    throw new Error(
      `At ${(opts.newAnnualRateBp / 100).toFixed(2)}% p.a., the current EMI of ${formatMoney(loan.emi_amount_minor)} doesn't even cover the monthly interest — this loan would never pay off. Increase the EMI (via a new loan entry) or choose a lower rate.`
    );
  }

  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync(`DELETE FROM loan_payments WHERE loan_id = ? AND status = 'pending'`, [loanId]);
    for (const inst of newSchedule) {
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
    const newEmiAmount = mode === 'keepTenure' ? emiForSchedule : loan.emi_amount_minor;
    await tx.runAsync(`UPDATE loans SET interest_rate_annual_bp = ?, emi_amount_minor = ? WHERE id = ?`, [
      opts.newAnnualRateBp,
      newEmiAmount,
      loanId,
    ]);
    // Recorded so "when did this rate actually change" has a real answer
    // later — previously nothing kept the old rate or the date once
    // interest_rate_annual_bp was overwritten above.
    await tx.runAsync(
      `INSERT INTO loan_rate_changes
        (id, loan_id, old_rate_annual_bp, new_rate_annual_bp, effective_date, mode, old_emi_amount_minor, new_emi_amount_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        loanId,
        loan.interest_rate_annual_bp,
        opts.newAnnualRateBp,
        opts.effectiveDate,
        mode,
        loan.emi_amount_minor,
        newEmiAmount,
      ]
    );
  });
  await syncDueReminder(loanId);
}

/**
 * Reverses payInstallment: deletes the linked transaction, puts the
 * installment back to 'pending', and restores the loan's outstanding
 * principal to what it was immediately before that payment. Only allowed on
 * the most recently paid installment for its loan — undoing an earlier one
 * while a later one is already paid would leave the schedule internally
 * inconsistent (the later installment's interest was already computed
 * against a lower outstanding balance than this undo would restore).
 */
export async function undoInstallmentPayment(loanPaymentId: string): Promise<void> {
  const db = await getDb();
  const payment = await db.getFirstAsync<any>('SELECT * FROM loan_payments WHERE id = ?', [loanPaymentId]);
  if (!payment) throw new Error('Loan payment not found');
  if (payment.status !== 'paid') throw new Error('This installment has not been paid');

  const laterPaid = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM loan_payments WHERE loan_id = ? AND status = 'paid' AND installment_number > ?`,
    [payment.loan_id, payment.installment_number]
  );
  if (laterPaid) {
    throw new Error(
      "Undo the most recently paid installment first — earlier ones can't be undone out of order."
    );
  }

  const previousInstallment = await db.getFirstAsync<{ outstanding_after_minor: number }>(
    'SELECT outstanding_after_minor FROM loan_payments WHERE loan_id = ? AND installment_number = ?',
    [payment.loan_id, payment.installment_number - 1]
  );
  const loan = await db.getFirstAsync<any>('SELECT * FROM loans WHERE id = ?', [payment.loan_id]);
  if (!loan) throw new Error('Loan not found');
  const restoredOutstanding = previousInstallment?.outstanding_after_minor ?? loan.principal_minor;

  await db.withTransactionAsync(async (tx) => {
    if (payment.transaction_id) {
      await tx.runAsync('DELETE FROM transactions WHERE id = ?', [payment.transaction_id]);
    }
    await tx.runAsync(
      `UPDATE loan_payments SET status = 'pending', paid_date = NULL, transaction_id = NULL WHERE id = ?`,
      [loanPaymentId]
    );
    await tx.runAsync(`UPDATE loans SET outstanding_principal_minor = ?, status = 'active' WHERE id = ?`, [
      restoredOutstanding,
      payment.loan_id,
    ]);
  });
  await syncDueReminder(payment.loan_id);
}

/**
 * Applies a lump-sum prepayment: reduces outstanding principal immediately,
 * then regenerates the remaining schedule (keeping EMI fixed, tenure shrinks).
 *
 * `chargeAmountMinor` is an optional prepayment/foreclosure charge some
 * lenders levy — recorded as its own separate expense transaction (a fee,
 * never part of the principal repayment), so it debits the account without
 * ever reducing outstanding principal or feeding into the amortization
 * schedule. Per RBI's Pre-payment Charges on Loans Directions, floating-rate
 * loans to individual borrowers (non-business) cannot legally carry this
 * charge at all — Yume never assumes one; it's purely what the caller
 * (the UI) passes in, since only the user's actual loan agreement knows the
 * real number for a fixed-rate loan.
 */
export async function applyPrepayment(
  loanId: string,
  opts: {
    amountMinor: number;
    accountId: string;
    categoryId: string;
    date: string;
    chargeAmountMinor?: number;
  }
): Promise<void> {
  if (!Number.isFinite(opts.amountMinor) || opts.amountMinor <= 0) {
    throw new Error('Prepayment amount must be a valid positive number');
  }
  if (
    opts.chargeAmountMinor != null &&
    (!Number.isFinite(opts.chargeAmountMinor) || opts.chargeAmountMinor < 0)
  ) {
    throw new Error('Prepayment charge must be a valid, non-negative number');
  }
  const db = await getDb();
  const loan = await db.getFirstAsync<any>('SELECT * FROM loans WHERE id = ?', [loanId]);
  if (!loan) throw new Error('Loan not found');
  // The UI already blocks this, but this function has no other caller-side
  // guarantee — an over-prepayment would otherwise record a transaction for
  // more cash than the loan needed, with the excess never tracked anywhere.
  if (opts.amountMinor > loan.outstanding_principal_minor) {
    throw new Error('Prepayment cannot exceed the outstanding balance');
  }

  const paidInstallments = await db.getAllAsync<any>(
    `SELECT * FROM loan_payments WHERE loan_id = ? AND status = 'paid' ORDER BY installment_number DESC LIMIT 1`,
    [loanId]
  );
  const nextInstallmentNumber = paidInstallments.length ? paidInstallments[0].installment_number + 1 : 1;
  // Anchored to the installment's own original due date, not the date the
  // prepayment happened to be made — see the identical note in
  // applyRateChange. Without this, paying extra on the 20th of the month
  // permanently drags every future EMI's due-day from (say) the 5th to the
  // 20th, and can silently clear an "overdue" flag on the next installment.
  const nextPending = await db.getFirstAsync<{ due_date: string }>(
    `SELECT due_date FROM loan_payments WHERE loan_id = ? AND installment_number = ?`,
    [loanId, nextInstallmentNumber]
  );
  const scheduleAnchorDate = nextPending?.due_date ?? opts.date;

  const newOutstanding = Math.max(0, loan.outstanding_principal_minor - opts.amountMinor);

  const newSchedule =
    newOutstanding > 0
      ? recalculateAfterPrepayment({
          loanId,
          outstandingPrincipalMinor: newOutstanding,
          annualRateBp: loan.interest_rate_annual_bp,
          emiAmountMinor: loan.emi_amount_minor,
          fromInstallmentNumber: nextInstallmentNumber,
          fromDate: scheduleAnchorDate,
        })
      : [];

  // Same guard `applyRateChange` already has: if the existing EMI can't
  // cover interest on what's left after this prepayment, recalculateAfterPrepayment
  // defensively stops early rather than looping forever — without this
  // check that silently leaves the loan "active" with a truncated schedule
  // and no future installments to ever close it.
  const stillOwesAfterSchedule = newSchedule.length
    ? newSchedule[newSchedule.length - 1].outstandingAfterMinor
    : newOutstanding;
  if (stillOwesAfterSchedule > 0) {
    throw new Error(
      `The current EMI of ${formatMoney(loan.emi_amount_minor)} doesn't cover the interest on the remaining balance after this prepayment — this loan would never pay off. Try a larger prepayment amount.`
    );
  }

  const txId = newId();
  const chargeAmountMinor = opts.chargeAmountMinor ?? 0;
  await db.withTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        loan.direction === 'borrowed' ? 'expense' : 'income',
        opts.accountId,
        opts.categoryId,
        opts.amountMinor,
        opts.date,
        `Prepayment — ${loan.counterparty}`,
        loanId,
      ]
    );
    if (chargeAmountMinor > 0) {
      // A real fee, always a cash outflow from the account regardless of
      // loan direction (even lending your own money out and getting repaid
      // early doesn't waive a bank's charge on the account the repayment
      // passes through) — always 'expense', never touches the loan schedule.
      await tx.runAsync(
        `INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note, loan_id)
         VALUES (?, 'expense', ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          opts.accountId,
          opts.categoryId,
          chargeAmountMinor,
          opts.date,
          `Prepayment charge — ${loan.counterparty}`,
          loanId,
        ]
      );
    }
    await tx.runAsync(`DELETE FROM loan_payments WHERE loan_id = ? AND status = 'pending'`, [loanId]);
    for (const inst of newSchedule) {
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
    await tx.runAsync(`UPDATE loans SET outstanding_principal_minor = ? WHERE id = ?`, [
      newOutstanding,
      loanId,
    ]);
    if (newOutstanding === 0) {
      await tx.runAsync(`UPDATE loans SET status = 'closed' WHERE id = ?`, [loanId]);
    }
  });
  await syncDueReminder(loanId);
}

/**
 * Removes a loan entirely — for fixing a mis-entered loan (e.g. a start
 * date and "already paid" count that don't agree with each other), not for
 * a loan that's simply paid off (that's `status: 'closed'`, still worth
 * keeping for history). Blocked whenever any installment has a real linked
 * transaction, or a prepayment was ever made — undo the real payment first
 * rather than silently deleting a loan out from under money that already
 * moved. (Prepayment currently has no undo path — a loan with one can't be
 * deleted at all yet, a known, honest limitation rather than the alternative
 * of quietly erasing the record of real cash that moved.)
 *
 * `loan_payments` rows cascade-delete with the loan (schema's own ON DELETE
 * CASCADE), and so do the loan's own disbursement/processing-fee
 * transactions (via transactions.loan_id, also ON DELETE CASCADE) — those
 * were created by, and only make sense alongside, this same loan entry, so
 * removing a mis-entered loan now takes them with it instead of leaving
 * them behind as orphaned "Loan disbursement" rows with nothing to point to.
 */
export async function deleteLoan(loanId: string): Promise<void> {
  const db = await getDb();
  const linkedPayment = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM loan_payments WHERE loan_id = ? AND transaction_id IS NOT NULL LIMIT 1`,
    [loanId]
  );
  if (linkedPayment) {
    throw new Error('This loan has real recorded payments — undo those first before deleting it.');
  }
  const prepayment = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM transactions WHERE loan_id = ? AND note LIKE 'Prepayment%' LIMIT 1`,
    [loanId]
  );
  if (prepayment) {
    throw new Error(
      "This loan has a recorded prepayment, which can't be undone yet — it can't be deleted while that exists."
    );
  }
  await db.runAsync('DELETE FROM loans WHERE id = ?', [loanId]);
  await cancelLoanDueReminder(loanId);
}

/**
 * Sets or updates the tracked value of whatever a loan financed (a home, a
 * vehicle) — separate from `createLoan` since a property's value is worth
 * revisiting occasionally (an appraisal, a market check), not just set once
 * at creation and forgotten. Pass `null` for both to stop tracking one.
 */
export async function updateLoanAsset(
  loanId: string,
  input: { assetLabel: string | null; assetValueMinor: number | null }
): Promise<void> {
  if (
    input.assetValueMinor != null &&
    (!Number.isFinite(input.assetValueMinor) || input.assetValueMinor < 0)
  ) {
    throw new Error('Asset value must be a valid, non-negative number');
  }
  const db = await getDb();
  await db.runAsync('UPDATE loans SET asset_label = ?, asset_value_minor = ? WHERE id = ?', [
    input.assetLabel,
    input.assetValueMinor,
    loanId,
  ]);
}

/**
 * Changes which account this loan's future EMIs default to. Only affects
 * payments made from here on — it never touches transactions already
 * recorded against the old account, matching how re-parenting a category or
 * changing a loan's rate never rewrites history either.
 */
export async function updateLoanAccount(loanId: string, accountId: string): Promise<void> {
  const db = await getDb();
  const account = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');
  await db.runAsync('UPDATE loans SET linked_account_id = ? WHERE id = ?', [accountId, loanId]);
}
