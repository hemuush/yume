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
