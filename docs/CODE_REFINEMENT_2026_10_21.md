# Code refinement — 21 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Changes start from `b5008c9`. This pass preserves the current screen design, selected palette and financial contracts. It does not create an APK or commit changes.

## Review and structure

Reviewed the TypeScript import graph, exported-function references, shared controls, Home account/chart paths, Activity filtering, Plan snapshot lookups, Add draft recovery and current documentation. The initial scan covered 434 production source files. Reference scans identify candidates, not proof of device behavior or a line-by-line audit of every module.

- Removed the unused payment-method totals module after verifying no production importer remained. Optional stored metadata, backups and safe edits/repeats remain compatible.
- Removed HomeAccounts' retired alternate layout and its subtotal/gain presentation. The current preview still shows up to six accounts, everyday accounts before savings, individual currencies, masked savings, all-account navigation and the first-account action. It retains three columns at normal width, two below 360dp and one with enlarged text.
- Removed the unused `buildDueDays`, `vsUsual` and `setGranularity` helpers and assertions specific to those retired paths. Live forecast/runway, Reports baseline and period navigation remain in place.
- Kept the JavaScript-registered widget task handler and test/performance reset hooks; absence of a production TypeScript importer alone does not make them dead.
- Extracted draft reference validation from the Add route into a pure feature helper. Moved Activity's filter type out of its popup module so query helpers do not depend on presentation ownership.

## Optimization and logic

Activity prepares membership sets and the trimmed label once per filter operation. Plan resolves account/category labels from maps shared by the loaded snapshot. Home memoizes spending buckets and reuses its selected-bar lookup. Phone speed and frame rate were not measured.

A separate 20,000-entry filter fixture compared the actual old and new helper implementations across unfiltered, combined account/category, trimmed-label and legacy-metadata cases. All outputs and ordering matched. Median filtering time in the many-selection case was 4.507ms before and 1.267ms after; other cases varied, including a small slowdown for the legacy filter (0.766ms to 0.788ms). These are synthetic desktop measurements, not a general or device performance guarantee.

Fixed a reduced-motion preference race: a live OS change must win over a slower initial read. Fixed redundant foreground handling: repeated active events do not reload Home or remove the midnight timer. Local calendar dates remain device-derived.

## UI and interaction

The existing theme, rounded surfaces, grid and motion style remain. Segmented controls now announce tab/selection/disabled state, keep labels centred with horizontal breathing room and show Add's type choices as unavailable during staging/saving/success. Plan uses tab semantics in its enlarged-text layout too. Primary buttons retain their shared press animation when a caller supplies additional press handlers. Both switch sizes centre the thumb with symmetric edge spacing. No new financial input or duplicate summary was added.

## Documentation

Updated the README's Home/Add descriptions, the data model's obsolete payment-method UI claim, the architecture ownership/control contracts and the documentation index. Earlier dated validation reports remain historical.

## Validation

The app-wide run completed with 308 suites / 11,226 tests passing, two opt-in performance checks skipped and one Plan presentation test failing because it still expected button semantics. Its selector was updated to the intended tab role and the wrapped Plan navigation aligned with the same contract; affected-screen follow-up results are recorded below.

Earlier focused checks caught obsolete report-query assumptions and test-renderer/native mock shapes. The foreground regression now sends background followed by active, matching its scenario instead of relying on duplicate active events. An initial parallel screen run timed out and was superseded by isolated and app-wide runs. These attempts are retained in `.expo/cleanup-*.log`; they are not described as successful runs.

Final checks:

- The affected-screen follow-up passed all four suites / 173 tests: Plan presentation, Plan loading, shared quiet interactions and the screen matrix. This resolves the sole failing assertion from the app-wide run; the full run itself remains recorded with its original result above.
- Eight security-script checks passed.
- Both opt-in performance suites passed on the existing 20,000-entry ledger, including output parity. These are desktop query fixtures, not native rendering measurements.
- Final type checking and repository lint passed. Changed source/document formatting and diff whitespace checks passed.
- Android production export passed to `.expo/cleanup-android-export` with an 8.2MB Hermes bundle; export is not an APK build or installation check.
- The final source scan covered 435 production TypeScript files; the sole file without a production TypeScript importer is the widget task handler registered from `index.js`.
- All 131 local links checked in the six edited guides resolved.

Native animation, keyboard, TalkBack and real-phone performance require device verification. No APK was built, and changes remain uncommitted.
