# Yume audit fixes — 10 October 2026

All eight findings from APP_AUDIT.md have implementation changes. The original audit remains a record of the initial checkout; this report describes the resulting behavior and verification.

## Changes

| Audit item | Resulting behavior |
| --- | --- |
| 1. Windows import collision | The Home chart helper is spendBarData.ts, distinct from the SpendBars.tsx component. Imports and existing tests use the new name. Installed packages were reconciled with the existing lockfile, restoring expo-screen-capture. |
| 2. Sensitive repeat shortcuts | Repeat-query results carry inherited category sensitivity. Hidden sensitive shortcuts are excluded from the repeat sheet and Add suggestions; amount labels and accessibility text also mask sensitive values. Category amount suggestions reload when privacy or account currency changes and do not show stale results from another selection. |
| 3. Archived-category privacy | Home, Activity and Reports retain archived category metadata when reading history, so archived sensitive categories continue to mask amounts and leave private aggregate views. |
| 4. Currency mixing | Activity charts and daily totals scope to the default currency. Foreign-currency entries retain their own currency in rows, detail sheets and Home history. Activity stacks separate currencies. Report day queries explicitly filter currency. Excel adds a Currency column, formats transaction/account amounts in their own currency, retains archived-account metadata and omits mixed-currency subtotals. |
| 5. Recurring catch-up race | Each occurrence rereads the rule inside its insert transaction and checks its inputs, active state and expected next date. Pause, deletion and edits stop stale catch-up. An expired rule does not create an occurrence after its end date. The error handler also preserves a concurrently edited rule. |
| 6. Misleading restore undo | The persistent recovery card and confirmation identify a saved recovery snapshot, with its existing date/count metadata, without promising it belongs to the latest restore. Older recovery copies remain usable. The immediate undo action still depends on successfully saving the current pre-restore copy. |
| 7. Widget privacy | This Month passes the privacy setting to both pace and remaining-bills queries, consistently with its headline and carry-in calculations. Sensitive recurring bills no longer influence hidden projections. |
| 8. Financial currency ownership | Loans, IOUs and goals explicitly use the default currency. Database writers reject foreign-currency linked accounts, and corresponding account pickers offer compatible accounts. Changing the default is blocked while loans, goals, IOUs or budgets would be relabelled. Legacy foreign IOU rows retain their currency and are excluded from default-currency balances; legacy foreign-linked goals do not compare unlike amounts. |

No exchange-rate conversion was introduced. Existing stored amounts are preserved. Historical mixed-currency loan movements or other ambiguous legacy records cannot be numerically corrected without knowing the intended currency and conversion rate.

## Regression coverage

New and extended tests exercise:

- inherited sensitivity in repeats and archived categories;
- masked shortcut text and accessibility labels;
- currency-scoped history, foreign-currency rendering and separate stacks, including archived USD history on Home while keeping archived accounts out of active account cards;
- Excel currency labels, numeric formats and mixed-currency subtotal suppression;
- recurring edits/deletions/pauses before an occurrence and a pause between occurrences;
- atomic rejection of foreign-currency goal, IOU, loan disbursement, installment and prepayment writes;
- rejection of default-currency changes that would relabel financial records;
- preservation and display of legacy foreign IOU entries and safe goal progress;
- honest recovery-card wording and hidden widget projections.

The test command now uses scripts/test.cjs so npm test works on Windows and CI with the same India locale/timezone. A chart test now unmounts its render trees to cancel animation work before environment teardown. Existing query/wording assertions and incomplete account fixtures were updated to require the corrected behavior.

Validation also reproduced a shared animation continuing after its owner unmounted. useGrowFrom now stops its animation during effect cleanup. Its new regression test failed before the fix (the unmounted value still advanced from 0 to 60) and passes after the fix. Other leaking test trees now unmount explicitly as well.

## Verification

| Check | Final result |
| --- | --- |
| Full Jest suite | 241 suites passed, 10,654 tests passed, 2 suites/tests intentionally skipped; no failures or teardown errors. The skipped suites are the existing PERF=1 opt-in benchmarks. |
| TypeScript | npm run typecheck passed. |
| ESLint | Passed with --max-warnings=0, using a cache under .expo. |
| Formatting | npm run format:check passed. |
| Expo Doctor | All 21 checks passed. |
| Android export | Passed: 2,300 modules, 40 assets and a 7.8 MB Hermes bundle. Output is under .expo/audit-export-final. |
| Dependency audit gate | Passed the repository policy. The existing braces and node-forge tooling advisories remain explicitly allowlisted; no blocking high or critical advisory. |
| Diff whitespace | git diff --check passed. |

The final full suite ran through the portable npm test command with two workers and a 512 MB idle-worker memory limit. The complete Jest log is .expo/audit-fixes-jest-complete.log; the export log is .expo/audit-export-final.log. Earlier failed runs were used to identify and correct test setup, outdated assertions, incomplete fixtures and animation cleanup before this successful full run.

The dependency reconciliation did not change package-lock.json. package.json changed only to use the portable test runner. Financial amounts and the database schema were not rewritten.

## Limits

The Android JavaScript/Hermes export verifies bundling, not a native Gradle/EAS build or device behavior. Native authentication, screen capture, background lifecycle, folder pickers, notification delivery and launcher widgets still require Android device testing.

The pre-existing app.json change was preserved. At audit completion, no commits, deployment or release had been performed.

## Subsequent UI and build delivery

The existing design and font families were retained while shared sizing was made more compact: Home's headline 46 → 36, greeting 22 → 18, section titles 19 → 17, standard rows 64 → 56 and card padding 16 → 14. Activity, Plan, Reports, Add and Profile also received targeted sizing adjustments. This is not yet a complete pass through every screen's independent fixed sizes.

All 194 targeted UI/font-scaling tests passed, including the full screen smoke suite. TypeScript, lint, formatting and the Android export passed after these changes.

The signed EAS preview APK completed successfully, using the existing keystore and version code 9. Build: https://expo.dev/accounts/yume-expense-track/projects/yume/builds/71729692-c1b9-4308-aa17-359acb3dcc03. Android device behavior remains unverified.

The private review site has its own source repository. Its generated files and the earlier design preview are excluded from the app repository and EAS upload.
