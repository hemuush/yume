# Budgets, Recurring, Investments and Friends & family — 11 November 2026

Approved from the design board (page "Budgets, Recurring, Investments, People") and built on the same flat summary card as Loans. Calculations, data access and actions are unchanged; only presentation moved.

## Shared pieces

[SummaryCard.tsx](../src/components/SummaryCard.tsx) holds what the four screens share:

- `SummaryCard`: the flat card (surface fill, soft border, lifted shadow, 22 radius) under the header.
- `SummaryTop`, `SummarySide`, `summaryFigure`: a 12 px label over a 20 px figure, and a short right-aligned note. `SummarySide` can take a `tone`.
- `SummaryFacts`: label-and-value facts in a wrapping row. A column keeps its width as the font grows (84 px × font scale, capped at 2), so facts wrap instead of squeezing.
- `SummarySplit`: one 8 px bar split by weight in each part's own colour; empty parts are dropped.
- `ListCard`: a flat card (radius 18) for lists whose rows divide themselves.

`PaceBar` (Frost) takes an optional `height` (10 by default, 8 on the summary cards).

## Screens

- **Budgets** — `BudgetsHero`: "Left this month" (or "Over this month") with the daily allowance and days left beside it; a pace bar with a tick at the even-pace position and "N% used / Even pace N%" under it; facts for Spent, Limit and one "Needs a look" fact (`1 over · 1 ahead`, red when anything is over, amber when only ahead, "On track" green otherwise). The status chips are gone. The list is a `ListCard`; `BudgetRow` is unchanged.
- **Recurring** — `RecurringHero`: "Subscriptions & bills" with the month's cost and "a month", the year's cost beside it, a split bar by category colour (two or more rules), facts for Running, Next due and Biggest, the "Biggest slice" sentence, and the 30-day timeline behind the existing disclosure. With nothing running it is a title and one line about the page. Running, Paused and "Not set up yet" lists are `ListCard`s. Money in is not a fact here: the hero only knows the expense rules' totals.
- **Investments** — `InvestmentsHero`: one card, "Worth now", the return beside it (green or red), facts for Put in, Taken out (only when there is some), Gain and SIPs a month, then the yearly rate and the existing hints. The first-visit card is the same card. The chart, the split and the holdings, other-currency and SIP lists are flat `ListCard`s. With savings hidden every figure is masked and tones are neutral.
- **Friends & family** — `PeopleNet`: the net (signed, green or red) with "N people" and "X owe you · you owe Y" beside it, a split bar of the two sides, and facts for Owed to you and You owe. Person tiles are flat 16-radius cards, two across; Settled is a `ListCard`.

## Left as it was

The Lapsed budgets note, row layouts (`BudgetRow`, `RuleRow`, `HoldingRow`, `PersonQuietRow`), every sheet and modal, and all calculations.

## Checks

`tsc`, eslint, prettier, the cycle check and `npm test` pass; new tests cover `SummaryCard`, `BudgetsHero` and `PeopleNet`, and the `RecurringHero` expectations were updated to the new wording. docs.expo.dev could not be reached from the build session, so the SDK 58 pages were not re-read; the change uses only styling already used elsewhere in the repo (`boxShadow`, `screenStyles.card`). Nothing here has been run on a phone: check the four screens at 1x and 1.3x font size on a device.
