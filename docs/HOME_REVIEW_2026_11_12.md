# Home review (2026-11-12)

A review of what a person sees on Home, how it moves, and what they would think, done from the code the way [Activity's](ACTIVITY_FEED_2026_11_12.md) was; Home has not been seen on a device since. Each item below was a fault, not a taste, and the design is unchanged.

## Fixed

- **A failed first load looked like a new install.** With the database unreadable, Home showed "Couldn't load your data" and, under it, the "A fresh start. Add a bank account…" card, telling someone with accounts that they have none. It also gave no way to retry except a pull-down nothing mentions. Now the banner has a Try again button, and while nothing is known (the load failed and no accounts have been read) the account-setup card is not shown.
- **"View all" on a past month opened this week.** Home's Recent activity is the browsed month's, but "View all" opened Activity on its default week. For a past month it now opens Activity on that month ([viewAllTarget](../src/features/home/recentActivity.ts)); Activity now accepts `?month=YYYY-MM` on its own (it needed a category or an account before), and ignores one that is not real or not yet here. The current month and a year open Activity as before, since Activity's default is the recent week and it has no year view.
- **An empty period said "Try another period".** It now says what the period is: "Nothing logged this month yet. Tap + to add an entry." for the current one, and "Nothing logged in October. Step to another month to look elsewhere." for a past one, with the year when it is not this year ([emptyRecentCopy](../src/features/home/recentActivity.ts)).
- **Changing the month from the shrunk header left the page where it was.** The month card the chip describes was scrolled out of sight, so the new month changed only the list far below. Changed from the chip (the page scrolled more than 80 dp), Home now scrolls back to the card; changed on the card itself (its own pill or a swipe) it stays put.

## Looked at and left, for a decision

- **A first account with no opening balance does not appear on Home.** Accounts holding nothing stay under View all by design ([redesign, 22 October](HOME_REDESIGN_2026_10_22.md); `HomeAccounts.test.tsx` states it for exactly this case), so someone who has just added "Bank" with ₹0 sees a row with only "Add account". The alternative is to show the empty accounts when none holds a balance. Not changed: it reverses a recorded decision.
- **"About ₹X a day for N days" counts the days after today.** On the 12th of a 30-day month it divides what is free by 18, not 19, and on the last day it shows nothing although that day's money can still be spent. Counting today would lower the figure by one part in N+1 (by half on the 30th). It is a figure about the user's money and a convention (`allowance.ts` says the last day has none left), so it is not changed here.
- **Two meanings of "week".** Home's spending-by-week bars are seven-day blocks from the 1st ("Week 2 · 8–14 Nov"); Activity's weeks run Sunday to Saturday inside a month. Both say their dates, so neither is wrong, but the same name can cover different days.
- The greeting ("Good morning") is worked out when Home renders, so a phone left on the Home tab across noon or 17:00 shows the old word until the next refresh; coming back from the background refreshes it.

## Checks

`recentActivity.test.ts` (the two labels' rules), `screens.smoke.test.tsx` against a real database (View all on a past and the current month, the empty past month, the header chip and the scroll, the failed load and its retry), and `TransactionsScreen.test.tsx` (a month link on its own, and a bad one). Unit and in-memory tests only; nothing here has been run on a phone.
