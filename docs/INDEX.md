# Documentation index

Use maintained guides for implemented behavior. Dated audits preserve their own revision, test counts and device limits; they are not fresh validation.

## Current verification

The [25 October repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md) records per-file coverage, dependency/security checks, small motion improvements, cleanup and current validation. Its [coverage inventory](REPOSITORY_REAUDIT_COVERAGE_2026_10_25.csv) distinguishes full-content automated checks from focused manual flow review. The preceding [25 October app-flow audit](FULL_APP_AUDIT_2026_10_25.md) records the setup, loan, valuation, category, theme, split and restore corrections.

Hands-on Android outcomes belong in [release device acceptance](RELEASE_DEVICE_CHECKS.md). A passing test suite or JavaScript export does not establish native compilation, notification delivery, accessibility or frame pacing.

## Maintained guides

| Guide                                                 | Purpose                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| [README.md](../README.md)                             | Features, setup and directory ownership                  |
| [Architecture and logic](ARCHITECTURE.md)             | Implemented flows, ownership and financial/privacy rules |
| [Data model](../DATA_MODEL.md)                        | Persisted records, calculations and linked data          |
| [Backup and restore](../BACKUP.md)                    | Backup formats, folder behavior, restore and recovery    |
| [Security boundaries](../SECURITY.md)                 | Access, input, export, native and dependency boundaries  |
| [Build and release guide](../BUILD.md)                | SDK, CI, signing, APK/AAB and native checks              |
| [Release device acceptance](RELEASE_DEVICE_CHECKS.md) | Unperformed and recorded Android acceptance checks       |
| [Expense labels](EXPENSE_LABELS.md)                   | The current single-field expense-label contract          |
| [Repository instructions](../AGENTS.md)               | Repository contributor instructions                      |
| [Shared repository guidance](../CLAUDE.md)            | Compatibility entry point for contributor guidance       |

## Historical reviews and implementation records

These remain available for decisions and previous evidence. Old source lists and hash inventories describe their captured tree; removed paths are not instructions to restore obsolete code. Current security and SDK behavior supersede older decoder, signing, privacy and UI descriptions.

<details>
<summary>Browse all previous records</summary>

