import { createRealDataTestDb } from '@/test-support/realDataTestDb';
let mockDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
import { CREATE_TABLES_SQL } from './schema';
import { createAccount, getAccountBalance } from './accounts';
import { createTransaction, updateTransaction, deleteTransaction, getTransactionLink } from './transactions';
import { createRecurringRule, deleteRecurringRule, updateRecurringRule } from './recurring';
import {
  expectRefund,
  getExpectedRefund,
  receiveRefund,
  undoRefundReceipt,
  closeExpectedRefund,
  listExpectedRefunds,
} from './refundTracking';
import { prepareAnnualBill, getAnnualBillGoal, unlinkAnnualBill, annualPreparation } from './annualBills';
import { listSavingsGoals, contributeToGoal, updateSavingsGoal } from './savingsGoals';
import { estimatePurchase } from './purchaseAffordability';
import { createLoan } from './loanRecords';
import { getSpendingExplanation } from './spendingExplanation';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';
import { toLocalIsoDate, addDaysToIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { expenseLabelTotals } from './expenseLabels';
import { repairTrackedRefundLabels } from './refundLabels';
let bank: string, category: string, purchase: string;
const today = toLocalIsoDate(new Date());
beforeEach(async () => {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 1000000 }))
    .id;
  category = 'food';
  await mockDb.runAsync("INSERT INTO categories (id, name, kind) VALUES (?, 'Food', 'expense')", [category]);
  purchase = (
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: category,
      amountMinor: 100000,
      date: today,
    })
  ).id;
});
const yearly = () =>
  createRecurringRule({
    type: 'expense',
    accountId: bank,
    categoryId: category,
    amountMinor: 240000,
    frequency: 'yearly',
    intervalCount: 1,
    nextRunDate: addMonthsToIsoDate(today, 6),
    note: 'Insurance',
  });
it('keeps expected money outside balances, then records partial receipts atomically as refunds', async () => {
  const before = await getAccountBalance(bank);
  await expectRefund(purchase, 100000, addDaysToIsoDate(today, 7));
  expect(await getAccountBalance(bank)).toBe(before);
  await receiveRefund(purchase, { accountId: bank, amountMinor: 40000, date: today });
  expect(await getExpectedRefund(purchase)).toMatchObject({
    expectedMinor: 100000,
    receivedMinor: 40000,
    remainingMinor: 60000,
  });
  expect(await getAccountBalance(bank)).toBe(before + 40000);
  await expect(receiveRefund(purchase, { accountId: bank, amountMinor: 60001, date: today })).rejects.toThrow(
    'remaining'
  );
  expect(await getAccountBalance(bank)).toBe(before + 40000);
});
it('links a previously logged refund without double-counting and unlinks it without deleting money', async () => {
  await expectRefund(purchase, 100000, null);
  const logged = await createTransaction({
    type: 'income',
    isRefund: true,
    accountId: bank,
    categoryId: category,
    amountMinor: 20000,
    date: today,
  });
  const balance = await getAccountBalance(bank);
  await receiveRefund(purchase, {
    accountId: bank,
    amountMinor: 20000,
    date: today,
    existingRefundId: logged.id,
  });
  expect(await getAccountBalance(bank)).toBe(balance);
  await expect(
    receiveRefund(purchase, { accountId: bank, amountMinor: 20000, date: today, existingRefundId: logged.id })
  ).rejects.toThrow('unlinked');
  const receipt = (await getExpectedRefund(purchase))!.receipts[0];
  await undoRefundReceipt(receipt.id);
  expect(await getAccountBalance(bank)).toBe(balance);
  expect((await getExpectedRefund(purchase))!.receivedMinor).toBe(0);
});

it.each(['Shoes', '', 'Refund: user label'])(
  'keeps tracked refunds in the purchase label %j',
  async (note) => {
    await updateTransaction(purchase, {
      type: 'expense',
      accountId: bank,
      categoryId: category,
      amountMinor: 100000,
      date: today,
      note,
    });
    await expectRefund(purchase, 100000, null);
    await receiveRefund(purchase, { accountId: bank, amountMinor: 40000, date: today });
    expect(await expenseLabelTotals(today, today, false)).toEqual([
      { label: note, totalMinor: 60000, count: 1 },
    ]);
    await receiveRefund(purchase, { accountId: bank, amountMinor: 60000, date: today });
    expect(await expenseLabelTotals(today, today, false)).toEqual([{ label: note, totalMinor: 0, count: 1 }]);
    const receipts = (await getExpectedRefund(purchase))!.receipts;
    for (const receipt of receipts) {
      expect(
        await mockDb.getFirstAsync('SELECT note, is_refund FROM transactions WHERE id = ?', [
          receipt.transactionId,
        ])
      ).toEqual({ note, is_refund: 1 });
    }
  }
);

