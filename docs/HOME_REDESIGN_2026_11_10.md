# Approved Home redesign — 10 November 2026

The user approved a side-by-side design canvas (current Home recreated from source beside the proposal) before implementation. The redesign retains the selected theme, logo, cream surfaces, Fredoka greeting, Archivo figures, rounded cards, account carousel, semantic allocation colours and floating navigation. It supersedes two points of the [5 November refinement](HOME_REFINEMENT_2026_11_05.md): the spending chart no longer sits inside the summary card.

A same-day compact follow-up, requested by the user while reviewing Activity, returned Home's type to the earlier compact scale: no figure is larger than the shared 30-pixel headline, and text continues to follow the phone's font setting up to the existing 200% limit.

## Implemented presentation

- **Summary card.** The available amount stays at the shared 30-pixel headline size. The per-day estimate is a theme-tinted pill under it ("About ₹X a day for N days"), still absent when the existing calculation returns no allowance and still distinct from the saved daily goal. The allocation line is 12 pixels tall; in the current month a tick marks today's share of the month beside a "Day N of M" caption. **How it adds up** and the deduction caption share the card's footer. Labels, signed arithmetic, period control, swipe and the disclosure are unchanged.
- **This week card.** The spending chart is its own card under the entry shortcuts, titled **This week** (or **Spending by week** in a past month) with **Insights** as the heading action. The current week shows its seven-day total as a summary line; a past month shows none, because the bars count money out before refunds and could disagree with the card's net Spent figure. The picked day's amount is larger, with a meter against the daily goal when one applies. Bar selection, the outgoing basis, square-root heights on the 60-pixel track, goal markers and the allowance explanation are unchanged. The card still turns its page with the summary card.
- **Section summaries.** `Section` accepts an optional `subtitle`. **Your accounts** shows the in-hand total: positive bank, cash and wallet balances in the default currency, excluding savings, investments and cards, so it cannot reveal a hidden savings figure. **Coming up** shows the existing still-to-pay figure for the month.
- **Coming up rows.** On Home only, a payable bill states its amount beside the due date so **Pay** ends the row; Overdue and Due now keep their chip. Budget rows gain a progress bar in the budget's existing tone. Plan's rows are unchanged.
- **Recent activity.** Rows are grouped under a day label. Today's label carries today's outgoing total (the figure already loaded for the daily goal); other days carry no total because Home loads only the five latest entries.
- **Header and tiles.** The date and greeting keep their 11 and 20 pixel sizes. Account tiles keep their 148 width and 16-pixel balance; a negative balance uses the expense text colour. Loading placeholders follow the new shapes.

No ledger query, stored data, financial rule or navigation target changed.

## Verification

The full suite passed with the repository's locale settings: 368 suites and 11,812 tests, with two existing skips. Typecheck, lint, formatting and import-cycle checks passed. Assertions were updated for the allowance pill wording and the Insights action's new accessible label.

The design canvas is a browser mock-up with sample figures; it is not a screenshot or performance measurement of this React Native implementation. The versioned Expo documentation could not be reached from the build environment; the change uses only React Native core views and existing project components. Physical Pixel acceptance must check 100%/200% text, large and negative amounts, all themes, month/year navigation, hidden savings, bar selection, the day tick at month start and end, and the Pay row with long bill names.

## Compact Activity

Approved from the same canvas after the user rejected a first, larger proposal and asked for a compact screen with no large text.

- **Summary card.** Spent, Money in and Left sit side by side as label-over-value figures: Spent at 20 logical pixels, the others at 14. The comparison with the previous period is one line under them. On a narrow screen or above 120% text the figures stack. Money in and Left still appear only when the period has income.
- **Chart.** The bar track is 48 pixels instead of 60. Segments, selection, the amount bubble, placeholders for outside and future days and the legend are unchanged.
- **Type filter.** The five types are 36-pixel pills in a sideways-scrolling row after the Filters button, with the touch area kept at 44 through hit slop; on a narrow screen or at large text they wrap. Picked category, account and label chips, the filter count and Clear all are unchanged.
- **Days.** Day headings are 13 pixels; Today and Yesterday also show the weekday. Rows are at least 48 pixels with a 32-pixel category disc; row text stays 14 with a 12-pixel line under it. A stack shows its entry count beside the chevron. Hand-ordering, stacks, transfers, value updates and savings masking are unchanged.

Search, the filter sheet, the entry sheet, the period bar and the shared header were not changed. The full suite passed after this pass with the same counts as above.

## Compact Reports

Approved from the same canvas, to the same compact scale: nothing on Overview or Breakdown is larger than 20 logical pixels.

