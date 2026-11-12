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

## After the first look on a phone

- The "avg ₹… a week" name on the dashed line was drawn before the capsules, so a capsule painted over part of it in the wider Insights sheet. The line still runs behind the capsules; its name is now drawn after them ([SpendBarChart](../src/features/transactions/SpendBarChart.tsx)).
- Opening or closing a group ("Home 2 ⌄") popped its entries in and out and made the days below jump. The entries now fade in with the shared panel motion and fade out on close, the day grows and shrinks with `ROW_LAYOUT`, and the days below slide with it. Reduce-motion turns all of it off, as everywhere else.
- The Spent strip lost the glide the old card made when the period stepped. [usePeriodSlide](../src/features/transactions/usePeriodSlide.ts) is that glide as one hook (18 dp from the side it came from with a fade, a plain fade for a picked period, nothing under reduce-motion); the strip and the Insights figures both use it.
- In the filter row only the four type choices form the radio group. The Filters button and the removable chips were inside it, which read wrongly to a screen reader.
- Small consistency tweaks with Home, no layout change: the type choices are the same rounded-rectangle button as Add expense / Income / Transfer, with the picked one dark; the period is Home's calendar pill (icon, the period with "Week 1 of 5" under it, a chevron) between the same arrows; Home's ring legend is capped at 200 dp and centred beside the ring so a name and its figure stay close; and the Insights sheet uses the non-scrolling sheet layout (it scrolls only above 1.2 font scale or on a screen under 700 dp), which should sit it flush at the bottom. That last one is untested on a device.
- The entries of each day sit on a card (surface, hairline, 18 dp corner, 14 dp side padding, the same as Home's list cards) so amounts read on a solid ground instead of straight on the wallpaper. The day heading and the marker rail stay outside it.
