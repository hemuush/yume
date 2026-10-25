# Cleanup recheck — 21 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Follow-up to [code refinement](CODE_REFINEMENT_2026_10_21.md). The earlier report preserves its own test results; this record describes the subsequent changes and fresh checks. Changes remain uncommitted and the selected palette/current layout are preserved.

## Findings and corrections

1. Local-day refresh skipped an active event when it had not observed a background event, even if the calendar date changed. A focused regression reproduced the missed callback. Activation now always checks the local calendar, while only actual foreground transitions force same-day reloads. Repeated same-day active events keep the midnight timer without duplicate loads.
2. Activity's helper still accepted an unused payment-method filter after its UI removal. A regression showed an older caller could silently filter away entries. The retired type/branch is removed; older extra keys are ignored. Existing transaction metadata, edits/repeats and backup compatibility remain intact.
3. SpendBars still carried a standalone layout, compressed-height calculation, independent range selector and styles that no production caller used. Home's only caller used the compact embedded chart. Removed those branches/props and kept its existing proportional heights, palette, current-day/week default, interactive footer and font-scale adaptation. Selecting an already-selected bar no longer repeats haptics.

## Theme and logic coverage

Expanded shared-control coverage across all twelve real theme packs, including updates to the next pack. Buttons, sheet tabs, segmented controls and switches retain theme-derived ink and semantic danger styling. Home chart tests check selected/unselected fills and unchanged proportional heights for every pack.

The new date and retired-filter tests failed before the fixes. After the corrections and chart simplification, the five focused suites passed all 91 tests, including existing hero period transitions and completed-month weekly buckets.

Three isolated Node timezone checks of the actual midnight-timer function passed: a 24-hour Kolkata day and New York's 23-hour/25-hour daylight-saving transition days. Each includes the existing 50ms boundary allowance. These tests changed only the child process timezone, never the computer or phone clock.

The follow-up import-graph traversal reached all 435 production TypeScript files from 27 route/JavaScript-entry roots, including the registered widget task handler. No additional unreachable source modules were found. This does not prove every export or native state is used correctly; it prevents deleting indirectly registered modules based only on importer counts. All 136 local links checked across the eight relevant guides resolved.

## Remaining acceptance

ADB was unavailable both on PATH and at the standard local Android SDK location. No native screen interaction, TalkBack, keyboard, device frame-rate profiling, APK build or installation was performed. The [release device checklist](RELEASE_DEVICE_CHECKS.md) names the remaining actions and leaves them explicitly not run. Automated rendering and export do not close those checks.

## Fresh validation

The first broad recheck passed 308 suites / 11,250 tests and found two older motion assertions targeting the removed standalone chart. Those assertions now test Home's actual parent-controlled period and exact date/amount footer instead. All six motion tests passed after the update. The earlier failed attempt remains recorded in `.expo/recheck-full.log` and is not reported as a clean run.

The fresh final rerun passed **309 suites / 11,252 tests, with zero failures**. The standard run skipped two opt-in performance checks; both were run separately and passed on the 20,000-entry ledger, including output parity. All eight security-script checks passed too.

Final type checking, changed-source lint, changed-file formatting and diff whitespace checks passed. Android export passed to `.expo/recheck-android-export` with an 8.2MB Hermes bundle. Detailed local evidence is in `.expo/recheck-full-final.log`, `.expo/recheck-focused.log`, `.expo/recheck-motion.log`, `.expo/recheck-types-final.log`, `.expo/recheck-lint.log`, `.expo/recheck-perf.log`, `.expo/recheck-security.log` and `.expo/recheck-android-export.log`.

No automated failures remain in these checks. The native acceptance items above remain unperformed; export does not establish APK installation, upgrade continuity or phone presentation/performance. No APK was built and nothing was committed or pushed.
