/**
 * A person's money life on real SQLite, step by step. After each step the facts each screen reads (balances,
 * period summary, budget spend, carry) are compared to an independent running total, so disagreement fails.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import {
  createAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getAccountBalance,
  listAccounts,
  listTransactions,
  searchTransactions,
} from '@/db/ledger';
import { createBudget, listBudgetsForMonth } from '@/db/budgets';
import { createSavingsGoal, contributeToGoal, listSavingsGoals } from '@/db/savingsGoals';
import { createLoan, getLoanSchedule, payInstallment, undoInstallmentPayment } from '@/db/loans';
import {
  createPerson,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  undoPersonTransaction,
  listPeople,
} from '@/db/people';
import { getPeriodSummary, getCarryInMinor } from '@/db/reports';
import { setDefaultCurrency } from '@/db/settings';
import { archiveAccount } from '@/db/accounts';
import { listDeletedEntries, restoreDeletedEntry } from '@/db/recentlyDeleted';

const AUG = { start: '2026-08-01', end: '2026-08-31' };
const SEP = { start: '2026-09-01', end: '2026-09-30' };

describe('a user journey, checked on every screen’s numbers after each step', () => {
  let bank: string;
  let cash: string;
  let pot: string;
  let usd: string;
  let salary: string;
  let food: string;
  let fun: string;
  let emi: string;
  let repay: string;
  let lentOut: string;
  let friend: string;

  /** What the phone should hold across INR accounts, kept by hand from here. */
  let expectedCash = 0;

  const inrBalances = async () => {
    const accounts = await listAccounts();
    const inr = accounts.filter((a) => a.currency === 'INR');
    return { accounts: inr, total: inr.reduce((s, a) => s + a.currentBalanceMinor, 0) };
  };

  /** Every account's own balance query must agree with the list the screens show. */
  const expectBalancesConsistent = async () => {
    const { accounts, total } = await inrBalances();
    for (const a of accounts) expect(await getAccountBalance(a.id)).toBe(a.currentBalanceMinor);
    expect(total).toBe(expectedCash);
  };

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 100000 }))
      .id;
    cash = (await createAccount({ name: 'Wallet', type: 'cash', currency: 'INR', openingBalanceMinor: 5000 }))
      .id;
    pot = (await createAccount({ name: 'Pot', type: 'savings', currency: 'INR', openingBalanceMinor: 0 })).id;
    usd = (await createAccount({ name: 'Dollar', type: 'bank', currency: 'USD', openingBalanceMinor: 7000 }))
      .id;
    expectedCash = 105000;
    salary = (await createCategory({ name: 'Salary', kind: 'income' })).id;
    food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
    fun = (await createCategory({ name: 'Fun', kind: 'expense' })).id;
    emi = (await createCategory({ name: 'Loan EMI', kind: 'expense' })).id;
    repay = (await createCategory({ name: 'Loan Repayment', kind: 'income' })).id;
    lentOut = (await createCategory({ name: 'Lent', kind: 'expense' })).id;
    await mockTestDb.runAsync('UPDATE categories SET is_system = 1 WHERE id IN (?, ?)', [emi, repay]);
    friend = (await createPerson({ name: 'Test Friend' })).id;
  });

  it('starts with the opening balances and nothing else', async () => {
    await expectBalancesConsistent();
    expect(await getPeriodSummary(AUG)).toMatchObject({ incomeMinor: 0, expenseMinor: 0 });
    expect(await getCarryInMinor('2026-09-01')).toBe(0);
  });

  it('income and spending move the balance and the month together', async () => {
    await createTransaction({
      type: 'income',
      accountId: bank,
      categoryId: salary,
      amountMinor: 200000,
      date: '2026-08-01',
    });
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 30000,
      date: '2026-08-10',
    });
    await createTransaction({
      type: 'expense',
      accountId: cash,
      categoryId: fun,
      amountMinor: 2000,
      date: '2026-08-12',
    });
    expectedCash += 200000 - 30000 - 2000;
    await expectBalancesConsistent();
    const s = await getPeriodSummary(AUG);
    expect(s.incomeMinor).toBe(200000);
    expect(s.expenseMinor).toBe(32000);
    expect(s.netMinor).toBe(168000);
    expect(await getCarryInMinor('2026-09-01')).toBe(168000);
  });

  it('a transfer between accounts changes no total; into savings it leaves the free pool', async () => {
    await createTransaction({
      type: 'transfer',
      accountId: bank,
      toAccountId: cash,
      amountMinor: 10000,
      date: '2026-08-15',
    });
    await expectBalancesConsistent();
    expect((await getPeriodSummary(AUG)).netMinor).toBe(168000);
    await createTransaction({
      type: 'transfer',
      accountId: bank,
      toAccountId: pot,
      amountMinor: 20000,
      date: '2026-08-20',
    });
    await expectBalancesConsistent();
    const s = await getPeriodSummary(AUG);
    expect(s.savingsContributionMinor).toBe(20000);
    expect(s.netMinor).toBe(148000);
    expect(await getCarryInMinor('2026-09-01')).toBe(148000);
  });

  it('another currency never leaks into the rupee figures', async () => {
    await createTransaction({
      type: 'expense',
      accountId: usd,
      categoryId: food,
      amountMinor: 1000,
      date: '2026-08-21',
    });
    await expectBalancesConsistent();
    expect((await getPeriodSummary(AUG)).expenseMinor).toBe(32000);
    await expect(
      createTransaction({
        type: 'transfer',
        accountId: bank,
        toAccountId: usd,
        amountMinor: 500,
        date: '2026-08-22',
      })
    ).rejects.toThrow();
    await expectBalancesConsistent();
  });

  it('rejects the entries a person can type by mistake, and changes nothing', async () => {
    for (const amountMinor of [0, -500, NaN, Infinity]) {
      await expect(
        createTransaction({
          type: 'expense',
          accountId: bank,
          categoryId: food,
          amountMinor,
          date: '2026-08-23',
        })
      ).rejects.toThrow();
    }
    await expect(
      createTransaction({
        type: 'expense',
        accountId: bank,
        categoryId: food,
        amountMinor: 100,
        date: 'not-a-date',
      })
    ).rejects.toThrow();
    await expect(
      createTransaction({
        type: 'expense',
        accountId: bank,
        categoryId: food,
        amountMinor: 100,
        date: '2026-02-31',
      })
    ).rejects.toThrow();
    await expect(
      createTransaction({
        type: 'transfer',
        accountId: bank,
        toAccountId: bank,
        amountMinor: 100,
        date: '2026-08-23',
      })
    ).rejects.toThrow();
    await expectBalancesConsistent();
    expect((await getPeriodSummary(AUG)).expenseMinor).toBe(32000);
  });

  it('editing an entry’s amount, account and month moves every figure with it', async () => {
    const t = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 4000,
      date: '2026-08-25',
    });
    expectedCash -= 4000;
    await expectBalancesConsistent();
    await updateTransaction(t.id, {
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 6500,
      date: '2026-08-25',
    });
    expectedCash -= 2500;
    await expectBalancesConsistent();
    await updateTransaction(t.id, {
      type: 'expense',
      accountId: cash,
      categoryId: food,
      amountMinor: 6500,
      date: '2026-09-02',
    });
    await expectBalancesConsistent();
    expect((await getPeriodSummary(AUG)).expenseMinor).toBe(32000);
    expect((await getPeriodSummary(SEP)).expenseMinor).toBe(6500);
    await updateTransaction(t.id, {
      type: 'expense',
      accountId: cash,
      categoryId: food,
      amountMinor: 6500,
      date: '2026-08-25',
    });
    expect((await getPeriodSummary(AUG)).expenseMinor).toBe(38500);
    expect((await getPeriodSummary(SEP)).expenseMinor).toBe(0);
  });

  it('delete then undo puts back exactly what was there; Recently deleted can restore too', async () => {
    const before = await getPeriodSummary(AUG);
    const beforeBalances = (await inrBalances()).accounts.map((a) => [a.id, a.currentBalanceMinor]);
    const t = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: fun,
      amountMinor: 9900,
      date: '2026-08-26',
    });
    const snap = await deleteTransaction(t.id);
    expect(await getPeriodSummary(AUG)).toEqual(before);
    expect((await inrBalances()).accounts.map((a) => [a.id, a.currentBalanceMinor])).toEqual(beforeBalances);
    await restoreTransaction(snap);
    expect((await getPeriodSummary(AUG)).expenseMinor).toBe(before.expenseMinor + 9900);
    expectedCash -= 9900;
    await expectBalancesConsistent();

    const t2 = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: fun,
      amountMinor: 1100,
      date: '2026-08-27',
    });
    await deleteTransaction(t2.id);
    const deleted = await listDeletedEntries();
    const entry = deleted.find((d) => JSON.stringify(d).includes(t2.id));
    expect(entry).toBeDefined();
    await restoreDeletedEntry(entry!.id);
    expectedCash -= 1100;
    await expectBalancesConsistent();
  });

  it('a refund hands money back and lowers the month’s spend instead of counting as income', async () => {
    const before = await getPeriodSummary(AUG);
    await createTransaction({
      type: 'income',
      accountId: bank,
      categoryId: food,
      amountMinor: 2500,
      date: '2026-08-28',
      isRefund: true,
    });
    expectedCash += 2500;
    await expectBalancesConsistent();
    const after = await getPeriodSummary(AUG);
    expect(after.incomeMinor).toBe(before.incomeMinor);
    expect(after.expenseMinor).toBe(before.expenseMinor - 2500);
  });

  it('a budget’s spend matches the category’s spend in the summary, and flags when exceeded', async () => {
    await createBudget({
      categoryId: food,
      periodMonth: '2026-08',
      limitAmountMinor: 30000,
      rollover: false,
    });
    const [b] = await listBudgetsForMonth('2026-08');
    const inSummary = (await getPeriodSummary(AUG)).categoryBreakdown.find((c) => c.categoryId === food);
    expect(b.spentMinor).toBe(inSummary?.totalMinor);
    expect(b.overBudget).toBe(true);
  });

  it('a loan: disbursal, an EMI, and undoing it all keep balances and the schedule honest', async () => {
    const loan = await createLoan({
      direction: 'borrowed',
      counterparty: 'Test Lender',
      principalMinor: 120000,
      interestRateAnnualBp: 1200,
      tenureMonths: 6,
      startDate: '2026-09-01',
      rateType: 'floating',
      disbursement: { accountId: bank, categoryId: salary },
    });
    expectedCash += 120000;
    await expectBalancesConsistent();
    const schedule = await getLoanSchedule(loan.id);
    expect(schedule).toHaveLength(6);
    const first = schedule[0];
    await payInstallment(first.id, { accountId: bank, categoryId: emi, paidDate: '2026-09-05' });
    expectedCash -= first.emiAmountMinor;
    await expectBalancesConsistent();
    await expect(
      payInstallment(first.id, { accountId: bank, categoryId: emi, paidDate: '2026-09-05' })
    ).rejects.toThrow();
    await undoInstallmentPayment(first.id);
    expectedCash += first.emiAmountMinor;
    await expectBalancesConsistent();
    expect((await getLoanSchedule(loan.id))[0].status).not.toBe('paid');
  });

  it('a friend: lend, get paid back, undo — the balance owed and the cash agree', async () => {
    await recordMoneyGivenToPerson({
      personId: friend,
      accountId: bank,
      categoryId: lentOut,
      amountMinor: 8000,
      date: '2026-09-06',
    });
    expectedCash -= 8000;
    await expectBalancesConsistent();
    let person = (await listPeople()).find((p) => p.id === friend);
    expect(JSON.stringify(person)).toContain('8000');
    await recordMoneyReceivedFromPerson({
      personId: friend,
      accountId: bank,
      categoryId: repay,
      amountMinor: 8000,
      date: '2026-09-07',
    });
    expectedCash += 8000;
    await expectBalancesConsistent();
    person = (await listPeople()).find((p) => p.id === friend);
    expect(JSON.stringify(person)).not.toContain('8000');
    const back = (await listTransactions({ limit: 50 })).find(
      (t) => t.categoryId === repay && t.amountMinor === 8000
    );
    await undoPersonTransaction(back!.id);
    expectedCash -= 8000;
    await expectBalancesConsistent();
  });

  it('a goal: adding, removing past zero, and going over the target never produce a negative or NaN', async () => {
    const g = await createSavingsGoal({
      name: 'Trip',
      targetAmountMinor: 10000,
      targetDate: null,
      linkedAccountId: null,
    });
    await contributeToGoal(g.id, 4000);
    await contributeToGoal(g.id, -9000);
    let goal = (await listSavingsGoals()).find((x) => x.id === g.id)!;
    expect(goal.currentAmountMinor).toBe(0);
    await contributeToGoal(g.id, 25000);
    goal = (await listSavingsGoals()).find((x) => x.id === g.id)!;
    expect(goal.currentAmountMinor).toBe(25000);
    await expect(contributeToGoal(g.id, 0)).rejects.toThrow();
    await expectBalancesConsistent();
  });

  it('search finds an entry by note, amount and category, and not after it is deleted', async () => {
    const t = await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: fun,
      amountMinor: 31337,
      date: '2026-09-08',
      note: 'zebra tickets',
    });
    expectedCash -= 31337;
    expect((await searchTransactions('zebra')).map((x) => x.id)).toContain(t.id);
    expect((await searchTransactions('313.37')).map((x) => x.id)).toContain(t.id);
    await deleteTransaction(t.id);
    expectedCash += 31337;
    expect((await searchTransactions('zebra')).map((x) => x.id)).not.toContain(t.id);
    await expectBalancesConsistent();
  });

  it('archiving an account takes it off the list but keeps its balance and history', async () => {
    const extra = (
      await createAccount({ name: 'Old card', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    await createTransaction({
      type: 'expense',
      accountId: extra,
      categoryId: fun,
      amountMinor: 700,
      date: '2026-09-09',
    });
    await archiveAccount(extra);
    expect((await listAccounts()).map((a) => a.id)).not.toContain(extra);
    expect((await listAccounts(true)).map((a) => a.id)).toContain(extra);
    expect(await getAccountBalance(extra)).toBe(-700);
    expect((await listTransactions({ limit: 200 })).some((t) => t.accountId === extra)).toBe(true);
  });

  it('the running carry equals the sum of every earlier month’s own figure', async () => {
    const aug = await getPeriodSummary(AUG);
    const sep = await getPeriodSummary(SEP);
    expect(await getCarryInMinor('2026-09-01')).toBe(aug.netMinor);
    expect(await getCarryInMinor('2026-10-01')).toBe(aug.netMinor + sep.netMinor);
  });
});
