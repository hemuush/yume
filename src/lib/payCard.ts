/**
 * Where "Pay bill" goes for a credit card: Add, as a transfer into the card,
 * with what's left to pay already filled in (you pick the account it comes
 * from). One builder, so the account sheet, Plan's Coming up and Needs you
 * all open exactly the same thing.
 */
export type PayCardRoute = `/add-transaction?type=transfer&toAccountId=${string}&amount=${number}`;

export function payCardRoute(accountId: string, amountMinor: number): PayCardRoute {
  return `/add-transaction?type=transfer&toAccountId=${accountId}&amount=${amountMinor}`;
}