- **Header.** The tagline under the title is removed. In Reports' own header the period pill and period-type chip are 44 pixels tall instead of 48; the arrows keep their 44-pixel touch size. The category page's period row is unchanged.
- **Overview summary.** Spent (20), Income and Kept (14) sit side by side, each with its one small line: per-day spend, income change, share kept. The label reads "Spent" or "Spent so far"; the accessible label still names the period. The budgets bar follows. On a narrow screen or above 120% text the figures stack.
- **Calendar.** Day cells remain 44 pixels in each direction. A 38-pixel cell was proposed and then withdrawn, because the existing touch-size guarantee for calendar days is deliberate. The category picker is a 32-pixel pill with hit slop, and the card's padding is tighter.
- **Picked day.** The amount is 16 pixels on one wrapping line with its comparison to a usual day; Open day and the category split are unchanged.
- **Worth a look and Biggest spends.** Same content in tighter rows: 32-pixel marks, 12-pixel detail lines, and 48-pixel Biggest spends rows. The day sheet's rows keep the shared size.
- **Breakdown.** Spending/Income is a compact switch at the start of the summary card's heading row, beside the grouping picker, instead of a full-width row above the card. "Where it went" / "Where it came from" stays as a small label over the total, which is 20 pixels. Each row puts name and amount on its first line, then the share bar, then share and change.

`SegmentedControl` gained a `compact` option for this switch (32 pixels tall, touch area extended by hit slop). Trends, the sheets, queries and report calculations were not changed. The full suite passed after this pass with the same counts as above.

## Plan overview

Approved from the same canvas after a first proposal that only tightened the existing rows was sent back for a more considered design. Nothing on the Overview tab is larger than the 15-pixel section size.

- **Header.** The tagline under the title is removed.
- **Runway card.** The card opens with the verdict in words (Covered, Nothing due, or the amount still needed) under the existing "Runway · next N days" label, with one line naming the lowest balance and its day. The 30-pixel balance is gone; **Now, Going out, Coming in** and the closing balance read left to right as four 14-pixel figures. The link names the count ("View 4 payments") and keeps its "View payments" accessible label.
- **Runway ribbon.** `RunwayRibbon` replaces the tall chart on Overview: a 62-pixel balance line on the same zero-based scale, a row of pips (coral where money goes out, green where it comes in), weekly date ticks and one line reading the picked day. It opens on the first shortfall or the lowest day and is read by tap, drag or the screen reader's adjust actions. The window is the existing 30 days, so days are pips rather than the tappable date numbers drawn for a 14-day sample in the design.
- **Full chart.** The original `RunwayChart`, with its guides, labels and readout, now sits at the top of the Forecast details sheet.
- **Needs attention.** Same alerts and order, each as one tinted line under the section title.
- **Your plans.** Four tiles in two columns (one above 130% text or on a very narrow screen) that show standing rather than a description: Debt (amount left, repaid share as a bar, the debt-free month), Budgets (used of budgeted, a bar split by budget with over-limit budgets in the expense colour, the count over), Goals (total saved, the leading goal's progress, how many are reached; withheld when savings are hidden) and Investments (value, gain, values due). Each opens what its row opened before. The repaid share stays a bar only: its figure remains on the Debt tab, as an existing test requires.
- **People & habit.** `PlanPeopleHabit` shows Friends and Spend streak as two rows in one card. Up to two people appear as initials that open that person directly, as the tile's chips did; To collect and To pay back appear when non-zero; the streak keeps its week of growing sprouts. `PeopleTile` and `HabitTile` remain in the codebase for their existing tests.
- **Other tabs.** `PlanSummaryRow` (budget and goal rows) is 52 pixels with a 32-pixel icon instead of 64 and 34. Upcoming, Money plan and Debt are otherwise unchanged.

No runway, budget, goal, loan or people calculation changed. `RunwayRibbon` has its own tests; no existing Plan test was altered. The full suite passed: 369 suites and 11,815 tests, with two existing skips.

## Activity as a timeline

A second Activity pass, approved from the same canvas after the compact pass above had merged. It changes how the screen is used, at the same type scale.

- **Week strip.** In Week the chart shows a short amount over every bar, the weekday and the date under it; today's date carries the theme pill. The picked day sits on a soft tray and shows its exact amount. Short amounts are left off above 120% text. Month keeps its week buckets with their day ranges.
- **Categories as filters.** `CategorySplit` replaces the legend under the chart: one split bar and a chip per top-level category with its amount. Tapping a chip sets Activity's existing category filter to that category (a subcategory counts for its parent); tapping it again clears it. The chips always show the whole period's split, a picked category is never folded behind "+N more", and uncategorized spending is shown but is not a filter. A type filter that hides spending returns to All when a chip is picked. The filter sheet and the removable chips under the type pills show the same filter.
- **Narrowed summary.** While categories are filtered, the bars and the figure show only what went on them ("Spent on Dining out this week"), and the comparison and cash flow, which describe the whole period, are hidden.
- **Summary layout.** The comparison is a tinted pill beside the figure. Money in and Left are one wrapping line under the categories.
- **Date tiles.** Each day's weekday, date and net total sit in a tile beside its entries instead of a heading above them; today's tile is tinted and the day picked on the chart takes an ink edge. The tile reads to a screen reader as one heading. On a narrow screen, above 120% text and in search results the heading above the entries is kept. A total too long for the tile is shown in short form; its exact value stays in the accessible label.

Hand-ordering, stacks, transfers, value updates, search and savings masking are unchanged. New tests cover `CategorySplit`, the narrowed headline and the date tile. The full suite passed: 370 suites and 11,822 tests, with two existing skips.
