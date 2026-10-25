# F05 — retain every Quick Add action with larger targets

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Decision / root cause

The user approved retaining all actions and increasing the minimum widget footprint. Previously the main action was 38dp high, Income/Move 28dp, and four category shortcuts shared the space inside a 140dp-wide widget. Height changes alone would leave category widths below 44dp.

[QuickAddWidget](../src/widgets/QuickAddWidget.tsx) now uses shared [layout tokens](../src/widgets/widgetTheme.ts): main/secondary actions are 44dp high; category containers are 48dp high. [Native metadata](../app.json:90) requires 208×184dp. Grid-cell hints are omitted so the launcher calculates placement from these dp bounds on all supported Android versions. The precise cell footprint depends on the launcher. With 12dp padding and a 1dp shell border, the four category columns have at least 45.5dp each; secondary actions have at least 88dp each. The three rows consume 136dp of 158dp inner height, leaving 22dp for their two flexible gaps.

All seven expense/category/income/transfer deep links remain, including encoded category IDs. The native metadata and regenerated [picker image](../assets/widget-preview/quick-add.png) ship together in a new Android build. Existing widgets and launcher caches need upgrade/resize acceptance; JS refresh alone does not distribute new provider dimensions or picker assets.

## Files / validation

- QuickAddWidget, widgetTheme, app.json, quickAddTargets.test.tsx.
- The [preview generator](../scripts/generateWidgetPreviews.cjs) uses the same minimum tokens for Quick Add's picker and minimum-size QA rendering. Its overview canvas grows so the enlarged card does not overlap the neighboring preview.
- The Quick Add PNG is 416×368 at twice logical size; the other four generated picker images are byte-unchanged.

The new regression failed before correction: expected action height ≥44, received 38. It verifies seven exact URIs, category ID encoding, all action heights, available category/secondary widths and all row heights against the native minimum including padding/border. The focused new/existing widget run passes **2 suites / 9 tests**.

Final review caught a flaw in the first implementation's 3×3 hint: [Android 12 uses target-cell attributes instead of dp minima](https://developer.android.com/develop/ui/views/appwidgets/layouts), so a dense launcher could still supply insufficient space. A second regression failed while those hints were present; the hints are now omitted. The PNG and component geometry are unchanged. This correction is committed separately from capture protection; the final combined regression follows it.

After that correction and F06, strict type-check and scoped lint/formatting pass; whole-repository lint/format/cycle checks had also passed with the new source. Fresh final full coverage run: **333 suites / 11,446 tests pass; 2 suites/tests skipped**, 386.2 seconds, line coverage **88.41%** (original revision 88.18%). No failure from the canceled intermediate run is counted as a pass.

Both regular and minimum-size preview generation passed. Visual inspection of the regenerated Quick Add confirmed all actions fit with distinct rows and readable labels. This is a browser approximation, not native RemoteViews/TalkBack acceptance. Type-check, whole-repository lint, formatting and cycle checks pass. Fresh full regression: **332 suites / 11,435 tests pass; 2 suites/tests skipped**, 396.8 seconds. Those performance suites are run separately in final verification.

## Risk / acceptance / rollback

The approved larger minimum occupies more launcher space. No data model, category ranking, privacy or link behavior changes. No dependency addition. Revert this finding's commit to restore the previous provider dimensions, renderer and PNG together; no migration.

On Android, install the rebuilt candidate, add a new Quick Add, resize to minimum and larger bounds, tap all seven actions (also while app-locked), and verify TalkBack labels/bounds. Check a four-column and five-column launcher, existing-widget upgrade/reboot, long category labels, empty categories, enlarged OS text and configured-light appearance under OS dark mode. iOS is outside scope. No startup/frame-rate improvement is claimed.
