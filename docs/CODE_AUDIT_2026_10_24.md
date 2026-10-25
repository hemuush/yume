# Repository audit — 24 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Started on 24 October from `728b6d9` with the notification changes already present; final verification completed on 25 October. This audit uses the installed [Ponytail skill](https://github.com/DietrichGebert/ponytail/tree/09c434ab73ca43761c5d8b0c5d341926c2fba710/skills/ponytail) and the [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/). No dependency was added. No commit, push, deployment or new APK was made.

## Scope and evidence

The [file inventory](CODE_AUDIT_COVERAGE_2026_10_24.csv) lists every first-party code file, line count and SHA-256. Repository-wide automated checks are combined with focused source inspection of data writes, currency/privacy boundaries, loading recovery, navigation, exports, notifications, investment calculations and native configuration. The inventory distinguishes focused inspection from automated checks. It is **not** a claim that every line was manually read or that tests prove every possible state correct.

The inventory contains **911 code files / 136,606 lines**, with focused inspection recorded for **132 files**, sometimes limited to the relevant sections. All 907 TypeScript/JavaScript files were parsed, both Python scripts passed AST parsing, and the Kotlin/Gradle module was inspected without compiling it. Tests are included in the file count.

Generated native projects, dependencies, binary assets, build output, and the separate `sites/` and `design-preview/` projects are outside the inventory. Root configuration and CI were also inspected. Historical reports were used as a map, never as fresh test evidence.

## Corrections

| Finding                                          | Impact and correction                                                                                                                                                                                                                | Regression evidence                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Creation committed before reading its result     | Accounts, people, plain IOUs, recurring rules and loans could report failure after saving, inviting a duplicate on retry. Read and map the result inside the creation transaction. Loan rollback includes schedule and disbursement. | `createAtomic.test.ts`: inject read failure, check no committed rows, retry once.                                                   |
| Loan alert identity omitted the loan             | Another loan due on the same day could inherit a dismissal. Include the existing loan ID; obsolete date-only dismissals expire naturally.                                                                                            | `needsYou.test.ts`: different loans with the same date.                                                                             |
| Investments and Exports hid refresh failures     | Keep loaded figures and show the shared embedded error and Retry control.                                                                                                                                                            | Page tests: failed refresh, retained content, successful Retry.                                                                     |
| Export period disappeared after a data change    | Retain a valid choice; otherwise select the latest available month/year of the same kind.                                                                                                                                            | Export page tests: vanished month/year and still-valid selection.                                                                   |
| Export previews lost refunds across months       | Preserve signed monthly net spending; clamp only after summing the selected period, matching report calculations.                                                                                                                    | Real SQLite `exportSummary.test.ts` and picker tests: purchase and later-month refund.                                              |
| Investment chart rescanned all history per point | Process sorted events once with per-holding balances. Same-day transfers precede that day's valuation.                                                                                                                               | Portfolio tests: unsorted history, multiple holdings, withdrawals, opening dates and future records; exact synthetic output parity. |
| Native check crashed on Windows                  | Replace `execFileSync('npx', …)`, which failed with `ENOENT`, with the current Node executable and installed autolinking CLI.                                                                                                        | Native check succeeds on this Windows workspace.                                                                                    |
| Obsolete dependency exception                    | Remove the braces advisory allowance after the fresh dependency audit stopped reporting it; update CI's explanatory comment.                                                                                                         | Dependency gate and gate unit tests.                                                                                                |
| Impossible dates accepted from report links      | The shared date guard accepted format alone, including February 31. Require a local-calendar round trip; Reports and Category now ignore impossible ranges. Stored-date validation keeps the same strict contract.                   | Date tests, both route tests and restore regressions.                                                                               |

The [notification audit](NOTIFICATION_AUDIT_2026_10_24.md) records the earlier UI-to-delivery changes retained in this tree.

## Performance

A synthetic history of eight holdings, 20,000 transfers and 8,000 valuations produces 1,001 chart points. The original function took **5,359 ms**; the replacement took **62 ms** on this Windows machine. Strict deep equality confirmed identical results for every point. This is one desktop calculation benchmark, not Android frame-rate evidence.

The existing 20,000-entry real-SQLite performance and output-parity jobs also passed. No new indexes, caches, packages or background services were introduced.

## Fresh validation

| Check                                 | Final result                                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Jest regression run              | **361 suites / 11,732 tests passed**, zero failures; 2 opt-in performance suites/tests skipped in this command. Includes all original export cases plus the new regressions. 298.689 seconds.                                |
| Opt-in performance and output fixture | **2 suites / 2 tests passed** separately with `node scripts/runPerf.cjs`; 20,000-entry real SQLite fixture and 279 exported comparison fields. 12.542 seconds.                                                               |
| TypeScript                            | `tsc --noEmit` passed after the final changes.                                                                                                                                                                               |
| Lint                                  | Repository-wide lint passed; final changed date/export/report tests and helper files also passed.                                                                                                                            |
| Formatting                            | Repository-wide Prettier check passed; all final affected code files checked again.                                                                                                                                          |
| Syntax / transaction scan             | 907 TS/JS files parsed without diagnostics; no direct calls on an outer DB handle found inside transaction/exclusive callbacks across 527 application/support modules. This scan does not prove every indirect call is safe. |
| Import cycles                         | No circular imports among 524 production modules.                                                                                                                                                                            |
| Native configuration                  | Windows native check passed against the existing generated manifest and current installed module resolution. No fresh prebuild or native compilation in this repository-wide pass.                                           |
| Dependency checks                     | Expo install check reports dependencies up to date; npm audit gate passes with the one documented build-tool allowance.                                                                                                      |
| Android JavaScript export             | Passed after final application changes: 8.7 MB Hermes bundle, local output `.expo/whole-audit-export`. This is not an APK.                                                                                                   |
| Native/security regression scripts    | **16 tests passed**, zero failures or skips (URI decoder dependencies, widget-provider privacy and manifest/module guards).                                                                                                  |
| Patch whitespace                      | `git diff --check` passed.                                                                                                                                                                                                   |

Raw local outputs are under ignored `.expo/whole-audit-*`; `.expo/whole-audit-final-jest.json` records every final suite and assertion. The earlier full run (11,711 tests) is superseded by the final run above. Historical report counts are not reused here.

## Remaining validation

No Android device or emulator is connected. Visual layout, 200% font scaling, TalkBack, keyboard/modal transitions, launcher icon switching, PDF printing/sharing, widgets, reboot/background delivery and OEM notification restrictions still need the [device acceptance checklist](RELEASE_DEVICE_CHECKS.md). Component/source checks do not substitute for those tests. No fresh Gradle build or APK installation was performed.

The dependency gate retains the existing `node-forge` build-tool allowance (`GHSA-86w9-cpqp-85rv`); a passing gate does not mean there are no advisories. SQLite and exports remain unencrypted under the existing design; app lock controls access and capture protection.