| Record                                                                                             | Context                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [Follow-up logic audit: implementation record](../FOLLOWUP_CODE_AUDIT.md)                          | Dated review or implementation record |
| [Security and product decisions: implementation record](../SECURITY_PRODUCT_REVIEW.md)             | Dated review or implementation record |
| [Activity interaction refinement](ACTIVITY_INTERACTION_REFINEMENT_2026_10_20.md)                   | Dated review or implementation record |
| [Add transaction flow review — 21 October 2026](ADD_TRANSACTION_FLOW_REVIEW_2026_10_21.md)         | Dated review or implementation record |
| [Android audit fixes and verification — 23 October 2026](ANDROID_AUDIT_VERIFICATION_2026_10_23.md) | Dated review or implementation record |
| [Android production audit — 23 October 2026](ANDROID_PRODUCTION_AUDIT_2026_10_23.md)               | Dated review or implementation record |
| [App audit — 16 October 2026](APP_AUDIT_2026_10_16.md)                                             | Dated review or implementation record |
| [Audit fixes — 19 October 2026](AUDIT_FIXES_2026_10_19.md)                                         | Dated review or implementation record |
| [Performance, database, motion and link audit](AUDIT_PLAN_REVIEW_2026_10_21.md)                    | Dated review or implementation record |
| [Code cleanup — 11 October 2026](CLEANUP.md)                                                       | Dated review or implementation record |
| [Cleanup recheck — 21 October 2026](CLEANUP_RECHECK_2026_10_21.md)                                 | Dated review or implementation record |
| [Code audit — 18 October 2026](CODE_AUDIT_2026_10_18.md)                                           | Dated review or implementation record |
| [Repository audit — 24 October 2026](CODE_AUDIT_2026_10_24.md)                                     | Dated review or implementation record |
| [Code re-audit — 19 October 2026](CODE_REAUDIT_2026_10_19.md)                                      | Dated review or implementation record |
| [Code refinement — 21 October 2026](CODE_REFINEMENT_2026_10_21.md)                                 | Dated review or implementation record |
| [Full-code review (22 October 2026)](CODE_REVIEW_2026_10_22.md)                                    | Dated review or implementation record |
| [Consolidated UI refinements](CONSOLIDATED_UI_REVIEW.md)                                           | Dated review or implementation record |
| [Current flow audit](CURRENT_FLOW_AUDIT_2026_10_20.md)                                             | Dated review or implementation record |
| [Daily outgoing spending and refunds](DAILY_OUTGOING_REFUND_FIX_2026_10_20.md)                     | Dated review or implementation record |
| [Recreated Expo account setup — 23 October 2026](EAS_ACCOUNT_SETUP_2026_10_23.md)                  | Dated review or implementation record |
| [F01 — atomic transaction save](F01_TRANSACTION_SAVE_2026_10_23.md)                                | Dated review or implementation record |
| [F02 — readable Add labels](F02_ADD_CONTRAST_2026_10_23.md)                                        | Dated review or implementation record |
| [F03 — 200% text and responsive shared controls](F03_LARGE_TEXT_2026_10_23.md)                     | Dated review or implementation record |
| [F04 — accessible heatmap selection](F04_HEATMAP_TARGETS_2026_10_23.md)                            | Dated review or implementation record |
| [F05 — retain every Quick Add action with larger targets](F05_QUICK_ADD_TARGETS_2026_10_23.md)     | Dated review or implementation record |
| [F06 — block financial UI until capture protection succeeds](F06_CAPTURE_PROTECTION_2026_10_23.md) | Dated review or implementation record |
| [F08 — atomic theme persistence and honest failure feedback](F08_THEME_PERSISTENCE_2026_10_23.md)  | Dated review or implementation record |
| [F09 — separate Add workflows and presentation](F09_ADD_STRUCTURE_2026_10_23.md)                   | Dated review or implementation record |
| [F10 — type maintenance rows without an escape hatch](F10_TYPED_MAINTENANCE_2026_10_23.md)         | Dated review or implementation record |
| [App-wide UI and logic audit — 13 October 2026](FINAL_UI_AUDIT.md)                                 | Dated review or implementation record |
| [Final UI consistency review](FINAL_UI_CONSISTENCY.md)                                             | Dated review or implementation record |
| [App audit and corrections — 25 October 2026](FULL_APP_AUDIT_2026_10_25.md)                        | Dated review or implementation record |
| [Goals and budgets review — 21 October 2026](GOALS_BUDGETS_FLOW_REVIEW_2026_10_21.md)              | Dated review or implementation record |
| [Home daily remaining refresh — 20 October 2026](HOME_DAILY_REMAINING_FIX_2026_10_20.md)           | Dated review or implementation record |
| [Home redesign (22 October 2026)](HOME_REDESIGN_2026_10_22.md)                                     | Dated review or implementation record |
| [Shared interaction audit — 25 October 2026](INTERACTION_AUDIT_2026_10_25.md)                      | Dated review or implementation record |
| [Interaction and recovery refinement](INTERACTION_RECOVERY_2026_10_20.md)                          | Dated review or implementation record |
| [Loan flow review — 21 October 2026](LOAN_FLOW_REVIEW_2026_10_21.md)                               | Dated review or implementation record |
| [Neat-and-clean pass: audit report (2026-10-22)](NEAT_AND_CLEAN_AUDIT_2026_10_22.md)               | Dated review or implementation record |
| [Notifications redesign (2026-10-22)](NOTIFICATIONS_REDESIGN_2026_10_22.md)                        | Dated review or implementation record |
| [Notification audit — 24 October 2026](NOTIFICATION_AUDIT_2026_10_24.md)                           | Dated review or implementation record |
| [Morning reminder correction — 16 October 2026](NOTIFICATION_FIX_2026_10_16.md)                    | Dated review or implementation record |
| [Optimization and structure review](OPTIMIZATION_REVIEW.md)                                        | Dated review or implementation record |
| [Pending-flow recheck — 21 October 2026](PENDING_FLOW_RECHECK_2026_10_21.md)                       | Dated review or implementation record |
| [Planning workflow improvements — 20 October 2026](PLANNING_FEATURES_2026_10_20.md)                | Dated review or implementation record |
| [Plan redesign (2026-10-22)](PLAN_REDESIGN_2026_10_22.md)                                          | Dated review or implementation record |
| [Production release audit](PRODUCTION_RELEASE_AUDIT.md)                                            | Dated review or implementation record |
| [Profile and Settings redesign (22 October 2026)](PROFILE_REDESIGN_2026_10_22.md)                  | Dated review or implementation record |
| [Re-audit fixes — 19 October 2026](REAUDIT_FIXES_2026_10_19.md)                                    | Dated review or implementation record |
| [Release follow-up audit](RELEASE_FOLLOWUP_AUDIT.md)                                               | Dated review or implementation record |
| [Release readiness — 14 October 2026](RELEASE_READINESS_2026_10_14.md)                             | Dated review or implementation record |
| [Reports, calmer (2026-10-22)](REPORTS_CALM_2026_10_22.md)                                         | Dated review or implementation record |
| [Reports redesign (22 October 2026)](REPORTS_REDESIGN_2026_10_22.md)                               | Dated review or implementation record |
| [Home and planning screenshot refinements — 20 October 2026](SCREENSHOT_REFINEMENTS_2026_10_20.md) | Dated review or implementation record |
| [Screen source coverage](SCREEN_SOURCE_COVERAGE.md)                                                | Dated review or implementation record |
| [Expo SDK 58 upgrade](SDK_58_UPGRADE_2026_10_21.md)                                                | Dated review or implementation record |
| [Related sheet navigation — 21 October 2026](SHEET_FLOW_REVIEW_2026_10_21.md)                      | Dated review or implementation record |
| [App UI consistency — 20 October 2026](UI_SYSTEM_REFINEMENT_2026_10_20.md)                         | Dated review or implementation record |
| [Widget validation — 23 October 2026](WIDGET_VALIDATION_2026_10_23.md)                             | Dated review or implementation record |
| [Activity: implementation record](archive/ACTIVITY_FIX_REPORT.md)                                  | Archived implementation record        |
| [Initial application audit: implementation record](archive/APP_AUDIT.md)                           | Archived implementation record        |
| [Application verification record: implementation record](archive/AUDIT.md)                         | Archived implementation record        |
| [Code cleanup: implementation record](archive/CODE_CLEANUP_REPORT.md)                              | Archived implementation record        |
| [Initial audit fixes: implementation record](archive/FIX_REPORT.md)                                | Archived implementation record        |
| [Home: implementation record](archive/HOME_FIX_REPORT.md)                                          | Archived implementation record        |
| [Home and Plan sections: implementation record](archive/HOME_PLAN_SECTION_FIXES.md)                | Archived implementation record        |
| [Performance: implementation record](archive/PERFORMANCE_FIX_REPORT.md)                            | Archived implementation record        |
| [Plan: implementation record](archive/PLAN_FIX_REPORT.md)                                          | Archived implementation record        |
| [Sheets and dialogs: implementation record](archive/POPUP_REFINEMENT_REPORT.md)                    | Archived implementation record        |
| [Reports logic: implementation record](archive/REPORTS_FIX_REPORT.md)                              | Archived implementation record        |
| [Reports redesign: implementation record](archive/REPORTS_REDESIGN_IMPLEMENTATION.md)              | Archived implementation record        |
| [Security follow-up: implementation record](archive/SECURITY_FOLLOWUP_REPORT.md)                   | Archived implementation record        |
| [Transaction entry: implementation record](archive/TRANSACTION_FIX_REPORT.md)                      | Archived implementation record        |
| [Screen refinements: implementation record](archive/UI_REFINEMENT_REPORT.md)                       | Archived implementation record        |
| [UI and UX refinement: implementation record](archive/UI_UX_REFINEMENT_REPORT.md)                  | Archived implementation record        |

</details>

## Maintaining documentation

- Update the owning guide and meaningful tests when a behavior or boundary changes.
- Verify commands, links, names and contracts against the implementation.
- Put fresh command results in the current audit; preserve historical test results in their original context.
- Keep proposed behavior separate from implemented behavior and unperformed device checks open.
- Keep generated coverage CSV snapshots dated rather than rewriting old hashes.
- Follow [repository instructions](../AGENTS.md) and the exact [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/) before changing code.
