# Optimization and structure review

Recorded 13 October 2026 against local changes after `36cb45f`. No APK or bundle was built.

## Changes

- Activity chart scoping moved from the route into `transactions.helpers.ts`, alongside existing period/filter logic. It reuses memoized account/category maps and combines currency/privacy filtering into one transaction pass. Account lookup changes from a linear search per transaction to a map lookup. Input order, missing-account exclusion and whole-category privacy remain intact.
- Shared database read caching rejects negative ages after a clock rollback, matching screen freshness behavior. Concurrent reads still share a promise; writes, expiry and failed reads invalidate it.
- Shortened the read-cache and shared header/backdrop comments. Retained comments explaining transaction boundaries, privacy and platform constraints. The apparent long blocks in file-picker code were regex matches starting inside the MIME string `*/*`, not commented-out implementations.

## Structure and unused-code review

Scanned repository source sizes, comment blocks, console/debug markers and TypeScript-resolved local import references. Existing ownership stays: routes coordinate screens, feature modules own presentation/helpers, database modules own persistence, and library modules own shared calculations/platform workflows. Large reports/settings/transaction files contain active orchestration and SQL contracts; size alone is not a safe reason to split or delete them.

The only source files without production TypeScript importers were `widgets/widgetTaskHandler.ts` (registered by `index.js`), `test-support/reanimatedMock.ts` (Jest setup) and `perf/seedLedger.ts` (performance fixtures). All were retained. This import scan does not prove every public export is required. TypeScript unused-local/parameter checks passed. No dependency or financial feature was removed.

## Fresh validation

- 28 targeted tests passed across five suites: read cache, Activity helpers/screen/motion and shared header motion.
- Two performance suites passed on the existing 20,000-entry fixture, including output parity. Measured database workloads: Home 83ms/52 queries, Activity month 14ms/15 queries, Reports month 123ms/51 queries, Plan 10ms/5 queries, backup snapshot 55ms/1 query. These are desktop fixture measurements, not device rendering benchmarks or a before/after speed claim.
- Type checking, lint and formatting passed; diff whitespace checks passed.

No full regression run, physical-device profiling, installation or release signoff was performed in this pass. Device scroll/frame performance remains open.
