# Activity redesign (2026-11-15)

Activity's look was reworked from an owner's screenshot and an approved design canvas (a "Today" board and an interactive "Proposed" board). The owner asked for the proposed design built **at the app's current compact sizes and spacing**, so the canvas's roomier 390 dp measures were not copied: every size below is the app's own. Calculations, privacy rules, period loading, search, filters, hand-ordering, stacks and the Insights sheet are unchanged; this is presentation.

**Follow-up the same day, after the first phone screenshots:** the owner asked for Activity's entries to look like Home's Recent activity, "proper and perfectly". The days and rows below are therefore drawn from Home's own measures and styles (the sections that say so replace what this record first described: a heading above the card, the account under the amount, the 34 dp disc, the 48 dp row). The header, the Spent card, the period pill and Week | Month, and the chips are as described.

It builds on [the feed-first layout](ACTIVITY_FEED_2026_11_12.md) and keeps what [the smoothness pass](ACTIVITY_SMOOTHNESS_2026_11_14.md) added (open stacks held outside React state, memoized days that skip when their entries are the same, no layout slide under an open group, no exit animations when a day leaves).

## What changed

- **Each day is one card, drawn like Home's Recent activity, with no date rail.** [TimelineDay](../src/features/transactions/TimelineDay.tsx) uses Home's card (the same surface, hairline, corner and 12 dp inset as `HomeRecentActivity`), with the day named inside it in small capitals and what it spent at the right ("TODAY  −₹2,154"; another day also says its date, "FRIDAY · NOV 13"; money in is "+₹120", refunds "₹899 back"). The weekday/date column, the line between days and the filled circle on today are gone, so the `position` and `today` props are gone too. The total is left out when one line would only repeat it, and savings amounts are still left out of it while hidden; a day of only transfers says how many ("2 transfers"). The heading is one accessible header and is read out in words ("₹120 in"). Home's day-heading styles now live in [screenStyles](../src/components/screenStyles.ts) (`dayHead`, `dayHeadText`) and both screens use them.
- **The chart's picked day** (its bar tapped in Insights) sits on a soft tint of the theme colour behind its heading.
- **Rows are Home's rows**: a 40 dp category disc in a 44 dp slot, the entry's own name (its note, else its category) over "category · account" in muted text, the amount alone at the right, a 56 dp least height with 14 dp of side padding, and a hairline between rows across the whole row. After a note the line under the name is the category (with its parent, "Groceries › Flipkart Minutes") then the account; with no note it is the parent (if any) then the account. Spending is ink with "−", money in green with "+". A transfer is Home's too: "Transfer" (or its note) over "SBI → Emergency fund", the swap icon, no sign. Groups, Refund and Split badges, value updates, hand-ordering and the new-entry glow are Activity's own, in the same measures; a group's open entries put a dot in the category's colour where the disc is, so their text lines up with the group's.
- **Spent card** ([ActivitySummaryStrip](../src/features/transactions/ActivitySummaryStrip.tsx)): the label, the figure at 24 dp (it was 20 in a 64 dp strip), a chip for the comparison (green with a down arrow when spending is down, red with an up arrow when it is up) followed by "less than last month", and a small lettered preview: a week's days under their bars, a month's weeks as W1–W5. A month's bars are drawn on a **square-root scale** because a month is usually one big week and four small ones; a week's are linear. The period in progress is ink, earlier ones the sky blue, and bars still to come are a dashed outline (a week's later days, a month's later weeks). The card is still one button that opens Insights, and its figure is the real amount at once (it never counts up). At large text (or under 360 dp) the preview is left out and the figure keeps the room.
- **One period pill** ([ActivityPeriodBar](../src/features/transactions/ActivityPeriodBar.tsx)): ‹ This week ▾ › in one pill (the arrows moved inside; the calendar icon went, the chevron says it opens the picker), and **Week | Month** as a second pill whose picked half is filled with the theme's ink. This is the same look as the type chips. Swiping the pill or the Spent card still steps the period, and the pill clips what slides inside it. When the bar stacks (under 380 dp or at large text) the pill spans the width with the arrows at its ends, and the switch takes the width under it in two equal halves.
- **Type chips and picked-filter chips are pills**, drawn 40 dp tall with a 48 dp touch area (they were rounded rectangles, and the picked-filter chips 44 tall). The row is still 44 tall so nothing moves when a chip arrives.
- **Loading placeholder** ([TransactionsSkeleton](../src/features/transactions/TransactionsSkeleton.tsx)) is drawn from the new measures (the 98 dp card with lettered bars, the 44 dp filter row, each day as Home's card with its heading line and 56 dp rows), so the page fills in without reflowing.

## Compact sizes kept, and where the canvas differed

| Part | Canvas (390 dp board) | In the app |
| ---- | --------------------- | ---------- |
| Category disc | 40 dp (34 compact) | 40 dp in a 44 dp slot, Home's (`SCREEN.mark`) |
| Row | 11/14 dp padding, 15.5 dp text | Home's: 10 dp padding, 56 dp least height, 14 dp name, 13 dp second line |
| Day heading | 15 dp bold + 13 dp date, above the card | Home's: 11 dp small capitals inside the card |
| Spent figure | 34 dp | 24 dp |
| Bars | 100 × 56 dp | 96 × 40 dp, labels 11 dp |
| Period pill, Week \| Month | 44 dp | 44 dp (36 dp buttons inside 3 dp of padding) |
| Filter chips | 40 dp | 40 dp |

Differences from the canvas that are deliberate:

- **A week starts on Sunday** in the app, so its bars read S M T W T F S (the canvas drew M T W T F S S). The labels come from the same bars as before.
- **No new fade under the tab bar.** The floating tab bar ([PillTabBar](../src/components/PillTabBar.tsx)) already draws the page-coloured gradient behind itself on every tab, which is the canvas's fade.
- The period pill keeps the quiet line under its name ("15–Nov 21", "Updating…" while a step loads) that the canvas dropped; "Updating…" is how a step in progress is shown.

## Tests

- [TimelineDay.test.tsx](../src/features/transactions/TimelineDay.test.tsx): the heading inside Home's card (day, date, total, spoken total), no rail, Home's card, disc, slot, row and hairline measures, the picked day's tint, "N transfers", note-led and category-led rows with "category · account", amount colours and signs, that no amount shrinks or sits in a column, parents and groups.
- [ActivitySummaryStrip.test.tsx](../src/features/transactions/ActivitySummaryStrip.test.tsx): the chip's colour and words, bar heights and colours, dashed bars to come, W1–W5 and day letters, the square-root scale, the preview left out at large text.
- [TransactionsScreen.test.tsx](../src/features/transactions/TransactionsScreen.test.tsx) and [ActivityTop.test.tsx](../src/features/transactions/ActivityTop.test.tsx): the picked half of Week | Month is filled and moves with the pick, nothing is pulled past the gutters by a negative margin (wide, and stacked at large text), the type chips are pills; [TransactionsSkeleton.test.tsx](../src/features/transactions/TransactionsSkeleton.test.tsx): the placeholder's measures.

## Checked in the browser, not on a phone

The screen was rendered on a real SQLite ledger (the same harness as the earlier passes) at 390, 360 and 320 dp and at 100%, 150% and 200% text, before and after, in week and month views, and the whole matrix of interactions was run at 6 times slower CPU on both builds (below). A first render showed the month labels cut to "W.." (the web layer clamps a single-line Text to its column); the labels are now one row spread over the bars' width, so nothing depends on overflow. A second showed the stacked period pill with its arrows bunched at the left (now at its ends).

## Measured at 6 times slower CPU, in a browser

> These numbers were taken on the first form of the redesign (a heading above the card, an amount-over-account column in every row), before the rows were redrawn as Home's. That form had two more nodes in each row than Home's rows do, so what is said below about the extra nodes describes it, not the current rows.

The harness ([the earlier Activity pass](ACTIVITY_SMOOTHNESS_2026_11_14.md) used it too) runs each interaction on a 3,000-entry ledger with the CPU throttled 6 times and counts the JavaScript that blocks the page (tasks over 50 ms) and the longest gap between frames. "Before" is the build of the previous commit, "after" is this one.

- **Size of the page.** The first screen holds 132 DOM nodes (it was 119): two more in each row (the right-hand column and the account text, 9 → 11) and about fifteen more in the Spent card (the bars' letters and the chip). Mounting to the first days took 1,431 ms after against 1,098 before in the quiet run (1,297 against 1,085 in the first); that is the cost of those nodes plus noise and was not tuned further.
- **Interactions.** Scrolling a week and a month (flings of 2,500 and 6,000 px) had no blocking task before or after. For the rest the same build measured twice differs by up to 2 times (the old build's month step blocked for 326 ms in one run and 762 ms in the other), so a single number cannot tell a small change from noise. Most interactions are faster in one run and slower in the other. Three were slower after in both runs, by modest amounts: stepping to the next month (+45 and +93 ms of blocked JavaScript), switching back to Week (+8 and +78 ms) and closing Insights (a task of about 50 ms that was not there before).
- **Repeated five times** on each build (medians of blocked JavaScript at 6 times slower CPU, before → after): Week → Month 173 → 183 ms, next month 383 → 401, opening Insights 37 → 43, closing it 19 → 9, opening an entry 91 → 89 (all unchanged); stepping back a month 202 → 439 ms (slower after in all five repeats) and Month → Week 100 → 167 ms (slower in three of the five). The new days are heavier to put on screen: each row has one more text and one more view, and the list mounts a few days per batch. React's own commit time for a month step at normal CPU speed, though, was the same on both builds in three runs each (about 22–26 ms in total), so the extra blocked time at 6 times is probably the browser's layout and styling of the extra nodes rather than more JavaScript of ours (not measured separately). The month step's 237 ms of difference is about 40 ms at normal speed, on a step that blocked about 34 ms before; it was not reduced further. On a phone the cost of those nodes is native views, which this harness does not measure.

| Interaction | JS blocked, ms (quiet run, before → after) | Longest frame gap, ms (before → after) | JS blocked, ms (first run, before → after) |
| ----------- | ------------------------------------------ | -------------------------------------- | ------------------------------------------ |
| week: previous week | 392 → 446 | 450 → 500 | 416 → 329 |
| week: next week | 204 → 180 | 250 → 233 | 161 → 227 |
| chip: Spent | 67 → 103 | 117 → 150 | 53 → 12 |
| chip: All | 119 → 9 | 167 → 50 | 4 → 140 |
| scope: Month | 561 → 209 | 567 → 233 | 225 → 801 |
| month: previous month | 762 → 194 | 700 → 250 | 326 → 409 |
| month: next month | 226 → 319 | 250 → 333 | 247 → 291 |
| month: chip Spent | 191 → 87 | 233 → 133 | 92 → 130 |
| month: chip All | 330 → 395 | 383 → 450 | 104 → 84 |
| scope: Week | 162 → 240 | 217 → 283 | 131 → 139 |
| insights: open | 26 → 36 | 67 → 83 | 31 → 400 |
| insights: close | 0 → 51 | 0 → 100 | 0 → 49 |
| picker: open | 148 → 153 | 200 → 200 | 127 → 99 |
| picker: close | 9 → 128 | 67 → 167 | 106 → 20 |
| entry: open detail | 110 → 247 | 150 → 317 | 403 → 354 |
| entry: close detail | 11 → 0 | 50 → 0 | 0 → 0 |
| search: open | 363 → 52 | 400 → 100 | 242 → 84 |
| search: type "food" | 164 → 54 | 150 → 100 | 148 → 98 |
| search: close | 99 → 126 | 150 → 183 | 72 → 80 |

The first run overlapped a type check and a lint run on the same machine for its last part, which is why its Insights and Week | Month numbers are higher; the quiet run is the one to read. Neither says anything about a phone.

## Found on a phone afterwards: tiny amounts in an open group

The first phone screenshot of the redesign (a "Loan EMI" group opened to its two entries) showed the amount of each entry drawn a few dp tall and pushed to the left of its column, beside a normal-sized account name. The group's own total, with the same component, was fine.

The cause was in the right-hand column the redesign had added (amount over account). The amount kept the style it had as a direct child of its line: `flexShrink: 1`, and shrink-to-fit text (`adjustsFontSizeToFit`). In a row that shrinking is a width. In a column it is a height: when the column was squeezed, the amount was given a few dp of height and Android shrank its font until it fitted, while the account (which has neither setting) stayed full size. The browser render could not show this, because the browser layer has no shrink-to-fit text; that is why the earlier browser checks passed.

It is gone with the column: the account is back in the line under the name, as on Home, and every amount is one plain `Text` directly in its line, at its own size (no `flexShrink`, no shrink-to-fit). A test (it fails for an amount that shrinks or sits in a column) checks every amount in a day with a group open.

## Not established

No Android device is available here. The phone views so far are two screenshots from the owner (the open group above, and the Home-like day card, which was matched to Home's own measures and rendered in the browser, not tried on the phone). Things worth a look on one: the dashed outline of a bar still to come (a 4 dp tall rounded dashed border), the exact position of the bar letters under their bars with the phone's font, the soft tint under a picked day's heading, and the stacked layout at 360 dp.
