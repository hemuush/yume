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

## Activity, compact timeline

A third Activity pass, drawn from a screenshot of the first timeline running on a phone. That version had made the summary card about 110 dp taller than the compact one it replaced (roughly 221 dp became 330), which pushed the entries down the screen, and its date tiles did not match the height of their cards. This pass keeps the card near its earlier height and replaces the tiles. It supersedes the summary, legend and date-tile parts of the section above.

- **Summary card.** About the height of the compact card. The figure and its comparison share the top row; the comparison is right-aligned, with the amount in colour and "than same days last week" in a quiet line under it. The card has a soft shadow, which is cheap because it is one element.
- **Week capsules.** Each day is a capsule in the theme's tint, 36 dp tall and up to 26 dp wide. The short amount sits directly over its own capsule, so it no longer floats above a short bar. The picked day rests on a stronger tint and shows its exact amount in bold in the same place; the separate bubble is used only when the short amounts are dropped at large text. Empty days show an empty capsule, future days a dimmed one.
- **Categories.** The split bar, its "Where it went" title and the tap hint are removed: the chips already carry the colours and amounts. The chips are one row that scrolls sideways, so the card never changes height with the number of categories. A fade marks that more chips lie beyond the edge, and a picked chip is scrolled into view so its ✕ is never hidden. The filter behaviour is unchanged.
- **Rail.** The date tile is replaced by a date column on the left edge and a thin rail with a dot per day beside one card. Today's dot is filled with the theme colour and ringed and its label reads TODAY; the day picked on the chart has an ink edge. The rail ends at the first and last day. The day's total appears under its date only from two lines up, in short form (+₹9.5k), because with one line it only repeats the entry beside it; the full total stays in the accessible label.
- **Separators.** Row separators are hairlines that start under the icon, so the icon column stays unbroken. They apply to entries, stacks, open stack entries, transfers and value updates.
- **Spacing.** Header, card and filter pills are 12 apart, the list starts 16 below the pills, and days are 14 apart.
- **Unchanged.** Large text, narrow screens and search keep the heading above the entries with no rail. Hand-ordering, stacks, search, filters and masking are unchanged.

### Design references

The search tools could reach only some sources from this environment; Nielsen Norman Group, Material and Monzo's own site were blocked, so those points come from search summaries rather than the full pages and are not treated as verified.

