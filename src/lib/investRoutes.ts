import type { Account } from '@/types';

/** Add, opened as a transfer into the holding from the account its money normally comes from. */
export function investHref(holding: Pick<Account, 'id' | 'investment'>): string {
  const from = holding.investment?.fundingAccountId;
  return `/add-transaction?type=transfer${from ? `&accountId=${from}` : ''}&toAccountId=${holding.id}`;
}

/** Add, opened as a transfer out of the holding back to the account its money came from. */
export function withdrawHref(holding: Pick<Account, 'id' | 'investment'>): string {
  const to = holding.investment?.fundingAccountId;
  return `/add-transaction?type=transfer&accountId=${holding.id}${to ? `&toAccountId=${to}` : ''}`;
}