it.each(['Shoes', ''])(
  'repairs only generated legacy receipt labels on startup and restore (%j)',
  async (note) => {
    await updateTransaction(purchase, {
      type: 'expense',
      accountId: bank,
      categoryId: category,
      amountMinor: 100000,
      date: today,
      note,
    });
    await expectRefund(purchase, 100000, null);
    await receiveRefund(purchase, { accountId: bank, amountMinor: 20000, date: today });
    const generated = (await getExpectedRefund(purchase))!.receipts[0].transactionId;
    const legacyNote = `Refund: ${note || 'Food'}`;
    await mockDb.runAsync('UPDATE transactions SET note = ? WHERE id = ?', [legacyNote, generated]);
    const manual = await createTransaction({
      type: 'income',
      isRefund: true,
      accountId: bank,
      categoryId: category,
      amountMinor: 10000,
      date: today,
      note: legacyNote,
    });
    await receiveRefund(purchase, {
      accountId: bank,
      amountMinor: 10000,
      date: today,
      existingRefundId: manual.id,
    });
    await receiveRefund(purchase, { accountId: bank, amountMinor: 10000, date: today });
    const receipts = (await getExpectedRefund(purchase))!.receipts;
    const custom = receipts.find((r) => r.createdTransaction && r.transactionId !== generated)!.transactionId;
    await mockDb.runAsync('UPDATE transactions SET note = ? WHERE id = ?', ['Custom receipt label', custom]);
    const legacySnapshot = await buildBackupSnapshot();
    const assertLabels = async () => {
      expect(await mockDb.getFirstAsync('SELECT note FROM transactions WHERE id = ?', [generated])).toEqual({
        note,
      });
      expect(await mockDb.getFirstAsync('SELECT note FROM transactions WHERE id = ?', [manual.id])).toEqual({
        note: legacyNote,
      });
      expect(await mockDb.getFirstAsync('SELECT note FROM transactions WHERE id = ?', [custom])).toEqual({
        note: 'Custom receipt label',
      });
    };
    await repairTrackedRefundLabels(mockDb);
    await assertLabels();
    await repairTrackedRefundLabels(mockDb);
    await assertLabels();
    await restoreFromSnapshot(legacySnapshot);
    await assertLabels();
  }
);
it('guards linked entries and restores pending money when a created receipt is undone', async () => {
  await expectRefund(purchase, 100000, null);
  await receiveRefund(purchase, { accountId: bank, amountMinor: 100000, date: today });
  const receipt = (await getExpectedRefund(purchase))!.receipts[0];
  expect(await getTransactionLink(receipt.transactionId)).toMatchObject({ kind: 'refund-received' });
  await expect(deleteTransaction(purchase)).rejects.toThrow('linked');
  await expect(
    updateTransaction(purchase, {
      type: 'expense',
      accountId: bank,
      categoryId: category,
      amountMinor: 1,
      date: today,
    })
  ).rejects.toThrow('linked');
  await undoRefundReceipt(receipt.id);
  expect((await getExpectedRefund(purchase))!.remainingMinor).toBe(100000);
  await closeExpectedRefund(purchase);
  expect(await getTransactionLink(purchase)).toBeNull();
});
it('closes remaining expectations without pretending the money was received', async () => {
  await expectRefund(purchase, 100000, null);
  await receiveRefund(purchase, { accountId: bank, amountMinor: 10000, date: today });
  const balance = await getAccountBalance(bank);
  await closeExpectedRefund(purchase);
  expect(await listExpectedRefunds()).toHaveLength(0);
  expect(await getAccountBalance(bank)).toBe(balance);
  expect(await getExpectedRefund(purchase)).toMatchObject({ receivedMinor: 10000, closed: true });
});
it('rejects invalid expectations, dates and foreign-currency receipts', async () => {
  await expect(expectRefund(purchase, 100001, null)).rejects.toThrow('exceed');
  await expect(expectRefund(purchase, -1, null)).rejects.toThrow();
  await expectRefund(purchase, 100000, null);
  await expect(
    receiveRefund(purchase, { accountId: bank, amountMinor: 1000, date: addDaysToIsoDate(today, 1) })
  ).rejects.toThrow('actual received');
  const usd = (await createAccount({ name: 'USD', type: 'bank', currency: 'USD', openingBalanceMinor: 0 }))
    .id;
  await expect(receiveRefund(purchase, { accountId: usd, amountMinor: 1000, date: today })).rejects.toThrow(
    'currency'
  );
});
it('creates and links annual reservations without moving money, preserving unique goal ownership', async () => {
  const rule = await yearly(),
    balance = await getAccountBalance(bank);
  const goalId = await prepareAnnualBill(rule.id, { accountId: bank });
  expect(await getAccountBalance(bank)).toBe(balance);
  expect(await getAnnualBillGoal(rule.id)).toMatchObject({ id: goalId, reserved_amount_minor: 0 });
  await contributeToGoal(goalId, 120000);
  expect(annualPreparation(240000, 120000, addMonthsToIsoDate(today, 6), today).perMonthMinor).toBe(20000);
  await expect(deleteRecurringRule(rule.id)).rejects.toThrow('Unlink');
  await expect(
    updateRecurringRule(rule.id, {
      type: 'expense',
      accountId: bank,
      categoryId: category,
      amountMinor: 240000,
      frequency: 'monthly',
      intervalCount: 1,
      nextRunDate: today,
    })
  ).rejects.toThrow('Unlink');
  const goal = (await listSavingsGoals()).find((g) => g.id === goalId)!;
  await expect(
    updateSavingsGoal(goalId, {
      name: goal.name,
      targetAmountMinor: goal.targetAmountMinor,
      targetDate: goal.targetDate,
      linkedAccountId: bank,
      reservesAccount: false,
    })
  ).rejects.toThrow('Unlink');
  await unlinkAnnualBill(rule.id);
  expect((await listSavingsGoals()).find((g) => g.id === goalId)!.currentAmountMinor).toBe(120000);
});
it('includes reserved funds and future scheduled debits in purchase estimates', async () => {
  const rule = await yearly();
  const goalId = await prepareAnnualBill(rule.id, { accountId: bank });
  await contributeToGoal(goalId, 200000);
  await createRecurringRule({
    type: 'expense',
    accountId: bank,
    categoryId: category,
    amountMinor: 300000,
    frequency: 'monthly',
    intervalCount: 1,
    nextRunDate: addDaysToIsoDate(today, 3),
  });
  await expectRefund(purchase, 100000, null);
  const result = await estimatePurchase(bank, 500000, today);
  expect(result.reservedMinor).toBe(200000);
  expect(result.shortfallMinor).toBeGreaterThanOrEqual(100000);
  expect(await getAccountBalance(bank)).toBe(900000);
});

