# Documentation index

Start with the [README](../README.md), [architecture and logic](ARCHITECTURE.md), [data model](../DATA_MODEL.md), [backup and restore](../BACKUP.md) and [build/release guide](../BUILD.md).

The [21 October performance, database, motion and link audit](AUDIT_PLAN_REVIEW_2026_10_21.md) records fresh query plans, fixture timings and the items deliberately left unchanged, plus the report-only CI performance step. The [21 October related-sheet navigation fix](SHEET_FLOW_REVIEW_2026_10_21.md) replaces detached child popups with one persistent native sheet for loan, goal, budget, valuation, transaction-to-recurring and next-occurrence tasks. Native phone acceptance remains separate from automated checks.

The latest targeted review is the [21 October goals and budgets review](GOALS_BUDGETS_FLOW_REVIEW_2026_10_21.md), covering overview/edit navigation, contribution and reservation safety, privacy, nested totals and shared code structure. The [Add transaction flow review](ADD_TRANSACTION_FLOW_REVIEW_2026_10_21.md) covers edit protection, duplicate submission, deletion coordination, loading recovery and split navigation. The [loan-flow review](LOAN_FLOW_REVIEW_2026_10_21.md) covers entry points, payment/receipt confirmation, schedule completeness and loan sheets. The [pending-flow recheck](PENDING_FLOW_RECHECK_2026_10_21.md) covers shared confirmation callbacks, recurring mutation locks and account-currency initialization. The earlier [cleanup recheck](CLEANUP_RECHECK_2026_10_21.md) covers follow-up removals, date-refresh correction, all-theme coverage and outstanding phone checks. The [initial cleanup report](CODE_REFINEMENT_2026_10_21.md) retains its original removal decisions and validation. Dated reports below describe their recorded revisions; they are not current test runs.

See the [19 October re-audit fixes](REAUDIT_FIXES_2026_10_19.md) for the seven-finding resolution checklist and current validation. The [19 October code re-audit](CODE_REAUDIT_2026_10_19.md) preserves the reproduced findings and audit baseline, including the reopened spending-alert privacy issue.

The [19 October audit fixes](AUDIT_FIXES_2026_10_19.md) records the earlier eight-finding implementation checklist and its validation. The [18 October code audit](CODE_AUDIT_2026_10_18.md) preserves the original findings and baseline results.

See the [16 October app audit](APP_AUDIT_2026_10_16.md) for popup validation, preference-race fixes, startup privacy gating and outstanding device checks.

See [16 October morning notification fix](NOTIFICATION_FIX_2026_10_16.md) for current reminder behaviour, corrections and verification limits.

See [14 October release readiness](RELEASE_READINESS_2026_10_14.md) for the latest local audit, fixes, fresh validation and remaining release gates.

Reports retain previous evidence in an expandable historical section. Their dates, test counts and old UI descriptions belong to the recorded revision. Current behavior summaries link back to implementation; changing a contract requires updating its guide and meaningful tests.

| Document                                                                          | Purpose                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [ACTIVITY_FIX_REPORT.md](archive/ACTIVITY_FIX_REPORT.md)                          | Historical implementation and validation record      |
| [AGENTS.md](../AGENTS.md)                                                         | Current guide / project instructions                 |
| [APP_AUDIT.md](archive/APP_AUDIT.md)                                              | Historical implementation and validation record      |
| [AUDIT.md](archive/AUDIT.md)                                                      | Historical implementation and validation record      |
| [BACKUP.md](../BACKUP.md)                                                         | Backup behavior and historical implementation record |
| [BUILD.md](../BUILD.md)                                                           | Current guide / project instructions                 |
| [CLAUDE.md](../CLAUDE.md)                                                         | Current guide / project instructions                 |
| [CODE_CLEANUP_REPORT.md](archive/CODE_CLEANUP_REPORT.md)                          | Historical implementation and validation record      |
| [DATA_MODEL.md](../DATA_MODEL.md)                                                 | Current guide / project instructions                 |
| [FIX_REPORT.md](archive/FIX_REPORT.md)                                            | Historical implementation and validation record      |
| [FOLLOWUP_CODE_AUDIT.md](../FOLLOWUP_CODE_AUDIT.md)                               | Historical implementation and validation record      |
| [HOME_FIX_REPORT.md](archive/HOME_FIX_REPORT.md)                                  | Historical implementation and validation record      |
| [HOME_PLAN_SECTION_FIXES.md](archive/HOME_PLAN_SECTION_FIXES.md)                  | Historical implementation and validation record      |
| [PERFORMANCE_FIX_REPORT.md](archive/PERFORMANCE_FIX_REPORT.md)                    | Historical implementation and validation record      |
| [PLAN_FIX_REPORT.md](archive/PLAN_FIX_REPORT.md)                                  | Historical implementation and validation record      |
| [POPUP_REFINEMENT_REPORT.md](archive/POPUP_REFINEMENT_REPORT.md)                  | Historical implementation and validation record      |
| [README.md](../README.md)                                                         | Current guide / project instructions                 |
| [REPORTS_FIX_REPORT.md](archive/REPORTS_FIX_REPORT.md)                            | Historical implementation and validation record      |
| [REPORTS_REDESIGN_IMPLEMENTATION.md](archive/REPORTS_REDESIGN_IMPLEMENTATION.md)  | Historical implementation and validation record      |
| [SECURITY_FOLLOWUP_REPORT.md](archive/SECURITY_FOLLOWUP_REPORT.md)                | Historical implementation and validation record      |
| [SECURITY_PRODUCT_REVIEW.md](../SECURITY_PRODUCT_REVIEW.md)                       | Historical implementation and validation record      |
| [TRANSACTION_FIX_REPORT.md](archive/TRANSACTION_FIX_REPORT.md)                    | Historical implementation and validation record      |
| [UI_REFINEMENT_REPORT.md](archive/UI_REFINEMENT_REPORT.md)                        | Historical implementation and validation record      |
| [UI_UX_REFINEMENT_REPORT.md](archive/UI_UX_REFINEMENT_REPORT.md)                  | Historical implementation and validation record      |
| [vendor/decode-uri-component/README.md](../vendor/decode-uri-component/README.md) | Compatibility package maintenance                    |

