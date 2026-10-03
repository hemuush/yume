/**
 * Where "Pay bill" goes for a credit card: Add, as a transfer into it with the amount left already filled in.
 * One builder so the account sheet, Plan's Coming up and Needs you all open exactly the same thing.
 */
export type PayCardRoute = `/add-transaction?type=transfer&toAccountId=${string}&amount=${number}`;

export function payCardRoute(accountId: string, amountMinor: number): PayCardRoute {
  return `/add-transaction?type=transfer&toAccountId=${accountId}&amount=${amountMinor}`;
}
