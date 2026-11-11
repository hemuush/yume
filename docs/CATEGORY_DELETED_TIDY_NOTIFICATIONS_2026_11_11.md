# Category detail, Recently deleted, Tidy up, Notifications and shape fixes — 11 November 2026

Approved from the design board (page "Category detail, Recently deleted, Tidy up, Notifications"). Same flat summary card as the earlier four ([BUDGETS_RECURRING_INVESTMENTS_PEOPLE_2026_11_11.md](BUDGETS_RECURRING_INVESTMENTS_PEOPLE_2026_11_11.md)); calculations, data access and actions are unchanged.

## Screens

- **Category detail** (`app/category/[id].tsx`): the one large card is now a `SummaryCard` (Spent/Received in the period as a 20 px figure, the parent category as a link pill beside it, Entries / Each / A day facts, and the refund line) followed by separate "Last 6 months" (with "usually …" beside the title) and "Where it went" `ListCard`s. "What if I cut this?" (or "View loans") is a full-width secondary button. The category's colour stays in the bars and split. Cards moved from a 20 to the shared 16 gutter.
- **Recently deleted**: "Waiting to be restored" with the count as a 20 px figure, "Oldest leaves in N days / then gone for good" beside it, and a one-line hint. The time-left rings, Restore and Delete all are unchanged; the lists are `ListCard`s.
- **Tidy up**: one `SummaryCard` holding the checklist: "Tidy up", "N things", "might not be what you meant", the three checks and the undo note. When nothing is found it says "All tidy / Nothing to fix". The fix lists are `ListCard`s.
- **Notifications**: the count is a 20 px figure with "things", "Do these first" beside it when anything is urgent, a bar split by urgent / soon / when you can, and the tone chips. Groups and the dismissed list are `ListCard`s.

## Shape fixes

- Export: the intro title is 20 px (was 22).
- Split: the "To split" card is a `SummaryCard` with a 20 px total (was 28) and a plain label in place of the icon disc; the parts list is a `ListCard`. The unused `GLASS_CARD` export was removed from `Glass.tsx`.
- Spending labels report: the net figure is 20 px (was 28).
- What-if: its cards are `SummaryCard`s, and its side margins use the 16 gutter instead of 20.
- Backup: the status card is a `SummaryCard`.
- Error banners on Home, Plan, Loans and Savings goals, Loans' placeholder cards and its "Closed" header moved from a 20 to the shared 16 side margin, so they line up with the cards they stand in for.
- Friends & family tile amounts are 20 px (were 21). Budgets' "% used" now says how far past the limit spending really is (the bar stops at 100).
- Dead code: the `frost` styles for the old hero (`hero`, `list`, `bigValue` and the rest) and `theme.typeSize.hero` were removed; `Frost.tsx` keeps only the icon-disc heading, chips and pace bar.
- Left as they were: Garden (a decorative screen with its own look) and the Themes live preview.

## Checks

`tsc`, eslint, prettier, the cycle check and `npm test` pass. Tests were updated for the new wording (Category detail's facts) and added for the Recently deleted summary. docs.expo.dev could not be reached from the build session. Nothing here has been run on a phone.

## Follow-up pass (same day)

- Categories: side margins 16 (were 20); tiles are 16-radius cards, the panel 18, the empty card 22, all with a hairline border (a selected tile keeps its 1 px border).
- Notification settings: the lists are `ListCard`s and "Your day with Yume" is a `SummaryCard`.
- Detail-sheet and card figures are 20 px (were 22): Loan, Goal, Budget and Entry heroes, the loan draft card, the insight card, the spending explanation, the prepay result and the loan-term stepper. Home's month figure and Plan's forecast figure were signed off at their sizes and are unchanged.
- The add-entry notices ("Add your first account", "tied to a loan or a person") and the investment sheet's Invested / Gain / Return trio were on `StripCard`, a card with a coloured strip and an older shadow; they are flat cards now and `StripCard` is gone (`KickerDot` stays in `StripCard.tsx`).
- Investments' split colours moved to `theme.colors.splitPalette`; the Reports placeholder uses the 16 gutter.
- Left as they were: Garden and its month card (decorative, own look), Themes' live preview, the illustration colours in `HeaderHills`.

## Gap sweep (same day)

- Loading placeholders: a `SummarySkeleton` (label, figure, bar in the summary card) now leads the placeholders on Budgets, Recurring, Category detail, Recently deleted and Tidy up, so the card does not jump when data arrives; `CardRowsSkeleton` uses the 18 radius of the list cards.
- Dead code removed: `HabitTile` (an unused Plan tile) and its styles, and four unused style keys (`compactIcon`, `sumFlow`, `sumTitle`, `catRight`).
- `ARCHITECTURE.md` no longer describes the count-up, the card transition or the staggered capsules.
