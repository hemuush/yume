# Add flow review (2026-11-12)

Add is where money enters the app, so this review did not stop at reading. [AddFlowRealData.test.tsx](../src/features/add/AddFlowRealData.test.tsx) drives the real screen (its real hooks and save actions) against a real in-memory database and reads back what was stored, so a difference between what was typed and what was kept shows up as a failing test. The existing Add tests mock the data layer, which cannot show that. Nothing was seen on a device.

## Checked against the real database, and sound

- **An expense, income, transfer, refund and friend entry are stored as entered:** amount, category, account(s), date, note and refund flag, and the account balances move by exactly that. A transfer moves both balances and has no category; money back is income against the purchase's category, flagged; a friend entry with cash moved is an expense (or income) on the account with the matching ledger line, and "balance only" writes no transaction at all.
- **Amounts.** A sum typed on the pad is saved as its total; a typed 1500.5 is saved as ₹1,501 and the card says so first; an amount that comes to nothing is refused and saves nothing.
- **One tap, one entry.** Tapping Save twice quickly stores one row.
- **Editing.** Changing only the note keeps the exact amount, paise and all; changing the amount rewrites it in whole rupees, keeps everything else and moves the balance by the difference; turning an expense into income leaves it in an income category; an entry whose account or category has since been archived stays on it instead of moving.
- **Several at once.** Staged entries and the one being typed all save as entered. When one fails part-way, the ones that saved stay saved, the rest stay on the list, the alert says how many saved ("1 of 3"), and saving again adds exactly the rest once each, with no doubling.
- **The repeat warning** stops an identical second entry until asked again; **delete** gives the money back and **Undo** restores it.
- **"Your usual"** lists only what was logged at least twice and one tap saves exactly that; the account follows the category's last use until picked by hand.
- **Links.** A wrong or stale parameter (an amount that is text, negative, zero, fractional or huge; an unknown type, account or category; a category of the wrong kind; a transfer to the same account) is ignored or sanitised and never saves nonsense; an entry id that no longer exists says so and goes back on OK. Every parameter the app passes into Add is one the screen reads.

## Fixed

- **The date check hid the year.** More than a week ahead, Add asks first, to catch a wrong-year typo, and then said "Save it for 12 Nov?", which is today's day and month when the year is what is wrong. It now names the year and how far off it is: "Save it for Fri 12 Nov 2027?" / "That's 365 days from today."
- **The date chip did not say the year either.** A date picked in another year read "12 Nov" on the form and in the staged list. It names the year once it is not this year, which is the only protection for a date in the wrong year in the past (nothing asks about those).
- **"Enter a valid amount" on a form nothing had been typed into.** It says "Enter an amount" until something is typed.
- **Typing 0.4 said "Enter a positive amount. Check the calculation."** 0.4 is positive and is not a calculation: it rounds to nothing in whole units. It now says "Amounts are saved in whole units, so this comes to nothing. Enter at least 1." A sum that does not come out positive keeps "check the calculation".
- **No limit on a note or label.** Pasting a bank message into the label made a row as tall as the screen in Activity (rows do not truncate a note). The two fields stop at 120 characters; notes already saved longer are left as they are. The number is a judgement, and one constant (`NOTE_MAX_LENGTH`).

## Looked at and left

- **Amounts are whole units in every currency**, so a $4.50 entry on a dollar account is saved as $5 (the card says "Saved in whole units: $5"). This is the app's recorded design for reconciling totals; it is the largest limit for anyone using a foreign-currency account, and the thing to revisit if that matters.
- The percentage on each part of a split is rounded on its own, so three parts can read 33% + 33% + 33%.
- A date far in the past is not confirmed (it is common to log old receipts); with the year now on the chip it is visible.
- A split opened for editing whose saved total carries paise is re-saved in whole rupees; typed amounts never have paise, so this needs entries that came from elsewhere.

## Checks

`AddFlowRealData.test.tsx` (41 tests against the real database), `addEntry.test.ts` (the date chip's year), and the existing `AddTransactionScreen`, `formToStaged`, `AddDetailRow` and `ExpenseLabelSheet` tests. Each new test that guards a fix fails without it.

## Validation and layout, seen on the real screen (2026-11-13)

The Add form was rendered from the real screen on a real database in a browser (the app's own db layer on SQLite compiled to JavaScript, the real fonts, 360 and 390 dp) and driven key by key; the dock's real styling was included this time. Every message, every state of Save and Add more, and the positions of the content under the card were read back by script. The harness approximates Android; the keyboard, sheets and the device's own services were not rendered, and nothing was seen on a phone.

### Fixed

- **A disabled Save looked exactly like a live one.** Save was disabled (it ignored taps and announced itself as disabled) but kept its full dark colour, while "Add more" beside it dimmed, so someone tapping Save on an unfinished form got nothing and no sign why. The cause was in the shared button, not in Add: the press feedback eases an opacity between 0.92 and 1, and it was written after the "disabled" dim, so it won. Moving the dim after the press feedback fixes **every disabled primary button in the app**, and the same ordering fault in four more controls: the **+ Add** pill, a **dimmed settings row**, a **sheet's Close button while it saves**, and Activity's **next-period arrow** at the current period. (`DimmedControls.test.tsx`, `PrimaryButton.test.tsx`, `TransactionsScreen.test.tsx`.)
- **Typing a zero showed an error and a dash.** The first key of "0.5" (a "0", or "0.") put a red "Enter a positive amount. Check the calculation." on the card, replaced the figure with "₹—", and pushed "Your usual" and the whole category grid down 26 dp, then pulled them back on the next key. A zero typed on its way to a number now reads "₹0", the card stays as it was, and the dock says "Enter an amount above zero". A sum that falls to zero or below ("5−5", "5÷0") still gets the dash and "Check the calculation", since that is a calculation to check.
- **"Enter an amount" beside a Save that was ready.** After "Add more", the empty form said "Enter an amount" while "Save 1 entry" was live, which read as a missing requirement. It says "Enter an amount to add another" (what Add more is waiting for), and shares one line with "1 on your list" (the status row was built for both; they had been stacked on two lines, which made the dock taller).
- **The dock's hint was 11 dp.** It matches the rest of the form's hints at 12 dp.

### Seen and left

- **A failed sum (or a decimal) still adds a line to the card** ("Check the calculation", "Saved in whole units: ₹13"), which moves "Your usual" and the grid down by one line (two for the long whole-units note). It only happens once a sum has been typed or a decimal point has been used, and the pad and Save do not move, so the thumb is never under a moving control; reserving the line would cost every form a blank 26 dp on a screen that is already short. The alternative is to move these messages into the dock's status row, which is already bottom-anchored. Left as a decision.
- **On the first open the dock says "Enter an amount"** before anything has been typed. It is guidance (muted, one line) and not a red error; it is the only explanation of a dimmed Save, so it stays.
- The Friend form's account chips measure 32 dp tall in the browser; like every `Chip`, they carry touch slop that lifts the target to 48 dp.

