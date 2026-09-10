/**
 * Every write in this app that touches more than one table goes through
 * db/client.ts's withTransactionAsync, whose callback receives a `tx`
 * handle that nested calls must use instead of the outer `db` (see
 * client.ts's own comment for why: the queue that makes concurrent screen
 * loads safe would deadlock a transaction against itself otherwise).
 * Getting that `tx` plumbing right in every single call site is exactly
 * the kind of thing that's easy to get wrong silently — recordMoneyGivenToPerson
 * and recordMoneyReceivedFromPerson were, until this fix, calling
 * createTransaction()/addLedgerEntry() from *inside* their own transaction,
 * which would have deadlocked forever the first time both ran under the
 * real serializing queue. This file runs every one of those write paths
 * against a real SQLite engine so a broken `tx` wire-up fails a test
 * instead of hanging a user's app.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
// loans.ts schedules a real OS notification on every write (due-date
// reminders); expo-notifications has no device to talk to under Jest, so
// it's stubbed out here rather than exercised — notification behavior has
// its own coverage elsewhere, this file is only about transaction safety.
jest.mock('@/lib/notifications', () => ({
  scheduleLoanDueReminder: async () => {},
  cancelLoanDueReminder: async () => {},
  notifyOverspend: async () => {},
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, listTransactions } from '@/db/ledger';
import {
  createLoan,
  getLoanSchedule,
  payInstallment,
  undoInstallmentPayment,
  applyRateChange,
  applyPrepayment,
  getLoanById,
  deleteLoan,
  updateLoanAsset,
  updateLoanAccount,
} from '@/db/loans';
import {
  createPerson,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  getPersonLedger,
  undoPersonTransaction,
  addLedgerEntry,
  deleteLedgerEntry,
} from '@/db/people';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';

describe('transaction-wrapped writes against a real SQLite engine', () => {
  let accountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    const account = await createAccount({
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    accountId = account.id;
    expenseCategoryId = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    incomeCategoryId = (await createCategory({ name: 'Salary', kind: 'income' })).id;
  });

  it('createLoan with a disbursement inserts the transaction, loan, and full schedule as one unit', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'HDFC',
      principalMinor: 1200000,
      interestRateAnnualBp: 900,
      tenureMonths: 12,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const schedule = await getLoanSchedule(loan.id);
    expect(schedule).toHaveLength(12);
    expect(loan.assetLabel).toBeNull();
    expect(loan.assetValueMinor).toBeNull();
    const txs = await listTransactions({ limit: 1000 });
    expect(txs.some((t) => t.note.includes('Loan disbursement'))).toBe(true);
  });

  it('payInstallment, undoInstallmentPayment, applyRateChange, and applyPrepayment all round-trip correctly', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'SBI',
      principalMinor: 600000,
      interestRateAnnualBp: 1000,
      tenureMonths: 6,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });

    let schedule = await getLoanSchedule(loan.id);
    await payInstallment(schedule[0].id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-02-01',
    });
    schedule = await getLoanSchedule(loan.id);
    expect(schedule[0].status).toBe('paid');
    let freshLoan = await getLoanById(loan.id);
    expect(freshLoan!.outstandingPrincipalMinor).toBe(schedule[0].outstandingAfterMinor);

    await undoInstallmentPayment(schedule[0].id);
    schedule = await getLoanSchedule(loan.id);
    expect(schedule[0].status).toBe('pending');
    freshLoan = await getLoanById(loan.id);
    expect(freshLoan!.outstandingPrincipalMinor).toBe(600000);

    await applyRateChange(loan.id, { newAnnualRateBp: 1100, effectiveDate: '2026-01-15' });
    schedule = await getLoanSchedule(loan.id);
    // A higher rate at a fixed EMI can add a remaining installment or two —
    // this only checks the regenerated schedule is well-formed (sequential,
    // resolves to zero), not the exact amortization math (loan.test.ts owns that).
    expect(schedule.length).toBeGreaterThanOrEqual(6);
    expect(schedule.map((p) => p.installmentNumber)).toEqual(
      Array.from({ length: schedule.length }, (_, i) => i + 1)
    );
    expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);

    await applyPrepayment(loan.id, {
      amountMinor: 100000,
      accountId,
      categoryId: expenseCategoryId,
      date: '2026-01-20',
    });
    freshLoan = await getLoanById(loan.id);
    expect(freshLoan!.outstandingPrincipalMinor).toBeLessThan(600000);
  });

  it('undoInstallmentPayment refuses to undo an installment out of order while a later one is still paid', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'OrderGuard Bank',
      principalMinor: 300000,
      interestRateAnnualBp: 800,
      tenureMonths: 6,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const schedule = await getLoanSchedule(loan.id);
    await payInstallment(schedule[0].id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-02-01',
    });
    await payInstallment(schedule[1].id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-03-01',
    });

    // #1 is paid, but #2 (later) is also paid — undoing #1 first would leave
    // #2's already-recorded interest computed against an outstanding
    // balance that no longer matches reality.
    await expect(undoInstallmentPayment(schedule[0].id)).rejects.toThrow('out of order');

    // The correct order — undo #2 (most recent) first — must still work.
    await undoInstallmentPayment(schedule[1].id);
    const after = await getLoanSchedule(loan.id);
    expect(after[0].status).toBe('paid');
    expect(after[1].status).toBe('pending');
  });

  it('applyRateChange refuses to touch a fixed-rate loan', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'FixedRate Bank',
      principalMinor: 200000,
      interestRateAnnualBp: 800,
      tenureMonths: 12,
      startDate: '2026-01-01',
      rateType: 'fixed',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    await expect(
      applyRateChange(loan.id, { newAnnualRateBp: 900, effectiveDate: '2026-02-01' })
    ).rejects.toThrow('floating-rate');
    const fresh = await getLoanById(loan.id);
    expect(fresh!.interestRateAnnualBp).toBe(800); // untouched
  });

  it('applyRateChange keepTenure mode changes the EMI instead of the tenure', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'KeepTenure Bank',
      principalMinor: 1000000,
      interestRateAnnualBp: 900,
      tenureMonths: 24,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const originalEmi = loan.emiAmountMinor;

    // Rate drops — keepTenure should lower the EMI and keep exactly 24
    // installments; keepEmi (the default, tested elsewhere) would instead
    // keep the EMI fixed and finish early.
    await applyRateChange(loan.id, { newAnnualRateBp: 700, effectiveDate: '2026-01-15', mode: 'keepTenure' });
    const schedule = await getLoanSchedule(loan.id);
    const fresh = await getLoanById(loan.id);

    expect(schedule).toHaveLength(24);
    expect(schedule[schedule.length - 1].installmentNumber).toBe(24);
    expect(schedule[schedule.length - 1].outstandingAfterMinor).toBe(0);
    expect(fresh!.emiAmountMinor).toBeLessThan(originalEmi);
    expect(fresh!.interestRateAnnualBp).toBe(700);
    // Every installment in the regenerated schedule uses the new, lower EMI.
    expect(schedule.every((p) => p.emiAmountMinor <= originalEmi)).toBe(true);
  });

  it('applyRateChange records a rate history entry with the given effective date, and rejects a date before the loan started', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'RateHistory Bank',
      principalMinor: 500000,
      interestRateAnnualBp: 850,
      tenureMonths: 36,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });

    await expect(
      applyRateChange(loan.id, { newAnnualRateBp: 800, effectiveDate: '2025-12-01' })
    ).rejects.toThrow("can't be before the loan itself started");

    // A backdated but valid effective date (the bank actually applied this
    // two "months" ago, only now being entered into Yume).
    await applyRateChange(loan.id, { newAnnualRateBp: 800, effectiveDate: '2026-01-20', mode: 'keepEmi' });
    const history = (await require('@/db/loans').getLoanRateHistory(loan.id)) as any[];
    expect(history).toHaveLength(1);
    expect(history[0].oldRateAnnualBp).toBe(850);
    expect(history[0].newRateAnnualBp).toBe(800);
    expect(history[0].effectiveDate).toBe('2026-01-20');
    expect(history[0].mode).toBe('keepEmi');
  });

  it('createLoan accepts an asset value, and updateLoanAsset can set/change/clear it later', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'HDFC Home Loan',
      principalMinor: 2200000_00,
      interestRateAnnualBp: 785,
      tenureMonths: 240,
      startDate: '2026-01-01',
      assetLabel: 'Home',
      assetValueMinor: 3500000_00,
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    expect(loan.assetLabel).toBe('Home');
    expect(loan.assetValueMinor).toBe(3500000_00);

    await updateLoanAsset(loan.id, { assetLabel: 'Home (revalued)', assetValueMinor: 3800000_00 });
    let fresh = await getLoanById(loan.id);
    expect(fresh!.assetLabel).toBe('Home (revalued)');
    expect(fresh!.assetValueMinor).toBe(3800000_00);

    await expect(updateLoanAsset(loan.id, { assetLabel: 'Home', assetValueMinor: -1 })).rejects.toThrow(
      'non-negative'
    );

    await updateLoanAsset(loan.id, { assetLabel: null, assetValueMinor: null });
    fresh = await getLoanById(loan.id);
    expect(fresh!.assetLabel).toBeNull();
    expect(fresh!.assetValueMinor).toBeNull();
  });

  it('updateLoanAccount changes which account future EMIs debit, rejects an unknown account, and never touches past payments', async () => {
    const otherAccount = await createAccount({
      name: 'Salary Account',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0,
    });
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'AccountSwitch Bank',
      principalMinor: 120000,
      interestRateAnnualBp: 0,
      tenureMonths: 12,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    expect(loan.linkedAccountId).toBe(accountId);

    const [firstInstallment] = await getLoanSchedule(loan.id);
    await payInstallment(firstInstallment.id, {
      accountId,
      categoryId: expenseCategoryId,
      paidDate: '2026-02-01',
    });
    const paidTx = (await listTransactions({ limit: 1000 })).find(
      (t) => t.id === firstInstallment.id || t.note?.includes('AccountSwitch Bank')
    );
    expect(paidTx?.accountId).toBe(accountId);

    await updateLoanAccount(loan.id, otherAccount.id);
    const fresh = await getLoanById(loan.id);
    expect(fresh!.linkedAccountId).toBe(otherAccount.id);

    // The already-paid installment's own transaction is untouched by the switch.
    const stillPaidTx = (await listTransactions({ limit: 1000 })).find((t) =>
      t.note?.includes('AccountSwitch Bank')
    );
    expect(stillPaidTx?.accountId).toBe(accountId);

    await expect(updateLoanAccount(loan.id, 'not-a-real-account')).rejects.toThrow('Account not found');
  });

  it('applyPrepayment rejects an amount larger than the outstanding balance', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'OverpayTest Bank',
      principalMinor: 50000,
      interestRateAnnualBp: 0,
      tenureMonths: 5,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    await expect(
      applyPrepayment(loan.id, {
        amountMinor: 999999,
        accountId,
        categoryId: expenseCategoryId,
        date: '2026-01-10',
      })
    ).rejects.toThrow('exceed the outstanding balance');
    const fresh = await getLoanById(loan.id);
    expect(fresh!.outstandingPrincipalMinor).toBe(50000); // untouched
    expect(fresh!.status).toBe('active'); // not incorrectly closed
  });

  it('applyPrepayment with a charge records it as a separate expense that never reduces outstanding principal', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'ChargeTest Bank',
      principalMinor: 500000,
      interestRateAnnualBp: 800,
      tenureMonths: 24,
      startDate: '2026-01-01',
      rateType: 'fixed',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const before = await getLoanById(loan.id);
    const txsBefore = (await listTransactions({ limit: 1000 })).length;

    await applyPrepayment(loan.id, {
      amountMinor: 100000,
      accountId,
      categoryId: expenseCategoryId,
      date: '2026-01-15',
      chargeAmountMinor: 2360, // e.g. 2% of 100000 + 18% GST on that = 2000 + 360
    });

    const after = await getLoanById(loan.id);
    // The charge must reduce outstanding by nothing beyond the actual
    // prepaid principal — a fee is not a repayment.
    expect(after!.outstandingPrincipalMinor).toBe(before!.outstandingPrincipalMinor - 100000);

    const txs = await listTransactions({ limit: 1000 });
    expect(txs).toHaveLength(txsBefore + 2); // the prepayment itself, plus the separate charge
    const chargeTx = txs.find((t) => t.note === `Prepayment charge — ChargeTest Bank`);
    expect(chargeTx).toBeDefined();
    expect(chargeTx!.type).toBe('expense');
    expect(chargeTx!.amountMinor).toBe(2360);
  });

  it('applyPrepayment with no charge specified behaves exactly as before (backward compatible)', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'NoChargeTest Bank',
      principalMinor: 200000,
      interestRateAnnualBp: 0,
      tenureMonths: 10,
      startDate: '2026-01-01',
      rateType: 'floating',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const txsBefore = (await listTransactions({ limit: 1000 })).length;
    await applyPrepayment(loan.id, {
      amountMinor: 50000,
      accountId,
      categoryId: expenseCategoryId,
      date: '2026-01-15',
    });
    const txsAfter = await listTransactions({ limit: 1000 });
    expect(txsAfter).toHaveLength(txsBefore + 1); // only the prepayment itself — no charge transaction at all
    expect(txsAfter.some((t) => t.note === 'Prepayment charge — NoChargeTest Bank')).toBe(false);
  });

  it('applyPrepayment rejects a negative prepayment charge', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'NegChargeTest Bank',
      principalMinor: 100000,
      interestRateAnnualBp: 0,
      tenureMonths: 5,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    await expect(
      applyPrepayment(loan.id, {
        amountMinor: 20000,
        accountId,
        categoryId: expenseCategoryId,
        date: '2026-01-15',
        chargeAmountMinor: -100,
      })
    ).rejects.toThrow('non-negative');
  });

  it('deleteLoan removes a loan with no real payments, but is blocked once a real payment is linked', async () => {
    const misEntered = await createLoan({
      direction: 'borrowed',
      counterparty: 'Mis-entered Test Loan',
      principalMinor: 500000,
      interestRateAnnualBp: 800,
      tenureMonths: 24,
      startDate: '2026-01-01',
      alreadyPaidInstallments: 20, // the exact kind of bad data this guard exists for
    });
    await deleteLoan(misEntered.id);
    expect(await getLoanById(misEntered.id)).toBeNull();

    const realLoan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Real Loan',
      principalMinor: 300000,
      interestRateAnnualBp: 800,
      tenureMonths: 12,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    const sched = await getLoanSchedule(realLoan.id);
    await payInstallment(sched[0].id, { accountId, categoryId: expenseCategoryId, paidDate: '2026-02-01' });
    await expect(deleteLoan(realLoan.id)).rejects.toThrow('undo those first');
    expect(await getLoanById(realLoan.id)).not.toBeNull();
  });

  it('deleteLoan cascades its disbursement/fee transactions instead of leaving them orphaned', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Cascade Test Loan',
      principalMinor: 200000,
      interestRateAnnualBp: 900,
      tenureMonths: 12,
      startDate: '2026-01-01',
      disbursement: {
        accountId,
        categoryId: incomeCategoryId,
        feeAmountMinor: 1500,
        feeCategoryId: expenseCategoryId,
      },
    });
    // Scoped to this test's own loan by counterparty name — the shared
    // in-memory DB accumulates disbursement transactions from every other
    // test's loans across this whole describe block (beforeAll runs once).
    const beforeDelete = await listTransactions({ limit: 1000 });
    expect(beforeDelete.some((t) => t.note === 'Loan disbursement — Cascade Test Loan')).toBe(true);
    expect(beforeDelete.some((t) => t.note === 'Loan processing fee — Cascade Test Loan')).toBe(true);

    await deleteLoan(loan.id);

    const afterDelete = await listTransactions({ limit: 1000 });
    expect(afterDelete.some((t) => t.note === 'Loan disbursement — Cascade Test Loan')).toBe(false);
    expect(afterDelete.some((t) => t.note === 'Loan processing fee — Cascade Test Loan')).toBe(false);
  });

  it('deleteLoan is blocked while a prepayment exists, since prepayments have no undo path yet', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Prepayment Delete Test',
      principalMinor: 300000,
      interestRateAnnualBp: 800,
      tenureMonths: 12,
      startDate: '2026-01-01',
      disbursement: { accountId, categoryId: incomeCategoryId },
    });
    await applyPrepayment(loan.id, {
      amountMinor: 50000,
      accountId,
      categoryId: expenseCategoryId,
      date: '2026-01-15',
    });
    await expect(deleteLoan(loan.id)).rejects.toThrow('prepayment');
    expect(await getLoanById(loan.id)).not.toBeNull();
  });

  it('recordMoneyGivenToPerson creates the expense transaction and the ledger entry together, atomically', async () => {
    const person = await createPerson({ name: 'Abhinav' });
    await recordMoneyGivenToPerson({
      personId: person.id,
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 50000,
      date: '2026-03-01',
      note: 'Dinner',
    });
    const ledger = await getPersonLedger(person.id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amountMinor).toBe(50000);
    expect(ledger[0].transactionId).not.toBeNull();

    const txs = await listTransactions({ limit: 1000 });
    const linkedTx = txs.find((t) => t.id === ledger[0].transactionId);
    expect(linkedTx?.type).toBe('expense');
    expect(linkedTx?.amountMinor).toBe(50000);
  });

  it('recordMoneyReceivedFromPerson creates the income transaction and a negative ledger entry, then undoPersonTransaction reverses both', async () => {
    const person = await createPerson({ name: 'Bharat' });
    await recordMoneyReceivedFromPerson({
      personId: person.id,
      accountId,
      categoryId: incomeCategoryId,
      amountMinor: 20000,
      date: '2026-03-05',
    });
    let ledger = await getPersonLedger(person.id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amountMinor).toBe(-20000);

    await undoPersonTransaction(ledger[0].transactionId!);
    ledger = await getPersonLedger(person.id);
    expect(ledger).toHaveLength(0);
  });

  it('deleteLedgerEntry removes a balance-only entry (no linked transaction) that undoPersonTransaction cannot reach', async () => {
    const person = await createPerson({ name: 'Chetan' });
    const entry = await addLedgerEntry({
      personId: person.id,
      amountMinor: 15000,
      date: '2026-03-10',
      note: 'Cash lent',
    });
    expect(entry.transactionId).toBeNull();

    await deleteLedgerEntry(entry.id);
    const ledger = await getPersonLedger(person.id);
    expect(ledger).toHaveLength(0);
  });

  it('deleteLedgerEntry on an account-linked entry also removes its transaction', async () => {
    const person = await createPerson({ name: 'Deepak' });
    await recordMoneyGivenToPerson({
      personId: person.id,
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 30000,
      date: '2026-03-11',
      note: 'Movie tickets',
    });
    const [entry] = await getPersonLedger(person.id);
    expect(entry.transactionId).not.toBeNull();

    await deleteLedgerEntry(entry.id);
    const ledger = await getPersonLedger(person.id);
    expect(ledger).toHaveLength(0);
    const txs = await listTransactions({ limit: 1000 });
    expect(txs.some((t) => t.id === entry.transactionId)).toBe(false);
  });

  it('restoreFromSnapshot replaces every table as one transaction', async () => {
    const snapshot = await buildBackupSnapshot();
    await restoreFromSnapshot(snapshot);
    const txs = await listTransactions({ limit: 1000 });
    expect(txs.length).toBe(snapshot.tables.transactions.length);
  });
});
