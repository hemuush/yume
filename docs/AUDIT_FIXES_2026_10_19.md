# Audit fixes — 19 October 2026

Follow-up to the [18 October code audit](CODE_AUDIT_2026_10_18.md), based on revision `6109b40232266423db459fcd361e1e4d71f57c28`. The original audit is retained as baseline evidence. This report describes the subsequent working-tree changes. Expo SDK 57 documentation, the documentation index and architecture guide were read before implementation.

**Later review, 19 October:** the [fresh code re-audit](CODE_REAUDIT_2026_10_19.md) reopens part of finding 7: existing queued spending alerts still retain private copy after a successful refresh. The bill/refund cases below remain covered. The other seven original fixes remain supported by fresh regression and source review. The implementation claims and test results below record the earlier fix batch; they are not a resolution of the later findings.

The subsequent [re-audit fix batch](REAUDIT_FIXES_2026_10_19.md) covers that spending-alert gap and the other six follow-up findings. Its validation is recorded separately below that checklist.

## Resolution checklist

All eight confirmed findings are fixed. The final full regression passed after the changes below, including 26 added test cases.

| Finding | Resolution | Regression coverage |
| --- | --- | --- |
| 1. Home module collision | Renamed the pure helper to `moneyBarSegments.ts`; updated component/test imports and architecture link. | The actual Home component, motion and screen smoke suites render successfully; segment calculations remain covered. |
| 2. Parent-budget privacy | Current and lapsed budget queries exclude the entire family when any member is sensitive, including archived children. This also prevents rollover/remaining/progress from exposing hidden history. Revealed financial calculations are preserved. | Real SQLite verifies sensitive parent inheritance, sensitive child/public sibling families, archived private children, rollover and lapsed budgets, plus unhidden totals. |
| 3. Annual bill currency | The rule edit checks the preparation account's currency against the new bill account inside the update transaction. | A rejected currency edit changes neither rule nor preparation data; the snapshot restores. Another account of the same currency is accepted; unlinking permits a later currency change. |
| 4. Category Undo | Delete captures all monthly budgets for the deleted family; Undo restores categories parent-first and then budgets in one transaction. | Real SQLite verifies leaf and parent/child deletions with historical/current budgets, preserving exact IDs, limits and rollover flags. |
| 5. System categories | Built-in categories cannot change parent. Archive/delete checks include system children and share the mutation transaction. The sheet hides the unavailable parent picker. | Direct reparenting rejects atomically; old/restored system children block both parent actions; normal categories and editable built-in attributes remain covered. |
| 6. Refund labels | New tracked receipts retain the purchase label, including an empty label. Startup and restore repair only app-created linked receipts whose text exactly matches the old generated value. | Partial/full receipts net against the same label. Legacy repairs are repeat-safe; manually linked refunds and custom receipt labels are preserved. Startup migration and restore tests run against SQLite. |
| 7. Queued private reminders | Saving the global privacy preference, changing sensitivity/parent, or adding/deleting/restoring a sensitive family member refreshes queued content after commit. Refresh also runs when both optional topics are now disabled, clearing stale payloads from an earlier failed update. Failed refresh is separate from failed persistence, with visible UI warnings. | Integration coverage uses real database queries, the real notification planner/scheduler and an in-memory OS scheduling adapter: queued private bill/refund labels disappear on hide and return on reveal. Category edits, sensitive-child creation/delete/Undo, disabled topics and scheduler failure are covered; UI tests verify warning and saved/session state. |
| 8. Backdated refunds | Every newly created receipt rebuilds reminders once after commit, regardless of its date; this also refreshes today's logging nudge. Existing-receipt linking retains the optional-topic refresh. | Integration coverage verifies full receipts today/yesterday clear follow-ups, partial receipts keep them, rejected receipts do not rebuild, and the successful path performs one rebuild. |

## Additional cleanup

- Removed unused `OdometerAmount.tsx` and `SoftCard.tsx`, an obsolete test mock and stale source comments. Historical coverage documents keep their original inventory.
- Added visible text explaining that spending-bar heights are compressed and that tapping gives the exact amount.
- Clarified that `useScreenLoad` protects its own bookkeeping; callbacks remain responsible for guarding their state writes against stale requests.
- Fixed a calendar-dependent Home-row test by freezing its clock and making the due-today date explicit; added an overdue case. The initial broad run exposed the fixture when the real date passed 18 October. Application due/overdue logic was already correct.

## Fresh validation

| Check | Result |
| --- | --- |
| Full Jest regression (`npm test -- --runInBand --silent`) | Passed: 293 suites / 11,104 tests; zero failures; 2 opt-in performance suites/tests skipped here and passed separately. 465.385 seconds, exit 0. |
| TypeScript (`npm run typecheck`) | Passed. |
| ESLint (`npm run lint`) | Passed with no errors or warnings. |
| Formatting (`npm run format:check`) | Passed. |
| Security scripts (`npm run test:security`) | All 8 passed. |
| Performance/output parity (`npm run test:perf`) | Both suites / both tests passed on final source. Desktop fixtures: Home 93 ms, Reports 118 ms, Budgets 2 ms; these are not device timings. |
| Expo dependency compatibility (`npx expo install --check`) | Dependencies up to date. |
| Expo Doctor (`npx expo-doctor`) | All 21 checks passed. |
| Dependency gate (`node scripts/auditGate.js`) | Passed under the two existing tooling-advisory exceptions. |
| Android JavaScript export | Passed on final source: 2,339 modules, 8.1 MB Hermes bundle. Output: `.expo/audit-fixes-2026-10-19/bundle-final`. |
| Whitespace/conflict checks (`git diff --check`) | Passed. |

Local final-suite output is retained in `.expo/audit-fixes-2026-10-19/jest-final.log`; the initial run and its date-fixture failure remain in `jest.log` in that directory. Final export output is in `export-final.log`. SQLite tests use in-memory databases; no user financial database was opened.

A parallel rerun was stopped after Reports UI test timeouts and cascading incomplete renderer states; its output is preserved in `jest-parallel-attempt.log`. The assertions and timeout thresholds were retained. The final sequential run is the full-suite acceptance result; the separate final performance run is in `perf-final.log`.

## Remaining acceptance and improvement work

The eight concrete audit findings are implemented. Physical-device appearance, TalkBack, authentication, launcher/keyboard/back interactions and actual OS notification delivery still require Android acceptance. The scheduler integration tests inspect queued payload replacement through a simulated native adapter; they do not prove delivery on a phone.

The original audit's larger-text/reflow and module-extraction recommendations remain improvement work. The existing 1.3 text-scaling product choice is retained pending responsive layouts and device acceptance at larger sizes. Desktop fixture timings do not establish device latency. No signed native build or release is implied by a JavaScript export.

Existing dependency-tooling advisories remain governed by `scripts/auditGate.js`; no automatic Expo/RN downgrade or broad dependency override was introduced. Already-invalid annual links can be corrected by selecting a matching-currency bill account or unlinking the preparation goal; the edit guard prevents new mismatches.
