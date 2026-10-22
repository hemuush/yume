# Reports, calmer (2026-10-22)

Not yet verified on a device. This supersedes the layout in `REPORTS_REDESIGN_2026_10_22.md`; read that for the
scrubbing and day-inspector behaviour that is unchanged.

Why: the first redesign stacked about eight differently styled blocks on Overview, repeated the same figures,
clipped a tooltip and a few lines of text, drew Breakdown's tiles in near-identical pinks, and put long
explanations under the Trends chart.

- **Tabs and header match Plan.** Overview / Breakdown / Trends use the same pill `SegmentedControl` and margins as
  Plan's tabs, the Trends metric switch (Spending / Cash flow / Net worth) and Breakdown's Spending / Income
  switch use it too, and the header has a subtitle like Plan's.
- **Overview.** One card (`ReportHero`): spent, a day, the budget as a single bar, income and kept. No chart.
  The heatmap card has one "All spending" dropdown instead of a row of category chips, no week-total column and no
  amounts inside cells; its levels follow rank once there are 8+ spending days (`heatLevelFor`) so one huge day
  cannot wash out the rest, and the big-day dot marks it. "Worth a look" is plain rows (`ReportInsights`), and the
  weekday chart is gone (the weekend read is one of the rows).
- **Breakdown.** Spending / Income switch, then one card with the title, a "By category" dropdown, the total and the
  split as one bar, then the list. The tile view and its toggle were removed.
- **Trends.** The floating tooltip and the duplicate month-chip row are gone (the chart is one adjustable control
  for screen readers; the readout under it names the picked month); the scale and dashed-line notes moved behind
  "How this is worked out"; the cash-flow and usual-month footnotes were dropped.
