import { getDb } from './client';
import { getDefaultCurrency } from './settings';
import { SPEND_ROWS, SPEND_AMOUNT, PUBLIC_CATEGORY_FAMILY } from './spendSql';
import type { DateRange, PaymentMode } from '@/types';

export interface PaymentMethodTotal {
  method: PaymentMode | null;
  totalMinor: number;
  count: number;
}
export async function paymentMethodTotals(
  range: DateRange,
  hideAmounts: boolean
): Promise<PaymentMethodTotal[]> {
  const currency = await getDefaultCurrency();
  const db = await getDb();
  return db.getAllAsync<PaymentMethodTotal>(
    `SELECT t.payment_mode AS method, SUM(${SPEND_AMOUNT}) AS totalMinor,
      SUM(CASE WHEN t.type = 'expense' THEN 1 ELSE 0 END) AS count
     FROM transactions t JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${SPEND_ROWS} AND a.currency = ? AND t.date BETWEEN ? AND ?
     ${hideAmounts ? 'AND ' + PUBLIC_CATEGORY_FAMILY : ''}
     GROUP BY t.payment_mode ORDER BY totalMinor DESC`,
    [currency, range.start, range.end]
  );
}
