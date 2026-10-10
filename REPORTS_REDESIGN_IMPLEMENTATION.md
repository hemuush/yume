# Reports redesign — 11 October 2026

Implemented the approved Reports review in the native app.

- Stable shared sky header and period controls, with Days / Breakdown / Trends outside the scrolling content. The same controls remain available during loading and errors.
- Compact spending/income filters and a category/account selection sheet.
- Small breakdown total, aligned category rows, short deltas, and one comparison explanation. Partial periods explicitly compare recorded amounts with the full previous period.
- Category/account details and heatmap-day entries open in sheets. Existing category pages, Activity links, category-day filtering, retries and custom periods remain available.
- Expandable insights replace the horizontal carousel. All insight facts, actions and the fixed/flexible moon are retained.
- Consistent card corners and lighter rendering without the old card shadows, collapsed-header scroll work or unused carousel styles.
- Existing database queries, privacy filtering, stale-response protection, currency formatting, rounding, trend charts, cash flow and history remain in place.

Validation: 113 targeted tests passed across ReportsScreen, reportsInsights, TrendChart, CashFlowCard, CategoryScreen and RangeSheet. The final ReportsScreen rerun passed all 33 tests. TypeScript, changed-file ESLint and git diff checks passed. Expo Android export completed successfully (2,302 modules).

The CategoryScreen/RangeSheet run reported an outstanding asynchronous handle after all eight tests passed and was stopped. No claim of physical-device performance or native screenshot verification is made: scroll feel, keyboard/sheet transitions and large system fonts still need review on a phone. No APK was built for this change.
