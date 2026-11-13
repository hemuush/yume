# Profile review (2026-11-12)

Profile holds the accounts and the settings, so a wrong number or a wrong side effect here reaches every other screen. This review rendered the You and Settings tabs against the real-data harness (shown and with savings hidden), cross-checked the figures, and then drove the real account sheets against a real in-memory database in [ProfileAccountsRealData.test.tsx](../src/features/profile/ProfileAccountsRealData.test.tsx), reading back what was stored. Nothing was seen on a device.

## Checked against the real database, and sound

- **Adding an account stores what was typed:** the trimmed name, the type, the chosen currency (kept whatever the app currency is), the opening balance in whole rupees (1234.56 is saved as ₹1,235, as every typed amount is), and for a card its limit and statement and due days. An empty name says "Enter a name" and creates nothing; a statement day that is not a day of the month is refused.
- **Editing** only the name keeps the exact opening balance, paise and all.
- **Delete** is offered only for an account with no entries, **Undo** brings it back with its balance, and an account that has only a repeating entry cannot be deleted and says why.
- **Backup and restore** already have real-database round trips ([backup.test.ts](../src/lib/backup.test.ts), [safetyCopy.test.ts](../src/lib/safetyCopy.test.ts)); a card's opening balance is stored raw in them, so the change below needs no change there.
- The figures on the page agree: the accounts total is the sum of the rows, the tracked balance is accounts less loans plus friends, and hidden mode masks every total that includes savings.

## Fixed

- **A card that already carried a bill was saved as money in the card.** A card's balance is what is in it, negative while owed, and the number pad has no minus key, so typing the ₹20,000 you owe under "Opening balance" stored +₹20,000: the card showed as ₹20,000 in credit, "In your accounts" counted it as cash, and the limit used read 0%. The card's field is now "Owed on it now" and is stored negated ([cardOpening.ts](../src/lib/cardOpening.ts)); the Edit sheet shows what is owed as a plain amount and reads "Opened owing ₹20,000". Switching an account to a card reads its number the same way, since the label changes with the chip.
- **Archiving paused repeating entries without saying so.** `archiveAccount` pauses what posts into or out of the account and unarchiving leaves them paused (both deliberate, so nothing keeps landing in an account hidden from every total), but neither dialog said it. Archive now says "Its 2 repeating entries are paused too, and stay paused until you resume them in Recurring" (only for entries that are running), and unarchive says "Its 2 repeating entries are still paused" when there are any.
- **"1 Entries", "1 Active loans", "1 Friends"** on the You tab, and the same in the spoken labels. They agree with the count now. The tests had asserted the wrong wording.
- **Backups found in a folder** said "· 1 entries".
- **Tidy up and Recently deleted showed a foreign account's amounts in the app currency** ("₹50" for a $50 entry) because the amount was formatted without the account's currency; both use it now. **Their dates had no year**, so an entry from last year read "4 Mar"; they name the year once it is not this year (`dayMonthMaybeYear`).
- Found by the same sweep, outside Profile: "1 months" under the Investments hero's return, "1 EMIs" and "1 installments are" in the Add loan errors ("1 month have passed"), and "for 1 days" in Update value. A shared `plural()` ([plural.ts](../src/lib/plural.ts)) now does it.

## Looked at and left

- **Cards set up before this change are not migrated.** Someone who typed what they owed got money in the card; the app cannot tell that from a card that really started with credit. Such a card now opens in Edit with a minus in "Owed on it now" and the line "A minus means the card started with money in it, not a bill", and is kept unchanged unless it is retyped. It needs to be retyped by hand.
- **The totals on Home, Plan and Profile are three different figures** for what is "in hand" (in the harness: Home ₹3,57,500, Plan's runway Now ₹3,51,900, Profile's In your accounts ₹3,62,400), and Profile's "Tracked balance" is the same as Reports' Net worth (₹1,63,400). Each follows its own definition, but a person comparing two screens will see different numbers and nothing says why. Worth deciding whether to name one of them.
- **Amounts are whole units in every currency** (as in the Add review), and combined totals add only accounts in the default currency.
- Categories archive leaves repeating entries running (it says so); accounts pause them. The difference is deliberate, since an archived category still files entries and an archived account drops out of the totals.

## Checks

`ProfileAccountsRealData.test.tsx` (21 tests against the real database), `LinkTiles.test.tsx`, `plural.test.ts`, and additions to `YouSection`, `AccountDetailModal`, `BackupScreen`, `RecentlyDeletedScreen`, `TidyUpScreen`, `tidyUp`, `dateLabels`, `investment`, `AddLoanModal` and `UpdateValueSheet`. Each new test that guards a fix fails without it (checked by removing the fix). The test suite needs `LANG=en_IN.UTF-8`, as CI sets, or the amounts and dates format for another locale.
