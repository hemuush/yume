# Home redesign (22 October 2026)

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

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

## One calm month card (22 October, later)

The month card and the "today and week" card are now one card. Top to bottom: the label with its working button
and the month pill; the free figure beside a small tile (a ring for the days left in the month, and what can be
spent a day for them: free money over the days after today, current month only, left out when nothing is
free); the caption; the month line (10px, with today's date pinned over it in the month's proportion) and a
legend of one column per slice (spent, saved, bills, free) with its compact amount and share of what the
month had to spend; then the week. The week is seven soft capsules, empty days kept as empty capsules, each
with its amount over it, and a dashed tick at the daily goal on every capsule (past months show their weeks the
same way, with no goal). The row above the capsules reads the picked day (today to begin with): its amount
and a chip: "No spending", "N left", "N over", or "A big day" past four times the goal (calm amber, never
red). Tapping today's row, when a goal is set, opens how the allowance works.

Theme and phone: every colour that is the user's comes from their selected theme (the capsule gradient runs
from the theme's two colours, the track and the corner glow are tints of its main colour, the days ring is its
ink); the slice colours keep their meaning. Text follows the phone's font setting up to the app's 130% cap
(`Text`): the figure and tile wrap onto two lines, the legend pairs up into two rows past 115%, the
capsules grow taller and drop the amounts over them (the picked day's is still in the row above), so nothing is
cut off. The daily-goal meter and the separate "Spent · last 7 days" header are gone; the goal, its working and
Insights moved into the week.

## 2026-11-12: the month ring

The month card now shows the month as a 112 dp ring (spent, saved, bills left, free) with the headline figure in its middle and a one-line-per-slice legend beside it, replacing the full-width month line and the separate 30 px figure. This keeps the card compact on Pixel-width phones (360-412 dp); at large text sizes the legend wraps under the ring. (A thin outer ring that marked the day of the month was removed on 13 Nov: nothing explained it and the card's pill already names the days left.) The slices are picked from the legend (the ring itself is a single image for screen readers). The ring does not animate. This supersedes the month-line and 18 dp grow notes above and in `HOME_REDESIGN_2026_11_10.md`.

## 2026-11-12: alignment fixes from a phone screenshot

- Very small slices of the month ring (Bills left and Free late in the month, a few percent of the ring) were drawn as round dots a whole stroke wide, so they overlapped each other and Free was hidden. A slice too small for round caps now draws as a thin flat bar (at least 2 dp) centred in its own slot, so every slice stays visible and none overlap.
- The account tiles had 4 dp of vertical padding the other cards lack, which put them 4 dp lower than the cards above and gave Coming up an extra 4 dp. The padding is gone.

## 2026-11-12: the ring is centred in the card

The ring and its legend had been centred together as one group, which left the ring itself left of the card's middle. The ring is now exactly centred: the legend splits into two equal halves (the first half of the slices on the left, flush to the card's left edge; the rest on the right, flush to the right edge), each slice a name over its figure. This needs about 380 dp and normal text. On a narrower phone or above 1.15 font scale the ring stays centred on its own line and the legend drops under it in the usual wrapping columns. Before there is any income there is no legend and the ring stays centred. This replaces the "capped at 200 dp and centred beside the ring" note above.

A legend figure is one line and shrinks (down to 75%) to fit its half of the legend, so a large amount like ₹12,34,56,789 is not cut to "₹12,34,56…". Above 130% text the shared Text wraps figures instead of shrinking them, and the legend is under the ring by then.
