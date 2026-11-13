# Home review (2026-11-12)

A review of what a person sees on Home, how it moves, and what they would think, done from the code the way [Activity's](ACTIVITY_FEED_2026_11_12.md) was; Home has not been seen on a device since. Each item below was a fault, not a taste, and the design is unchanged.

## Fixed

- **A failed first load looked like a new install.** With the database unreadable, Home showed "Couldn't load your data" and, under it, the "A fresh start. Add a bank account…" card, telling someone with accounts that they have none. It also gave no way to retry except a pull-down nothing mentions. Now the banner has a Try again button, and while nothing is known (the load failed and no accounts have been read) the account-setup card is not shown.
- **"View all" on a past month opened this week.** Home's Recent activity is the browsed month's, but "View all" opened Activity on its default week. For a past month it now opens Activity on that month ([viewAllTarget](../src/features/home/recentActivity.ts)); Activity now accepts `?month=YYYY-MM` on its own (it needed a category or an account before), and ignores one that is not real or not yet here. The current month and a year open Activity as before, since Activity's default is the recent week and it has no year view.
- **An empty period said "Try another period".** It now says what the period is: "Nothing logged this month yet. Tap + to add an entry." for the current one, and "Nothing logged in October. Step to another month to look elsewhere." for a past one, with the year when it is not this year ([emptyRecentCopy](../src/features/home/recentActivity.ts)).
- **Changing the month from the shrunk header left the page where it was.** The month card the chip describes was scrolled out of sight, so the new month changed only the list far below. Changed from the chip (the page scrolled more than 80 dp), Home now scrolls back to the card; changed on the card itself (its own pill or a swipe) it stays put.

## A second, harder pass

The first pass was mostly reading. This one rendered Home with real data (amounts shown and hidden), checked the figures against each other, and read what the first had skipped.

- **Rendered and cross-checked, nothing wrong:** the month legend adds up to its entries, "About ₹14,884 a day for 18 days" is the free figure over the days counted, Today's total agrees between the day heading and the week bars, and with amounts hidden savings, sensitive spending and goals are masked everywhere they appear (including the in-hand line and the day total).
- **The account sheet said "this month" for any month.** Browsing October and opening an account read "Nothing moved in or out this month." It now says "during October" (and "this month" only for the current one).
- **The Notifications screen's Suu line praised a month that had barely begun.** It set this month so far against all of last month, so on the 4th it said "You're spending 85% less than last month — nice pace." It now compares the same days of last month ([getMonthToDateRanges](../src/db/reports.ts), which takes all of a shorter month), words it "than at this point last month", and says nothing before the 5th, the same rule the month forecast uses. The home-screen Suu widget and the "growing category" alert compare the same two spans the old way, but they only speak when spending is already *up*, which stays true, so they were left.
- **The loading placeholder named the wrong section.** Under the account tiles it drew "Recent activity"; the page puts Coming up there. It is now titled Coming up, so the heading does not change as the data lands.

## Looked at and not changed

- The Suu "welcome back" pop after a pull-down is placed 4 dp from the top of the screen. The app draws under the status bar (the header pads by the top inset), so the pop probably sits partly behind it. Not changed without seeing it: it needs a look on a phone.
- The bell lists only the nearest EMI across loans, so two overdue loans count once on the bell; Coming up lists them all.
- "₹27,480 still to pay this month" includes an EMI that was due in March (it is overdue, so it is still owed); "this month" is loose for that part.

## Looked at and left, for a decision

- **A first account with no opening balance does not appear on Home.** Accounts holding nothing stay under View all by design ([redesign, 22 October](HOME_REDESIGN_2026_10_22.md); `HomeAccounts.test.tsx` states it for exactly this case), so someone who has just added "Bank" with ₹0 sees a row with only "Add account". The alternative is to show the empty accounts when none holds a balance. Not changed: it reverses a recorded decision.
- **"About ₹X a day for N days" counts the days after today.** On the 12th of a 30-day month it divides what is free by 18, not 19, and on the last day it shows nothing although that day's money can still be spent. Counting today would lower the figure by one part in N+1 (by half on the 30th). It is a figure about the user's money and a convention (`allowance.ts` says the last day has none left), so it is not changed here.
- **Two meanings of "week".** Home's spending-by-week bars are seven-day blocks from the 1st ("Week 2 · 8–14 Nov"); Activity's weeks run Sunday to Saturday inside a month. Both say their dates, so neither is wrong, but the same name can cover different days.
- The greeting ("Good morning") is worked out when Home renders, so a phone left on the Home tab across noon or 17:00 shows the old word until the next refresh; coming back from the background refreshes it.

## Checks

`recentActivity.test.ts` (the two labels' rules), `screens.smoke.test.tsx` against a real database (View all on a past and the current month, the empty past month, the header chip and the scroll, the failed load and its retry), and `TransactionsScreen.test.tsx` (a month link on its own, and a bad one). Unit and in-memory tests only; nothing here has been run on a phone.

## Seen rendered, and things that jump (2026-11-13)

After a device screenshot of Activity showed "Clear all" arriving in front of the type pills and pushing them aside, Home was checked for the same kind of fault: a control that moves, or changes size, when it is used. This time Home was **rendered from its real components with sample data in a browser** (Chromium, the app's own Archivo and Fredoka fonts and icon fonts, 360, 390 and 412 dp wide, the first-run, no-income, quiet, past-month and year states, and a tap through the chips and the sum), so the fixes below were measured, not guessed. The harness lives outside the repository; it approximates Android (text metrics and flex layout are close, shadows and gestures are not), so it finds layout faults but does not replace a look on a phone.

- **Tapping a Coming up chip moved the chips after it.** Its "needs a look" dot sat inside the chip, so picking Payments removed the dot and narrowed the chip, and Budgets and Goals slid left under the thumb. The dot is now a corner badge (it takes no room), and a picked chip is the same weight as an unpicked one, so no chip changes size. (Measured: every chip's position and width are identical before and after a tap.)
- **The chip row did not fit.** At 360 and 390 dp All, Payments, Budgets and Goals wrapped, leaving Goals alone on a second line. The chips are tighter (10 dp sides, 6 dp apart) and share one line at 360, 390 and 412 dp. They are also 44 dp to touch, as on Activity (drawn 36).
- **"How it adds up" opened its sum above its own link,** so the link jumped about 200 dp down, away from the finger that had just tapped it (closing it meant chasing it). The sum now opens under the link; the link does not move.
- **In a year, "See insights" sat alone on a third line,** under "How it adds up", with the caption between them. The two links share the first line and the caption sits under them.

### The same fault elsewhere (not yet changed)

Controls that change width when selected because the selected label is a heavier weight, so their neighbours shift a little on every tap: Activity's Week | Month tabs, Profile's You | Settings tabs, the person chips in Add, and the pickers in Reports' range sheet; Home's legend amounts do it too but sit flush to their edge, so nothing beside them moves. To be done area by area, with the same render-and-measure check.

### Seen and left

- "Ahead" means opposite things in one Coming up card: a budget "Ahead of pace" (spending faster than planned, amber) and a goal "Ahead" (saving faster, green). Colour and the budget's own line tell them apart; a different word for the budget pill would settle it.
- At 360 dp the budget line "Ahead of pace · ₹1,800 left" wraps with "left" alone on a second line.
- Home's account tiles caption the type in lower case ("bank", "cash"); Profile's tiles say "Bank", "Cash".