it('rejects an annual bill currency change atomically and keeps its backup restorable', async () => {
  const rule = await yearly();
  const goalId = await prepareAnnualBill(rule.id, { accountId: bank });
  await contributeToGoal(goalId, 120000);
  const foreign = await createAccount({ name: 'USD', type: 'bank', currency: 'USD', openingBalanceMinor: 0 });
  const before = await buildBackupSnapshot();
  await expect(
    updateRecurringRule(rule.id, { ...rule, accountId: foreign.id, amountMinor: 99999 })
  ).rejects.toThrow('same currency');
  const after = await buildBackupSnapshot();
  expect(after.tables.recurring_rules).toEqual(before.tables.recurring_rules);
  expect(after.tables.annual_bill_goals).toEqual(before.tables.annual_bill_goals);
  expect(after.tables.savings_goals).toEqual(before.tables.savings_goals);
  await expect(restoreFromSnapshot(after)).resolves.toEqual({ emptiedTables: [], skippedColumns: [] });
  expect((await getAnnualBillGoal(rule.id))!.reserved_amount_minor).toBe(120000);
});

it('allows a linked annual bill to move to another account in the same currency', async () => {
  const rule = await yearly();
  const goalId = await prepareAnnualBill(rule.id, { accountId: bank });
  const other = await createAccount({
    name: 'Other INR',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 0,
  });
  const updated = await updateRecurringRule(rule.id, { ...rule, accountId: other.id, amountMinor: 250000 });
  expect(updated).toMatchObject({ accountId: other.id, amountMinor: 250000 });
  expect((await getAnnualBillGoal(rule.id))!.id).toBe(goalId);
  await expect(restoreFromSnapshot(await buildBackupSnapshot())).resolves.toEqual({
    emptiedTables: [],
    skippedColumns: [],
  });
  await unlinkAnnualBill(rule.id);
  const foreign = await createAccount({ name: 'USD', type: 'bank', currency: 'USD', openingBalanceMinor: 0 });
  await expect(updateRecurringRule(rule.id, { ...updated, accountId: foreign.id })).resolves.toMatchObject({
    accountId: foreign.id,
  });
});
it('uses matching ranges and excludes foreign-currency and hidden category data', async () => {
  const previous = addDaysToIsoDate(today, -1);
  const usd = await createAccount({ name: 'Foreign', type: 'bank', currency: 'USD', openingBalanceMinor: 0 });
  await createTransaction({
    type: 'expense',
    accountId: usd.id,
    categoryId: category,
    amountMinor: 999999,
    date: today,
  });
  await createTransaction({
    type: 'expense',
    accountId: bank,
    categoryId: category,
    amountMinor: 40000,
    date: previous,
  });
  const result = await getSpendingExplanation(
    category,
    { start: today, end: today },
    { start: previous, end: previous },
    false
  );
  expect(result.deltaMinor).toBe(60000);
  expect(result.current.count).toBe(1);
  await mockDb.runAsync('UPDATE categories SET is_sensitive = 1 WHERE id = ?', [category]);
  expect(
    (
      await getSpendingExplanation(
        category,
        { start: today, end: today },
        { start: previous, end: previous },
        true
      )
    ).current.grossMinor
  ).toBe(0);
});
it('includes loan installments and warns when a schedule is missing', async () => {
  const loan = await createLoan({
    direction: 'borrowed',
    counterparty: 'Personal',
    principalMinor: 120000,
    interestRateAnnualBp: 0,
    tenureMonths: 12,
    startDate: today,
    linkedAccountId: bank,
  });
  const result = await estimatePurchase(bank, 10000, today);
  expect(result.movements.some((m) => m.label === 'Personal EMI')).toBe(true);
  expect(result.incompleteSchedule).toBe(false);
  await mockDb.runAsync('DELETE FROM loan_payments WHERE loan_id = ?', [loan.id]);
  expect((await estimatePurchase(bank, 10000, today)).incompleteSchedule).toBe(true);
});
it('rejects corrupt refund backups before replacing current data', async () => {
  await expectRefund(purchase, 100000, null);
  await receiveRefund(purchase, { accountId: bank, amountMinor: 1000, date: today });
  const snapshot = await buildBackupSnapshot();
  const receiptId = snapshot.tables.refund_receipts[0].transaction_id;
  snapshot.tables.transactions.find((row) => row.id === receiptId)!.amount_minor = -1;
  const balance = await getAccountBalance(bank);
  await expect(restoreFromSnapshot(snapshot)).rejects.toThrow('invalid refund receipt');
  expect(await getAccountBalance(bank)).toBe(balance);
});
it('restores format-2 snapshots without requiring the new planner tables', async () => {
  const snapshot = await buildBackupSnapshot();
  snapshot.formatVersion = 2;
  delete snapshot.tables.refund_expectations;
  delete snapshot.tables.refund_receipts;
  delete snapshot.tables.annual_bill_goals;
  await expectRefund(purchase, 100000, null);
  await restoreFromSnapshot(snapshot);
  expect(await getExpectedRefund(purchase)).toBeNull();
  expect(await getAccountBalance(bank)).toBe(900000);
});
it('round-trips the four features through the new backup format', async () => {
  const rule = await yearly();
  const goalId = await prepareAnnualBill(rule.id, { accountId: bank });
  await contributeToGoal(goalId, 10000);
  await expectRefund(purchase, 100000, today);
  await receiveRefund(purchase, { accountId: bank, amountMinor: 1000, date: today });
  const snapshot = await buildBackupSnapshot();
  expect(snapshot.formatVersion).toBe(6);
  await closeExpectedRefund(purchase);
  await unlinkAnnualBill(rule.id);
  await restoreFromSnapshot(snapshot);
  expect((await getExpectedRefund(purchase))!.remainingMinor).toBe(99000);
  expect((await getAnnualBillGoal(rule.id))!.id).toBe(goalId);
});

it('marks refunds by inherited category privacy without hiding ordinary refunds', async () => {
  await expectRefund(purchase, 50000, null);
  expect((await listExpectedRefunds())[0].isSensitive).toBe(false);
  await mockDb.runAsync(
    "INSERT INTO categories (id, name, kind, is_sensitive) VALUES ('private-parent', 'Private', 'expense', 1)"
  );
  await mockDb.runAsync("UPDATE categories SET parent_id = 'private-parent' WHERE id = ?", [category]);
  expect((await getExpectedRefund(purchase))!.isSensitive).toBe(true);
  expect((await listExpectedRefunds())[0].isSensitive).toBe(true);
});
it('flags a sensitive scheduled forecast without changing its financial calculation', async () => {
  const rule = await yearly();
  await updateRecurringRule(rule.id, { ...rule, nextRunDate: today });
  const normal = await estimatePurchase(bank, 10000, today);
  expect(normal.sensitiveForecast).toBe(false);
  await mockDb.runAsync('UPDATE categories SET is_sensitive = 1 WHERE id = ?', [category]);
  const hidden = await estimatePurchase(bank, 10000, today);
  expect(hidden.sensitiveForecast).toBe(true);
  expect(hidden.lowestMinor).toBe(normal.lowestMinor);
});
