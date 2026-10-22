# Reports redesign (22 October 2026)

Presentation and interaction pass over Reports. Queries, privacy scope and calculations are unchanged; the
screen reads two extra things it already had: the previous period's daily totals (the hero's comparison line)
and, for a calendar month, the sum of that month's budget limits (`listBudgetsForMonth`).

**Overview** (the old Days tab, renamed). `ReportHero` shows spent so far in the Home headline style, a running
total against the period before (and the budget line when there is one) that can be scrubbed day by day, a
"under / over budget at this pace" chip, and an Income / Kept / Budget-used strip. The picked day is shared
with the heatmap below.

`HeatmapCard` is rebuilt (`buildHeat`, `SpendHeatmap`, `DayInspector`). A month or short custom range is a calendar
with each week's total down the edge, the amount printed on heavy days and a dot on days above 2.4 times the
usual day; a year or long range is a month by day-of-month matrix (rows open that month). A horizontal drag
across the grid picks the day under the finger, a tap picks one. Category chips recolour the grid to one
category (the same filter "See its days on the heatmap" sets). Picking a day only inspects it: its spend
against the usual day and what it was made of, read a moment after the finger settles; "Open day" opens its
entries sheet as before. Highlights are swipeable cards (the old accordion, with the same actions), then the
weekday rhythm and the biggest spends, no longer behind a "Spending patterns" fold.

**Breakdown.** The split can be drawn as tiles (`treemapLayout`, area proportional to share) or as the former
bar; rows, the sheet and the By account grouping are unchanged.

**Trends.** The picked month floats a value over the chart and a month still going shows a dashed "projected"
end at its pace so far.

**Motion.** The hero line draws in once per app open and glides on a change; heatmap cells fade in as a wave;
weekday bars grow from the baseline; tiles move to their new place when the split changes; tabs have a sliding
underline; the tab body fades in. Reduced motion is respected.

Verified by the full Jest suite, lint and types; not yet checked on a device.
