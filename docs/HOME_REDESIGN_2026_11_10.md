# Approved Home redesign — 10 November 2026

The user approved a side-by-side design canvas (current Home recreated from source beside the proposal) before implementation. The redesign retains the selected theme, logo, cream surfaces, Fredoka greeting, Archivo figures, rounded cards, account carousel, semantic allocation colours and floating navigation. It supersedes two points of the [5 November refinement](HOME_REFINEMENT_2026_11_05.md): the spending chart no longer sits inside the summary card, and the headline figure is larger.

## Implemented presentation

- **Summary card.** The available amount is 44 logical pixels. The per-day estimate is a theme-tinted pill under it ("About ₹X a day for N days"), still absent when the existing calculation returns no allowance and still distinct from the saved daily goal. The allocation line is 12 pixels tall; in the current month a tick marks today's share of the month beside a "Day N of M" caption. **How it adds up** and the deduction caption share the card's footer. Labels, signed arithmetic, period control, swipe and the disclosure are unchanged.
- **This week card.** The spending chart is its own card under the entry shortcuts, titled **This week** (or **Spending by week** in a past month) with the window's total as a summary line and **Insights** as the heading action. The picked day's amount is larger, with a meter against the daily goal when one applies. Bar selection, the outgoing basis, square-root heights (now on a 72-pixel track), goal markers and the allowance explanation are unchanged. The card still turns its page with the summary card.
- **Section summaries.** `Section` accepts an optional `subtitle`. **Your accounts** shows the in-hand total: positive bank, cash and wallet balances in the default currency, excluding savings, investments and cards, so it cannot reveal a hidden savings figure. **Coming up** shows the existing still-to-pay figure for the month.
- **Coming up rows.** On Home only, a payable bill states its amount beside the due date so **Pay** ends the row; Overdue and Due now keep their chip. Budget rows gain a progress bar in the budget's existing tone. Plan's rows are unchanged.
- **Recent activity.** Rows are grouped under a day label. Today's label carries today's outgoing total (the figure already loaded for the daily goal); other days carry no total because Home loads only the five latest entries.
- **Header and tiles.** The date is 12 and the greeting 22 logical pixels. Account tiles are 152 wide with an 18-pixel balance; a negative balance uses the expense text colour. Loading placeholders follow the new shapes.

No ledger query, stored data, financial rule or navigation target changed.

## Verification

The full suite passed with the repository's locale settings: 368 suites and 11,812 tests, with two existing skips. Typecheck, lint, formatting and import-cycle checks passed. Assertions were updated for the 72-pixel chart track, 152-pixel tiles, the allowance pill wording and the Insights action's new accessible label.

The design canvas is a browser mock-up with sample figures; it is not a screenshot or performance measurement of this React Native implementation. The versioned Expo documentation could not be reached from the build environment; the change uses only React Native core views and existing project components. Physical Pixel acceptance must check 100%/200% text, large and negative amounts, all themes, month/year navigation, hidden savings, bar selection, the day tick at month start and end, and the Pay row with long bill names.
