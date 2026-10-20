import { getDb } from './client';
import { MAX_AMOUNT_MINOR } from '@/lib/amountLimits';

/** Optional income estimate is currency-scoped and included in ordinary settings backups. */
export async function getMonthlyPlanIncome(currency: string): Promise<number | null> {
  const row = await (
    await getDb()
  ).getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    `monthly_plan_income_${currency}`,
  ]);
  const value = row ? Number(row.value) : null;
  return value != null && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT_MINOR
    ? value
    : null;
}
export async function setMonthlyPlanIncome(currency: string, value: number | null): Promise<void> {
  const db = await getDb();
  if (value == null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', [`monthly_plan_income_${currency}`]);
    return;
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_AMOUNT_MINOR)
    throw new Error('Enter a valid monthly income.');
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [`monthly_plan_income_${currency}`, String(value)]
  );
}
