import type { AppDb } from './client';

/** Loans, IOUs and goals are denominated in the default currency; no conversion is supported. */
export async function assertDefaultCurrencyAccount(
  db: AppDb,
  accountId: string,
  feature: string
): Promise<void> {
  const account = await db.getFirstAsync<{ currency: string }>('SELECT currency FROM accounts WHERE id = ?', [
    accountId,
  ]);
  const setting = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'default_currency'"
  );
  const currency = setting?.value ?? 'INR';
  if (!account) throw new Error('Account not found');
  if (account.currency !== currency)
    throw new Error(
      `${feature} use ${currency}. Choose an account in ${currency}; currency conversion is not supported.`
    );
}