See the [11 October cleanup record](CLEANUP.md) for that revision's removal decisions and validation.

See the [13 October app-wide audit](FINAL_UI_AUDIT.md) for the reviewed UI/logic changes, SDK compatibility fixes, validation results and remaining device checks. Its results apply to that recorded working tree.

## Maintaining documentation

- Verify names, commands, source links and behavior against code before describing them.
- Separate a proposed feature from implemented behavior and a past test run from fresh validation.
- Explain transaction boundaries, currency/privacy scope and failures where they affect a flow.
- Preserve product decisions unless the owner changes them; avoid promising perfect security or performance.
- Follow [AGENTS.md](../AGENTS.md) and the exact Expo version documentation before code changes.

See [production release audit](PRODUCTION_RELEASE_AUDIT.md) for the final regression run, signed APK findings, native privacy fixes and outstanding release gates.

Use [release device acceptance](RELEASE_DEVICE_CHECKS.md) to record manual phone results and expected behavior, including conditional reminders. Unperformed checks remain open.

See [release follow-up audit](RELEASE_FOLLOWUP_AUDIT.md) for the notification lifecycle findings, signed build 10 inspection and current validation limits.

See [final UI consistency review](FINAL_UI_CONSISTENCY.md) and its file-coverage inventory for the latest local spacing/readability refinements and fresh presentation checks. No APK was built for that review.

See [optimization and structure review](OPTIMIZATION_REVIEW.md) for Activity lookup improvements, cache clock handling, comment cleanup and fresh performance-fixture checks.

See [screen source coverage](SCREEN_SOURCE_COVERAGE.md) for all route/component mappings, the final Activity period layout refinement and fresh UI checks.

Lock-screen automatic prompting and the top-aligned layout are described in the architecture guide; prior manual-only lock descriptions are historical. No APK was built for this change.

See [consolidated UI review](CONSOLIDATED_UI_REVIEW.md) for the final refinements, full regression evidence and open phone checks. No APK was built for this review.

See [expense labels](EXPENSE_LABELS.md) for the single-field expense UI, legacy-note compatibility, Activity/Reports usage and fresh validation.

See [20 October UI system refinement](UI_SYSTEM_REFINEMENT_2026_10_20.md) for shared theme controls, popup layout, obsolete UI removal and fresh verification limits.

See [planning workflow improvements](PLANNING_FEATURES_2026_10_20.md) for the five approved feature changes, navigation paths and current verification limits.

See [Home daily remaining refresh](HOME_DAILY_REMAINING_FIX_2026_10_20.md) for the reproduced stale-allowance issue, correction and fresh verification.

See [Home and planning screenshot refinements](SCREENSHOT_REFINEMENTS_2026_10_20.md) for current-day chart selection, foreground refresh and compact recurring/plan layouts.

See [Activity interaction refinement](ACTIVITY_INTERACTION_REFINEMENT_2026_10_20.md) for filter hierarchy, transaction action corrections, popup handoff and fresh validation limits.

See [daily outgoing/refund correction](DAILY_OUTGOING_REFUND_FIX_2026_10_20.md) for the backup-reproduced daily allowance issue and its regression validation.

See [interaction and recovery refinement](INTERACTION_RECOVERY_2026_10_20.md) for animation, loading states, draft recovery, date rollover and validation limits.

Payment-method entry/filter/detail/report UI was removed at the owner's request; see the current architecture guide. Account-based entry and filtering remain. Older implementation reports describe the previous feature state.

See [current flow audit](CURRENT_FLOW_AUDIT_2026_10_20.md) for the latest cross-screen review, reproduced flow corrections and fresh validation limits.
