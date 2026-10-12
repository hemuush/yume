import { addDaysToIsoDate, assertValidIsoDate } from './date';
export interface PurchaseMovement {
  date: string;
  deltaMinor: number;
  label: string;
  isPurchase?: boolean;
}
/** Conservative within-day ordering: purchase and debits precede scheduled credits. */
export function purchaseAffordability(input: {
  balanceMinor: number;
  reservedMinor: number;
  amountMinor: number;
  today: string;
  purchaseDate: string;
  through: string;
  movements: PurchaseMovement[];
}) {
  for (const date of [input.today, input.purchaseDate, input.through]) assertValidIsoDate(date);
  if (
    input.purchaseDate < input.today ||
    input.purchaseDate > input.through ||
    input.through > addDaysToIsoDate(input.today, 120)
  )
    throw new Error('Choose a purchase within the next 90 days.');
  if (
    ![input.balanceMinor, input.reservedMinor, input.amountMinor].every(Number.isSafeInteger) ||
    input.reservedMinor < 0 ||
    input.amountMinor <= 0
  )
    throw new Error('Enter a valid purchase amount.');
  let balance = input.balanceMinor - input.reservedMinor;
  let lowestMinor = balance,
    lowestDate = input.today;
  let afterPurchaseMinor = balance;
  const ordered = [
    ...input.movements,
    { date: input.purchaseDate, deltaMinor: -input.amountMinor, label: 'Planned purchase', isPurchase: true },
  ]
    .filter((m) => m.date <= input.through)
    .map((m) => ({ ...m, date: m.date < input.today ? input.today : m.date }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.deltaMinor - b.deltaMinor);
  for (const move of ordered) {
    if (!Number.isSafeInteger(move.deltaMinor)) throw new Error('Invalid scheduled amount.');
    balance += move.deltaMinor;
    if (!Number.isSafeInteger(balance)) throw new Error('These amounts are too large to estimate safely.');
    if (move.isPurchase) afterPurchaseMinor = balance;
    if (balance < lowestMinor) {
      lowestMinor = balance;
      lowestDate = move.date;
    }
  }
  return {
    afterPurchaseMinor,
    lowestMinor,
    lowestDate,
    endMinor: balance,
    shortfallMinor: Math.max(0, -lowestMinor),
    movements: ordered,
  };
}
