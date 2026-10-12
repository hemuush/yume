import { getDb } from './client';
import { newId } from '@/lib/id';
import { assertReservableAccount } from './goalReservations';
import { assertValidIsoDate, parseLocalIsoDate } from '@/lib/date';
export function annualPreparation(
  amountMinor: number,
  reservedMinor: number,
  dueDate: string,
  today: string
) {
  assertValidIsoDate(dueDate);
  assertValidIsoDate(today);
  if (![amountMinor, reservedMinor].every(Number.isSafeInteger) || amountMinor <= 0 || reservedMinor < 0)
    throw new Error('Invalid annual preparation amount.');
  const due = parseLocalIsoDate(dueDate),
    now = parseLocalIsoDate(today);
  const months = Math.max(
    1,
    (due.getFullYear() - now.getFullYear()) * 12 +
      due.getMonth() -
      now.getMonth() +
      (due.getDate() > now.getDate() ? 1 : 0)
  );
  const remainingMinor = Math.max(0, amountMinor - reservedMinor);
  return {
    remainingMinor,
    perMonthMinor: Math.ceil(remainingMinor / months),
    months,
    overdue: dueDate < today,
  };
}
export async function getAnnualBillGoal(ruleId: string) {
  return (await getDb()).getFirstAsync<{
    id: string;
    name: string;
    reserved_amount_minor: number;
    archived: number;
  }>(
    `SELECT g.id, g.name, g.reserved_amount_minor, g.archived FROM annual_bill_goals b JOIN savings_goals g ON g.id = b.goal_id WHERE b.rule_id = ?`,
    [ruleId]
  );
}
export async function prepareAnnualBill(
  ruleId: string,
  choice: { goalId: string } | { accountId: string }
): Promise<string> {
  let goalId = '';
  await (
    await getDb()
  ).withTransactionAsync(async (db) => {
    const rule = await db.getFirstAsync<{
      type: string;
      frequency: string;
      active: number;
      amount_minor: number;
      next_run_date: string;
      end_date: string | null;
      note: string;
      category_name: string;
      currency: string;
    }>(
      `SELECT r.*, c.name AS category_name, a.currency FROM recurring_rules r JOIN accounts a ON a.id = r.account_id LEFT JOIN categories c ON c.id = r.category_id WHERE r.id = ?`,
      [ruleId]
    );
    if (
      !rule ||
      !rule.active ||
      rule.type !== 'expense' ||
      rule.frequency !== 'yearly' ||
      (rule.end_date && rule.next_run_date > rule.end_date)
    )
      throw new Error('Choose a running yearly expense with a next payment.');
    const current = await db.getFirstAsync<{ goal_id: string }>(
      'SELECT goal_id FROM annual_bill_goals WHERE rule_id = ?',
      [ruleId]
    );
    if (current)
      throw new Error('This bill already has a preparation goal. Unlink it before choosing another.');
    if ('goalId' in choice) {
      const goal = await db.getFirstAsync<{
        reserve_account: number;
        archived: number;
        linked_account_id: string | null;
      }>('SELECT reserve_account, archived, linked_account_id FROM savings_goals WHERE id = ?', [
        choice.goalId,
      ]);
      if (!goal?.reserve_account || goal.archived || !goal.linked_account_id)
        throw new Error('Choose an active reservation goal.');
      await assertReservableAccount(db, goal.linked_account_id, choice.goalId);
      goalId = choice.goalId;
    } else {
      await assertReservableAccount(db, choice.accountId);
      goalId = newId();
      await db.runAsync(
        `INSERT INTO savings_goals (id, name, target_amount_minor, target_date, linked_account_id, reserve_account) VALUES (?, ?, ?, ?, ?, 1)`,
        [
          goalId,
          `Prepare: ${rule.note || rule.category_name || 'Annual bill'}`,
          rule.amount_minor,
          rule.next_run_date,
          choice.accountId,
        ]
      );
    }
    const funding = await db.getFirstAsync<{ currency: string }>(
      'SELECT a.currency FROM savings_goals g JOIN accounts a ON a.id = g.linked_account_id WHERE g.id = ?',
      [goalId]
    );
    if (funding?.currency !== rule.currency)
      throw new Error('The bill and preparation account must use the same currency.');
    const used = await db.getFirstAsync('SELECT rule_id FROM annual_bill_goals WHERE goal_id = ?', [goalId]);
    if (used) throw new Error('This goal already prepares another annual bill.');
    await db.runAsync('INSERT INTO annual_bill_goals (rule_id, goal_id) VALUES (?, ?)', [ruleId, goalId]);
  });
  return goalId;
}
export async function unlinkAnnualBill(ruleId: string): Promise<void> {
  await (await getDb()).runAsync('DELETE FROM annual_bill_goals WHERE rule_id = ?', [ruleId]);
}
