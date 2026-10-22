# Home redesign (22 October 2026)

The owner approved a calmer Home from an interactive design (one screen, option C for Coming up) and asked for Budgets and Goals to join the Upcoming card. Everything Home did before is kept; this is the record of what changed. Nothing here has been run on a phone: the automated checks are the full Jest run, typecheck, lint, the cycle check and the Android export.

## What changed

- **Coming up replaces Next up.** One list of payments, budgets and goals, the most pressing first, with chips to narrow it. The ranking and its rules are in `src/features/home/comingUp.ts` and are described in the architecture guide. Payments used to be the three largest outgoing amounts at any date; they are now ranked by date within a month, because "most pressing" has to mean time for a bill and over-limit for a budget.
- **The month card has one line.** The free figure uses the headline size of Plan and Reports. A rounded line shows spent, saved, bills still to pay and free in the colours of the legend beneath it, drawn in once per period. The "how this adds up" button sits next to the label.
- **Today and the last seven days are their own card**, under the month card and turning its page with it.
- **Accounts is a swipeable row** of the accounts that hold a balance, instead of a grid of up to six, with an Add account tile at the end.
- **Cards are the app's one card** (cream, rounded, a hairline edge, no shadow) in place of frosted glass.

## Kept as it was

Month picker and swipe, the calculation disclosure with recap links, the daily allowance and its working, Insights, the three Add buttons, the bell count, pull to refresh, skeletons, accounts with privacy masking, pending refunds, Recent activity, and the header's collapse.

## Decisions

- Budgets use this month's budgets (`listBudgetsForMonth`, sensitive categories left out while savings are hidden); goals are the open ones. Both are read with Home's other data and left out, not an error, if their read fails.
- With savings hidden, the month line fills the width from the parts that remain instead of leaving a gap.
- A chip dot means something needs a look: a payment due soon or late, a budget over or ahead of pace, a goal behind pace.

## Not done

Phone acceptance of the layout, the new motion and the swipeable accounts row on small and large text sizes.

## Refinement after first use (22 October)

- The free figure was far larger than any other screen's: it now matches the headline size, and cards, row text and accounts tiles use the shared styles.
- On All, Coming up shows up to three payments, one budget and one goal; a chip shows up to five of one kind. Several pending refunds read as one total that opens into the list.
- Accounts with no balance leave the row (still under View all). Tiles are flat and memoised, which keeps the sideways scroll light.
- The month line and goal rings draw on the UI thread (`useDrawnValue`), the today meter glides, and cards and sections slide into place when a panel opens or a filter changes.
