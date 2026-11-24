# Documentation index

Use the maintained guides for implemented behavior. The dated records below preserve their own revision, test counts and device limits; they are evidence for a decision, not fresh validation. A passing test suite or JavaScript export does not establish native compilation, notification delivery, accessibility or frame pacing: hands-on Android outcomes belong in [release device acceptance](RELEASE_DEVICE_CHECKS.md).

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

## Dated records

The guides link to these for the reasoning and evidence behind a rule. Old source lists describe the tree they were written against; removed paths are not instructions to restore obsolete code. Current security and SDK behavior supersede older decoder, signing, privacy and UI descriptions.

| Record | Date |
| --- | --- |
| [The quiet look and colour modes — 16 November 2026](reports/COLOUR_MODES_2026_11_16.md) | 16 Nov 2026 |
| [Activity redesign (2026-11-15)](reports/ACTIVITY_REDESIGN_2026_11_15.md) | 15 Nov 2026 |
| [Your own emoji for a category (15 November 2026)](reports/CATEGORY_EMOJI_2026_11_15.md) | 15 Nov 2026 |
| [Loans, Recurring, Budgets and Add transaction smoothness (15 November 2026)](reports/LOANS_RECURRING_BUDGETS_ADD_SMOOTHNESS_2026_11_15.md) | 15 Nov 2026 |
| [People, Investments, Categories, Profile, Notification settings, What-if and Goals smoothness (15 November 2026)](reports/OTHER_SCREENS_SMOOTHNESS_2026_11_15.md) | 15 Nov 2026 |
| [Plan smoothness and code structure (15 November 2026)](reports/PLAN_SMOOTHNESS_2026_11_15.md) | 15 Nov 2026 |
| [Reports smoothness and code structure (15 November 2026)](reports/REPORTS_SMOOTHNESS_2026_11_15.md) | 15 Nov 2026 |
| [Activity smoothness and code structure (14 November 2026)](reports/ACTIVITY_SMOOTHNESS_2026_11_14.md) | 14 Nov 2026 |
| [Home smoothness and code structure (14 November 2026)](reports/HOME_SMOOTHNESS_2026_11_14.md) | 14 Nov 2026 |
| [Performance with a large ledger (14 November 2026)](reports/PERFORMANCE_2026_11_14.md) | 14 Nov 2026 |
| [Activity: feed first (2026-11-12)](reports/ACTIVITY_FEED_2026_11_12.md) | 12 Nov 2026 |
| [Calm motion — 11 November 2026](reports/CALM_MOTION_2026_11_11.md) | 11 Nov 2026 |
| [Approved Home redesign — 10 November 2026](reports/HOME_REDESIGN_2026_11_10.md) | 10 Nov 2026 |
| [Approved Home refinement — 5 November 2026](reports/HOME_REFINEMENT_2026_11_05.md) | 5 Nov 2026 |
| [Smoothness and UI/UX review — 5 November 2026](reports/SMOOTHNESS_REVIEW_2026_11_05.md) | 5 Nov 2026 |
| [UI/UX enhancement direction — 5 November 2026](reports/UX_ENHANCEMENT_PLAN_2026_11_05.md) | 5 Nov 2026 |
| [App audit and corrections — 25 October 2026](reports/FULL_APP_AUDIT_2026_10_25.md) | 25 Oct 2026 |
| [Repository re-audit — 25 October 2026](reports/REPOSITORY_REAUDIT_2026_10_25.md) | 25 Oct 2026 |
| [First-install insets and theme launch branding — 25 October 2026](reports/STARTUP_FIXES_2026_10_25.md) | 25 Oct 2026 |
| [Repository audit — 24 October 2026](reports/CODE_AUDIT_2026_10_24.md) | 24 Oct 2026 |
| [Notification audit — 24 October 2026](reports/NOTIFICATION_AUDIT_2026_10_24.md) | 24 Oct 2026 |
| [Recreated Expo account setup — 23 October 2026](reports/EAS_ACCOUNT_SETUP_2026_10_23.md) | 23 Oct 2026 |
| [F05 — retain every Quick Add action with larger targets](reports/F05_QUICK_ADD_TARGETS_2026_10_23.md) | 23 Oct 2026 |
| [F06 — block financial UI until capture protection succeeds](reports/F06_CAPTURE_PROTECTION_2026_10_23.md) | 23 Oct 2026 |
| [Add transaction flow review — 21 October 2026](reports/ADD_TRANSACTION_FLOW_REVIEW_2026_10_21.md) | 21 Oct 2026 |
| [Cleanup recheck — 21 October 2026](reports/CLEANUP_RECHECK_2026_10_21.md) | 21 Oct 2026 |
| [Goals and budgets review — 21 October 2026](reports/GOALS_BUDGETS_FLOW_REVIEW_2026_10_21.md) | 21 Oct 2026 |
| [Loan flow review — 21 October 2026](reports/LOAN_FLOW_REVIEW_2026_10_21.md) | 21 Oct 2026 |
| [Expo SDK 58 upgrade](reports/SDK_58_UPGRADE_2026_10_21.md) | 21 Oct 2026 |
| [Related sheet navigation — 21 October 2026](reports/SHEET_FLOW_REVIEW_2026_10_21.md) | 21 Oct 2026 |
| [Current flow audit](reports/CURRENT_FLOW_AUDIT_2026_10_20.md) | 20 Oct 2026 |
| [Home daily remaining refresh — 20 October 2026](reports/HOME_DAILY_REMAINING_FIX_2026_10_20.md) | 20 Oct 2026 |
| [App UI consistency — 20 October 2026](reports/UI_SYSTEM_REFINEMENT_2026_10_20.md) | 20 Oct 2026 |
| [Audit fixes — 19 October 2026](reports/AUDIT_FIXES_2026_10_19.md) | 19 Oct 2026 |
| [Re-audit fixes — 19 October 2026](reports/REAUDIT_FIXES_2026_10_19.md) | 19 Oct 2026 |

## Maintaining documentation

- Update the owning guide and meaningful tests when a behavior or boundary changes.
- Verify commands, links, names and contracts against the implementation.
- Put fresh command results in the current audit; preserve historical test results in their original context.
- Keep proposed behavior separate from implemented behavior and unperformed device checks open.
- Follow [repository instructions](../AGENTS.md) and the exact [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/) before changing code.
