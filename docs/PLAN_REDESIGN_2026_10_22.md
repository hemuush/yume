# Plan redesign (2026-10-22)

Not yet verified on a device.

- **Runway card** (`RunwayCard` compact, `RunwayChart`): a flat card with the spending-account balance, a verdict chip
  (Covered / "X more needed" / Nothing due) and a step chart of the balance over the next 30 days drawn in the theme
  accent. Touch or drag the chart (`useScrub`) to read any day: its balance after that day's payments and what moved.
  It opens on the first shortfall day when there is one. All figures come from the already-loaded `Runway`.
- **Needs attention** (`PlanOverviewPanels`) leads with "Balance runs short" when the runway goes below zero.
- Text sizes use the theme type scale and `Text`, so they follow the phone's font-size setting.
