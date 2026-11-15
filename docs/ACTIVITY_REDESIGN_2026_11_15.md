# Activity redesign (2026-11-15)

Activity's look was reworked from an owner's screenshot and an approved design canvas (a "Today" board and an interactive "Proposed" board). The owner asked for the proposed design built **at the app's current compact sizes and spacing**, so the canvas's roomier 390 dp measures were not copied: every size below is the app's own. Calculations, privacy rules, period loading, search, filters, hand-ordering, stacks and the Insights sheet are unchanged; this is presentation.

It builds on [the feed-first layout](ACTIVITY_FEED_2026_11_12.md) and keeps what [the smoothness pass](ACTIVITY_SMOOTHNESS_2026_11_14.md) added (open stacks held outside React state, memoized days that skip when their entries are the same, no layout slide under an open group, no exit animations when a day leaves).

## What changed

- **Days are a heading over a card, with no date rail.** [TimelineDay](../src/features/transactions/TimelineDay.tsx) draws "**Today** · Sun 15 Nov" on the left of one heading line and what the day spent on the right ("₹2,154 spent", "· +₹120 in" for money in, "· ₹899 back" for refunds), above one card of the day's entries that now runs the full width. The weekday/date column, the line between days and the filled circle on today are gone, so the `position` and `today` props are gone too (fewer reasons for a day to redraw). The total is still left out when one line would only repeat it, and savings amounts are still left out of it while hidden. A day of only transfers says how many there were ("2 transfers"); one transfer alone has no total. The heading is still one accessible header; it says money in as "₹120 in", not "plus".
- **The chart's picked day** (its bar tapped in Insights) used to turn its heading bold. The heading is bold for every day now, so the picked one sits on a soft tint of the theme colour instead.
- **Rows read name left, money right.** The left is the entry's own name (its note, else its category) with the category under it only when a note took the lead (a subcategory still says its parent; with neither there is no second line). The right is the amount over the account it came from (12 dp, muted). Spending is ink with "−", money in is green with "+", a transfer is lighter with neither sign and the line "Transfer". A group's account is on its right when all its entries share one, and an open group's entries put their account at the right end under the amount when a note leads. Category marks are the existing tinted discs (emoji and line icons share them).
- **Spent card** ([ActivitySummaryStrip](../src/features/transactions/ActivitySummaryStrip.tsx)): the label, the figure at 24 dp (it was 20 in a 64 dp strip), a chip for the comparison (green with a down arrow when spending is down, red with an up arrow when it is up) followed by "less than last month", and a small lettered preview: a week's days under their bars, a month's weeks as W1–W5. A month's bars are drawn on a **square-root scale** because a month is usually one big week and four small ones; a week's are linear. The period in progress is ink, earlier ones the sky blue, and bars still to come are a dashed outline (a week's later days, a month's later weeks). The card is still one button that opens Insights, and its figure is the real amount at once (it never counts up). At large text (or under 360 dp) the preview is left out and the figure keeps the room.
- **One period pill** ([ActivityPeriodBar](../src/features/transactions/ActivityPeriodBar.tsx)): ‹ This week ▾ › in one pill (the arrows moved inside; the calendar icon went, the chevron says it opens the picker), and **Week | Month** as a second pill whose picked half is filled with the theme's ink. This is the same look as the type chips. Swiping the pill or the Spent card still steps the period, and the pill clips what slides inside it. When the bar stacks (under 380 dp or at large text) the pill spans the width with the arrows at its ends, and the switch takes the width under it in two equal halves.
- **Type chips and picked-filter chips are pills**, drawn 40 dp tall with a 48 dp touch area (they were rounded rectangles, and the picked-filter chips 44 tall). The row is still 44 tall so nothing moves when a chip arrives.
- **Loading placeholder** ([TransactionsSkeleton](../src/features/transactions/TransactionsSkeleton.tsx)) is drawn from the new measures (the 98 dp card with lettered bars, the 44 dp filter row, a heading line over a card), so the page fills in without reflowing.

## Compact sizes kept, and where the canvas differed

| Part | Canvas (390 dp board) | In the app |
| ---- | --------------------- | ---------- |
| Category disc | 40 dp (34 compact) | 34 dp, the app's `SCREEN.iconTile` |
| Row | 11/14 dp padding, 15.5 dp text | 6 dp padding, 48 dp least height, 14 dp name, 12 dp second line |
| Day heading | 15 dp bold + 13 dp date | 14 dp bold + 12 dp date |
| Spent figure | 34 dp | 24 dp |
| Bars | 100 × 56 dp | 96 × 40 dp, labels 11 dp |
| Period pill, Week \| Month | 44 dp | 44 dp (36 dp buttons inside 3 dp of padding) |
| Filter chips | 40 dp | 40 dp |

Differences from the canvas that are deliberate:

- **A week starts on Sunday** in the app, so its bars read S M T W T F S (the canvas drew M T W T F S S). The labels come from the same bars as before.
- **No new fade under the tab bar.** The floating tab bar ([PillTabBar](../src/components/PillTabBar.tsx)) already draws the page-coloured gradient behind itself on every tab, which is the canvas's fade.
- The period pill keeps the quiet line under its name ("15–Nov 21", "Updating…" while a step loads) that the canvas dropped; "Updating…" is how a step in progress is shown.

## Tests

- [TimelineDay.test.tsx](../src/features/transactions/TimelineDay.test.tsx): the heading (day, date, total, spoken total), no rail, the picked day's tint, "N transfers", note-led and category-led rows, amount colours and signs, the account under the amount, parents and groups.
- [ActivitySummaryStrip.test.tsx](../src/features/transactions/ActivitySummaryStrip.test.tsx): the chip's colour and words, bar heights and colours, dashed bars to come, W1–W5 and day letters, the square-root scale, the preview left out at large text.
- [TransactionsScreen.test.tsx](../src/features/transactions/TransactionsScreen.test.tsx) and [ActivityTop.test.tsx](../src/features/transactions/ActivityTop.test.tsx): the picked half of Week | Month is filled and moves with the pick, nothing is pulled past the gutters by a negative margin (wide, and stacked at large text), the type chips are pills; [TransactionsSkeleton.test.tsx](../src/features/transactions/TransactionsSkeleton.test.tsx): the placeholder's measures.

## Checked in the browser, not on a phone

The screen was rendered on a real SQLite ledger (the same harness as the earlier passes) at 390, 360 and 320 dp and at 100%, 150% and 200% text, before and after, in week and month views, and the whole matrix of interactions was run at 6 times slower CPU on both builds (below). A first render showed the month labels cut to "W.." (the web layer clamps a single-line Text to its column); the labels are now one row spread over the bars' width, so nothing depends on overflow. A second showed the stacked period pill with its arrows bunched at the left (now at its ends).

Interaction timings at 6 times slower CPU, before and after, are in the next section.

## Not established

No Android device is available here, so none of this has been seen on a phone. Things worth a look on one: the dashed outline of a bar still to come (a 4 dp tall rounded dashed border), the exact position of the bar letters under their bars with the phone's font, the soft tint under a picked day's heading, and the stacked layout at 360 dp.
