/**
 * A sweep of getPeriodSummary/getRangeComparison against a real SQLite
 * engine across many income × expense magnitude combinations, each isolated
 * to its own single day so 100 independent scenarios can share one
 * in-memory database without contaminating each other. None of these
 * scenarios move money into a savings-type account, so netMinor's third
 * term (see calculationScenarios's dedicated test for that case) is always
 * 0 here. Verifies the fundamental accounting identity — Net = Income − Expense — holds exactly
 * at every magnitude, plus the comparison percentage's sign always matches
 * the real direction of change.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction } from '@/db/ledger';
import { getPeriodSummary, getRangeComparison } from '@/db/reports';
import { setDefaultCurrency } from '@/db/settings';

const AMOUNTS = [0, 1, 100, 2500, 10000, 50000, 100000, 999999, 5000000, 25000000]; // minor units, 0 to ₹2.5L

function dayFromIndex(i: number): string {
  // 2030-01-01 plus i days — a far-future, never-otherwise-used range so
  // every combo below gets its own exclusive day with no risk of colliding
  // with dates used by any other test file sharing this describe block.
  const d = new Date(2030, 0, 1 + i);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

describe('report calculation matrix — every income × expense magnitude combination', () => {
  let accountId: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;
  let dayIndex = 0;

  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    accountId = (
      await createAccount({ name: 'ScenarioAccount', type: 'bank', currency: 'INR', openingBalanceMinor: 0 })
    ).id;
    incomeCategoryId = (await createCategory({ name: 'ScenarioIncome', kind: 'income' })).id;
    expenseCategoryId = (await createCategory({ name: 'ScenarioExpense', kind: 'expense' })).id;
  });

  for (const income of AMOUNTS) {
    for (const expense of AMOUNTS) {
      it(`income=${income} expense=${expense}: Net = Income − Expense, exactly`, async () => {
        const day = dayFromIndex(dayIndex++);
        if (income > 0) {
          await createTransaction({
            type: 'income',
            accountId,
            categoryId: incomeCategoryId,
            amountMinor: income,
            date: day,
          });
        }
        if (expense > 0) {
          await createTransaction({
            type: 'expense',
            accountId,
            categoryId: expenseCategoryId,
            amountMinor: expense,
            date: day,
          });
        }
        const summary = await getPeriodSummary({ start: day, end: day });
        expect(summary.incomeMinor).toBe(income);
        expect(summary.expenseMinor).toBe(expense);
        expect(summary.netMinor).toBe(income - expense);
      });
    }
  }

  it('getRangeComparison: a strictly higher expense period always reports a positive expenseChangePct', async () => {
    const lowDay = dayFromIndex(dayIndex++);
    const highDay = dayFromIndex(dayIndex++);
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 10000,
      date: lowDay,
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 20000,
      date: highDay,
    });
    const cmp = await getRangeComparison({ start: highDay, end: highDay }, { start: lowDay, end: lowDay });
    expect(cmp.expenseChangePct).toBeGreaterThan(0);
  });

  it('getRangeComparison: a strictly lower expense period always reports a negative expenseChangePct', async () => {
    const highDay = dayFromIndex(dayIndex++);
    const lowDay = dayFromIndex(dayIndex++);
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 30000,
      date: highDay,
    });
    await createTransaction({
      type: 'expense',
      accountId,
      categoryId: expenseCategoryId,
      amountMinor: 15000,
      date: lowDay,
    });
    const cmp = await getRangeComparison({ start: lowDay, end: lowDay }, { start: highDay, end: highDay });
    expect(cmp.expenseChangePct).toBeLessThan(0);
  });

  it('getRangeComparison: zero spend in both periods reports a 0% change, not null or NaN', async () => {
    const dayA = dayFromIndex(dayIndex++);
    const dayB = dayFromIndex(dayIndex++);
    const cmp = await getRangeComparison({ start: dayA, end: dayA }, { start: dayB, end: dayB });
    expect(cmp.expenseChangePct).toBe(0);
    expect(cmp.incomeChangePct).toBe(0);
  });
});
