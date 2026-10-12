import { getDb } from './client';
import { reservationSummaryOn } from './goalReservations';
import { purchaseAffordability, PurchaseMovement } from '@/lib/purchaseAffordability';
import { advanceDate } from '@/lib/recurrence';
import { addDaysToIsoDate, dayOfIsoDate, toLocalIsoDate } from '@/lib/date';
import { RecurringRuleRow } from './rows';
export async function estimatePurchase(accountId: string, amountMinor: number, purchaseDate: string) {
  const today = toLocalIsoDate(new Date());
  const through = addDaysToIsoDate(purchaseDate, 30);
  return (await getDb()).exclusiveAsync(async (db) => {
    const account = await db.getFirstAsync<{
      type: string;
      currency: string;
      tracked: number;
      archived: number;
    }>('SELECT type, currency, tracked, archived FROM accounts WHERE id = ?', [accountId]);
    if (!account || account.archived || account.tracked || !['bank', 'cash', 'wallet'].includes(account.type))
      throw new Error('Choose an active spending account.');
    const summary = await reservationSummaryOn(db, accountId);
    const movements: PurchaseMovement[] = [];
    const rules = await db.getAllAsync<RecurringRuleRow>(
      'SELECT * FROM recurring_rules WHERE active = 1 AND (account_id = ? OR to_account_id = ?)',
      [accountId, accountId]
    );
    for (const rule of rules) {
      let date = rule.next_run_date;
      const anchor = rule.anchor_day ?? dayOfIsoDate(date);
      for (let n = 0; date <= through && (!rule.end_date || date <= rule.end_date); n++) {
        if (n >= 400) throw new Error('Catch up overdue recurring entries before estimating this purchase.');
        const credit =
          rule.type === 'income' || (rule.type === 'transfer' && rule.to_account_id === accountId);
        movements.push({
          date,
          deltaMinor: credit ? rule.amount_minor : -rule.amount_minor,
          label: rule.note || 'Scheduled entry',
        });
        const next = advanceDate(date, rule.frequency, rule.interval_count, anchor);
        if (next <= date) throw new Error('Fix this recurring schedule before estimating.');
        date = next;
      }
    }
    const payments = await db.getAllAsync<{
      due_date: string;
      emi_amount_minor: number;
      counterparty: string;
    }>(
      `SELECT p.due_date, p.emi_amount_minor, l.counterparty FROM loan_payments p JOIN loans l ON l.id = p.loan_id
       WHERE l.direction = 'borrowed' AND l.status = 'active' AND l.linked_account_id = ? AND p.status IN ('pending', 'overdue') AND p.due_date <= ?`,
      [accountId, through]
    );
    for (const p of payments)
      movements.push({ date: p.due_date, deltaMinor: -p.emi_amount_minor, label: `${p.counterparty} EMI` });
    const incomplete = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM loans l WHERE l.direction = 'borrowed' AND l.status = 'active' AND l.outstanding_principal_minor > 0 AND l.linked_account_id = ?
       AND NOT EXISTS (SELECT 1 FROM loan_payments p WHERE p.loan_id = l.id AND p.status IN ('pending', 'overdue'))`,
      [accountId]
    );
    return {
      ...purchaseAffordability({
        balanceMinor: summary.balanceMinor,
        reservedMinor: summary.reservedMinor,
        amountMinor,
        today,
        purchaseDate,
        through,
        movements,
      }),
      reservedMinor: summary.reservedMinor,
      reservations: summary.goals,
      currency: account.currency,
      through,
      incompleteSchedule: !!incomplete?.n,
    };
  });
}
