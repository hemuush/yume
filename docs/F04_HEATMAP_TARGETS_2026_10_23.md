# F04 — accessible heatmap selection

The calendar's 40dp-high cells and the matrix's roughly 10×16dp day buttons were below the requested 44dp target. Tiny year-view month labels were also buttons.

Calendar day controls now have a 44dp minimum in both directions. Reduced outer padding and 1dp column gutters leave enough width in the 360dp layout; scrubbing accounts for gutters and the measured weekday header. At larger text sizes the header can grow.

The year matrix retains its overview and drag inspection. Its individual tiny cells/month labels are decorative, grouped as a chart for accessibility. A full-size “Choose day or month” action opens searchable, virtualized rows in the shared native sheet. Day rows announce date, spending and year; future days cannot be selected. Full-size month rows preserve supported month navigation. Matrix label width/row height follows text scale, and scrubbing uses those dimensions.

## Files / tests

- [SpendHeatmap.tsx](../src/features/reports/SpendHeatmap.tsx): target geometry, overview semantics and scaled hit testing.
- [HeatmapDayPicker.tsx](../src/features/reports/HeatmapDayPicker.tsx): chooser, date/month filtering and virtualized rows.
- [HeatmapCard.tsx](../src/features/reports/HeatmapCard.tsx): room for seven 44dp calendar controls at 360dp.
- [SpendHeatmap.test.tsx](../src/features/reports/SpendHeatmap.test.tsx): four RNTL behavior tests.
- [architecture](ARCHITECTURE.md) and this record.

All four new tests failed before implementation. After the fix, the focused new/existing Reports run passed **2 suites / 37 tests**, covering calendar tap, searchable day selection, month navigation and empty/future search results. Fresh full regression: **329 suites / 11,425 tests passed; 2 suites/tests skipped**, 318.6 seconds. TypeScript, whole-repository lint, formatting and cycle checks passed.

No financial queries, stored records, dependency or date-range semantics changed. Labels are constructed only while the chooser is open. Rows have stable keys, variable heights and bounded virtualization; no fixed item-height assumption is made for large text. The sheet uses one native window, handles keyboard taps and closes before dispatching selection.

## Risk / Android acceptance

Native checks remain pending: at 360dp and tablet widths, tap calendar edges, scrub after resizing, pick a year-view day/month, search with the keyboard, cancel with Android Back, use long labels/200% text and TalkBack. Verify the selected inspector and its Open day flow. Repeat under OS dark appearance with the configured light app. iOS is outside scope.

The deliberate interaction change is that precision year selection uses the chooser, rather than hundreds of tiny buttons. Drag inspection remains available. Calendar targets are 44dp minimum rather than 40dp high; year selection uses full-width rows at least 44dp high instead of tiny cells. No native frame-time result is claimed.

Rollback: revert this fix's commit; no migration required. This restores the undersized buttons.