- Keep the list high on the screen: Monzo community feedback on its redesign ([thread](https://community.monzo.com/t/get-to-know-your-new-home-screen/151912)).
- Spacing inside a card tighter than between groups, with an extra step between groups ([Ramotion](https://www.ramotion.com/blog/proximity-gestalt-principle/), [proximity guide](https://openskillindex.com/skills/intense-visions-harness-engineering-design-gestalt-proximity)); few separators and no boxing of every group ([Guandata](https://docs.guandata.com/product/en/bi/466559634967101440)).
- People scan down the left edge of a list ([NN/g](https://www.nngroup.com/articles/right-justified-navigation-menus/)).
- Distinct, consistent category colours with a legend ([case study](https://contra.com/p/ER6X2r7O-budget-tracking-mobile-app)) and tap-to-drill-down ([Lincoln Financial](https://www.lincolnfinancial.com/public/microsite/wellnesspathhelp/managingmyfinances/mymoney/spending)).
- Scrolling chips: an edge fade, and keep a picked chip in view ([overflow-pattern prototype](https://josh-laurelai.github.io/ux-prototypes/smart-filters/), [Material chips](https://m2.material.io/components/chips)).
- Timelines: the connector ends at the last item ([PhiaUI timeline](https://hexdocs.pm/phia_ui/PhiaUi.Components.Timeline.html)); charts: tap to select with a persistent value, 44-point targets and a text alternative ([TanStack charts accessibility](https://unpkg.com/@tanstack/charts@1.2.0/docs/guides/accessibility.md)).

The full suite passed with the repository's locale settings: 370 suites and 11,831 tests, with two existing skips. This pass has not been run on a device.
## Loans

- `LoansHero` is the same flat summary card as the other screens: what you owe, the debt-free month and repaid share beside it, a split bar in each loan's own colour, small facts (EMIs a month, interest to go, owed to you) and the payoff timeline behind a disclosure.
- `LoanCard` keeps one pale icon tile, a 20 px principal figure, progress and a Next EMI row; that row is tinted when the EMI is within `DUE_SOON_DAYS` (shared with Home, now in `src/lib/dueDate.ts`) or overdue.
- The "Closed" divider is a normal muted label instead of an eyebrow.

## Savings goals

- `GoalsHero` is the same flat summary card as the other screens: saved so far (20 px), the share of the combined target beside it, a 6 px bar and one line with the monthly amount that keeps the goals on pace. With amounts hidden, the figure is masked and the share, bar and pace are withheld.
- Goals are rows in one card, separated by hairlines, instead of a tall card each. A row is the name with saved of target, a 6 px bar in the goal's colour, the share and date, and the pace with the monthly amount. "Reserved in…" and "Following…" sit in that second line.
- The wide Add money pill became a 32 dp round button inside a 44 dp touch area. Its accessibility label still says what it does (Add money, Manage reservation, Move money); a followed goal shows a swap icon.

## Plan, Money plan tab

- The monthly plan is the same flat summary card as the other screens: what is left to plan (20 px), a small "Income ₹x" link that opens the income editor, one bar split into spending and savings, and the two figures under it. "How this is calculated" opens inline; the notes about loans or goals that cannot be estimated stay.
- Budgets and goals keep their three-column tiles (one column with large text), but the tiles are compact: the icon and the figure share a row, so a tile is about 95 dp instead of at least 166 dp, with a 4 px bar and one small line ("₹1,800 left", "₹38K of ₹60K").
- Investments and the what-if idea are two tiles of the same kind in one "More" row.

## Plan, Debt tab

- The summary is the same flat card as the other screens, led by the debt-free month. Beside it are what is left and the share repaid; one bar is split by loan in each loan's own colour (the colour it has on Loans); money you lent shows as a green "Lent out" fact. "Compare an extra payment" is a row inside the card, shown when there are two or more borrowed loans, instead of a separate full-width button.
- Loans and Money lent are compact tiles, two to a row (one with large text): the loan's mark and what is left, the name, a 4 px bar of EMIs paid and "x of y paid · ends Mon YYYY". A tile whose next EMI is within `DUE_SOON_DAYS` (or late) has an amber strip saying when.

## Profile and Settings

- **Identity:** one slim card (about 60 dp) in place of the gradient card: a 40 dp avatar, the name at 16 px with "Member since … · On this phone, works offline" under it, and an edit button. The inline name editor and its Cancel/Save are unchanged.
- **You:** the money card is the same flat summary card as the other screens (what is in your accounts at 20 px, the account count beside it, a split bar by account type, a compact legend, and the tracked balance as one expandable row at its foot). Entries, Active loans and Friends are one strip of three cells instead of three 118 dp tiles. All accounts sit in one card under quiet type headers ("Bank · 2" with its subtotal), in 56 dp rows with a 32 dp icon; archived accounts are a footer row of that card, and the Plan pointer is a small link.
- **Settings:** Theme is one row with the swatches under it. The Safety check is a flat card with small tiles (backup, unlock, notifications). Money, Privacy & alerts and Your data keep every row, drawn with the compact `SettingsRow` (a 28 dp round icon, a 12 px line under the label, 52 dp tall) in 16 px-corner cards. `SettingsRow` takes a `compact` prop, so the other pages that use it are unchanged.

## Plan, Upcoming tab

- The tab keeps its structure (a switch between Money out and Scheduled income, a strip of dates, the day's payments) but is cleaner and shows more at once. The switch is a pill switch like Reports and Activity. The date strip is slim 32 dp pills (44 dp touch area) with **All** first and selected by default, so every payment in the 30 days lists at once under day headings; picking a date lists only that day. A date with a payment due now or late (red) or due soon (amber) carries a small dot, and says so in its accessibility label.
- The list is one flat card with compact 52 dp rows (a 32 dp icon, the title, a line under it, the amount). A day heading shows its date ("Today · …"), what leaves or arrives that day, and "· incl. overdue" when late items are counted in it. The status chips are gone: the line under the title says "Overdue by 2 days", "Due today" or "Due in 3 days" in red or amber. A due or close EMI keeps a small Pay pill; the whole row is the tap target and opens the pay sheet, as before.
- "Manage recurring" moved up to the section heading. `UpcomingDates` now takes `renderDays(days, mode)` and an optional `today`; `ComingUpSection` draws the list itself (Home's `UpcomingRow` is unchanged).
- Colors: every payment's icon sits on one neutral tint of the theme color (a 32 dp round tile); only income (pale green, green icon) and late or due-now payments (pale red, red icon) differ. Status wording keeps two meanings, red for overdue or due now and amber for due soon. Each day heading is a soft band: today in a pale tint of the theme color, later days in the neutral tray color, and a day that counts overdue items in pale red with red text.

## Home, motion and interaction

- **Opening:** on the first open after the app starts, each Home section rises 14 points while it fades in, one after the other (55 ms apart). Later reloads (a new month, a refresh) stay one quick fade, so the screen never replays it. Reduce motion turns it off.
- **The month, tappable:** each slice of the month line (Spent, Saved, Bills left, Free) is a button, and so is each legend item. The picked slice grows from 12 to 18 dp and the rest step back; the headline takes over its label, figure and a short caption ("Spent this month", "Bills still to pay"…) and rolls to the new figure. Picking it again, or turning the month, puts Free back. Bills left still opens the sum behind the figure, and closes it when picked again. A haptic tick marks each pick. Savings cannot be picked while those amounts are hidden.
- **This week:** the capsules rise from empty, one after another, the first time they show, and the picked day stands a little taller (scale 1.08).
