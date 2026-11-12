# Activity: feed first (2026-11-12)

Activity now leads with its entries. The summary is one slim strip, the filters are one row, and the days are a flat dated feed. Calculations, privacy rules, period loading, search and hand-ordering are unchanged; this is presentation.

## What changed

- **Spent strip** ([ActivitySummaryStrip](../src/features/transactions/ActivitySummaryStrip.tsx)) replaces the big Spent card. It shows the kicker ("Spent this week", "Spent on Food this week", or just "Spent" for a past period), the figure, the change against the period before (dropped while the list is narrowed to a category) and a small bar per day (per week in a month) with the current day in ink. It is a button that opens Insights. The figure is a plain amount; nothing in the strip animates.
- **Insights sheet** holds what the card used to: the figure and change, the full day chart (tap a day to see only it, which closes the sheet and scrolls the list), the daily average, and Money in / Left. It is the same [TransactionsHeadline](../src/features/transactions/TransactionsHeadline.tsx) with `bare`, so the chart, scaling and privacy logic are not duplicated.
- **One filter row** ([ActivityFilterChips](../src/features/transactions/ActivityFilterChips.tsx)): the Filters button (with its count), then the picked category and account chips with Clear all, then All / Spent / Income / Transfers. It scrolls sideways, and wraps at 360 dp or above 1.2 font scale. The second chip line is gone.
- **Flat dated feed** ([TimelineDay](../src/features/transactions/TimelineDay.tsx)): each day is a block on the page, not a segment of one card. A marker rail on the left shows the weekday and date number (today's in a filled circle) and a line down to the next day, which the last day ends. The day's heading names what it did instead of one unlabelled net: "₹1,420 spent · ₹82,000 in · ₹899 back" (refunds are counted as "back", not as income, and transfers move nothing). It is omitted when one line would only repeat it, and savings amounts are left out while hidden, as before.

Unchanged: the Week | Month switch and the date pill stay in the header, the entry rows (a note leads with the category, parent and account under it), stacks, drag ordering, search, the filter sheet and the detail sheet.

## Checks

`TimelineDay.test.tsx` (totals, privacy, marker line, today circle), `ActivitySummaryStrip.test.tsx`, `ActivityTop.test.tsx` (one filter row, wrap) and `TransactionsScreen.test.tsx` (the strip opens Insights). These are unit tests; the screen has not been seen on a device.
