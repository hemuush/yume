# Documentation index

Use maintained guides for implemented behavior. Dated audits preserve their own revision, test counts and device limits; they are not fresh validation.

## Current verification

The [19 November UI audit](reports/UI_AUDIT_2026_11_19.md) records the shared navigation and header changes, route coverage and the device checks still open.

The [16 November quiet look and colour modes](reports/COLOUR_MODES_2026_11_16.md) replace the six accent themes with one theme in a light and a dark mode: a colour engine (`theme.colors` read live from a table per mode, style sheets rebuilt on a change, screens drawn again without losing the person's place), the flat paper look (hairline sections instead of cards, large Fredoka titles, ink-filled picked chips, a coral Add dot), a real dark palette and a Colour mode control in Settings. It records the browser-harness checks (every screen rendered in both modes; a live switch matches a direct dark render; a stale-colour scan that found and fixed three faults), the rules for new code and what is not done.

The [architecture guide](ARCHITECTURE.md#smoothness-pass--november-2026) describes the 9 November compact screen refinements and the Groww-referenced financial-typography follow-up. These source changes do not establish fresh physical-device acceptance.

The [approved 10 November Home redesign](reports/HOME_REDESIGN_2026_11_10.md) records the separate week card, section summary lines, day-grouped recent activity and the remaining Pixel acceptance checks. It supersedes the chart placement of the 5 November refinement and also records the compact Activity and Reports passes and the Plan overview redesign.

The [11 November Budgets, Recurring, Investments and Friends & family redesign](reports/BUDGETS_RECURRING_INVESTMENTS_PEOPLE_2026_11_11.md) moves those four screens onto the flat summary card and records what each now shows. It does not establish device acceptance.

The [11 November Category detail, Recently deleted, Tidy up and Notifications redesign](reports/CATEGORY_DELETED_TIDY_NOTIFICATIONS_2026_11_11.md) continues the same card on four more screens and tidies a few oversized figures. It does not establish device acceptance.

The [11 November calm motion pass](reports/CALM_MOTION_2026_11_11.md) simplifies the app's motion to short fades and glides (no rolling figures, draw-ins, staggers or springs) and supersedes the motion polish below.

The [11 November motion polish](reports/MOTION_POLISH_2026_11_11.md) and its [per-screen checklist](reports/MOTION_CHECKLIST_2026_11_11.md) record the shared timings, curve and entrance presets.

The [approved 5 November Home refinement](reports/HOME_REFINEMENT_2026_11_05.md) records the implementation of the second screenshot direction, retained financial behavior and remaining Pixel acceptance checks.

The [5 November UI/UX enhancement plan](reports/UX_ENHANCEMENT_PLAN_2026_11_05.md) records the first-use and filter recovery improvements, whole-app design priorities, motion principles and remaining device acceptance work.

The [25 October startup corrections](reports/STARTUP_FIXES_2026_10_25.md) address onboarding content under Android's navigation bar and the original splash icon flashing after selecting a theme icon. These changes require a rebuilt Android binary and separate phone acceptance.

The [25 October repository re-audit](reports/REPOSITORY_REAUDIT_2026_10_25.md) records per-file coverage, dependency/security checks, small motion improvements, cleanup and current validation. Its [coverage inventory](archive/REPOSITORY_REAUDIT_COVERAGE_2026_10_25.csv) distinguishes full-content automated checks from focused manual flow review. The preceding [25 October app-flow audit](reports/FULL_APP_AUDIT_2026_10_25.md) records the setup, loan, valuation, category, theme, split and restore corrections.

The [14 November performance pass](reports/PERFORMANCE_2026_11_14.md) measures every screen with a ledger of up to 300,000 entries, fixes what scaled badly (Reports' cash-flow read, Activity's repeated redraws, date formatting) and adds bulk-data tests. It does not establish device smoothness.

The [14 November Activity smoothness pass](reports/ACTIVITY_SMOOTHNESS_2026_11_14.md) measures each Activity interaction (JavaScript cost per tap at 6 times slower CPU), removes a redraw after every period step, stops lines sliding under an opening group and skips exit animations when a day leaves, and splits the screen file into tested hooks and components. The animation changes rest on Reanimated's source and tests, not on a device.

The [14 November Home pass](reports/HOME_SMOOTHNESS_2026_11_14.md) applies the same method to Home: sheets move out of the page's state, a reload keeps what it did not change, the page's sections compare their props, and the 886-line screen is split into tested hooks and components. Opening or closing a sheet no longer redraws the page behind it.

The [15 November Reports pass](reports/REPORTS_SMOOTHNESS_2026_11_15.md) does the same for Reports: each interaction measured, the details of a period read once (not twice) when it lands, each tab its own memoized piece with its sections memoized, and the 940-line screen split into tested hooks and tabs.

The [15 November Plan pass](reports/PLAN_SMOOTHNESS_2026_11_15.md) applies it to Plan: which sheet is open moves out of the page's state, a reload keeps what it did not change, each tab is its own memoized piece, and the 932-line screen is split into tested hooks, a pure derivation and components. Opening or closing a sheet no longer redraws the tab behind it.

The [15 November Loans, Recurring, Budgets and Add pass](reports/LOANS_RECURRING_BUDGETS_ADD_SMOOTHNESS_2026_11_15.md) applies it to those four: Loans, Budgets and Recurring keep their sheets outside the page's state, keep unchanged rows on reload and compare their props, and Add's sections are drawn again only for the fields of the model they read, so a digit on the pad no longer redraws the header, the category grid and the sheets.

The [15 November category emoji change](reports/CATEGORY_EMOJI_2026_11_15.md) is **superseded on 16 November**: the "your own emoji" field is removed and the category icon picker is back to the full built-in list (94 icons: 24 shown, the rest under Browse all icons). An emoji already stored on a category (from the short time the field existed) is still drawn, kept when the category is saved, and restored from a backup; nothing lets a person add one. The page records what the change did when it shipped.

The [15 November Activity redesign](reports/ACTIVITY_REDESIGN_2026_11_15.md) builds the approved design at the app's compact sizes: each day is one card drawn like Home's Recent activity (the day named inside it in small capitals with what it spent, Home's rows with "category · account" under the name, no date rail), the Spent strip became a card with a comparison chip and a lettered preview (a month's weeks on a square-root scale), the period is one pill with its arrows inside beside a filled Week | Month switch, and the filter chips are pills. It was rendered in a browser and measured at 6 times slower CPU, not seen on a phone.

The [15 November pass over the other screens](reports/OTHER_SCREENS_SMOOTHNESS_2026_11_15.md) applies it to People, Investments, Categories, Profile (You and Settings), Notification settings, What-if and Goals: sheets in stores, data hooks that keep unchanged rows, controls that own their own state (the person's Settle form, Settings' currency, goal and About, the trend's stretch), and a notification switch that is one redraw instead of three. Backup, Garden, Tidy up, Themes, Wrap, Category detail and Split were not measured.

The [15 November code audit](reports/CODE_AUDIT_2026_11_15.md) covers the whole repository: compiler-based scans of every file, a line-by-line read of the highest-risk code, and a randomized property test on real SQLite (about 55,000 operations: balances, people's ledgers, refunds, backup round trips and report totals all hold). It found no data-loss, security or money defect and two low ones, now fixed; it lists what was not checked.

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

## Historical reviews and implementation records

These remain available for decisions and previous evidence. Old source lists and hash inventories describe their captured tree; removed paths are not instructions to restore obsolete code. Current security and SDK behavior supersede older decoder, signing, privacy and UI descriptions.

<details>
<summary>Browse all previous records</summary>

| Record                                                                                             | Context                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [Follow-up logic audit: implementation record](archive/FOLLOWUP_CODE_AUDIT.md)                          | Dated review or implementation record |
| [Security and product decisions: implementation record](archive/SECURITY_PRODUCT_REVIEW.md)             | Dated review or implementation record |
| [Activity interaction refinement](reports/ACTIVITY_INTERACTION_REFINEMENT_2026_10_20.md)                   | Dated review or implementation record |
| [Activity feed first](reports/ACTIVITY_FEED_2026_11_12.md)                                                 | Dated review or implementation record |
| [Activity redesign](reports/ACTIVITY_REDESIGN_2026_11_15.md) | Dated review or implementation record |
| [Spacing and alignment audit](reports/ALIGNMENT_AUDIT_2026_11_12.md) | Dated review or implementation record |
| [Home review](reports/HOME_REVIEW_2026_11_12.md) | Dated review or implementation record |
| [Reports review](reports/REPORTS_REVIEW_2026_11_12.md) | Dated review or implementation record |
| [Plan review](reports/PLAN_REVIEW_2026_11_12.md) | Dated review or implementation record |
| [Add flow review](reports/ADD_FLOW_REVIEW_2026_11_12.md) | Dated review or implementation record |
| [Profile review](reports/PROFILE_REVIEW_2026_11_12.md) | Dated review or implementation record |
| [Goals, Budgets, Loans, Recurring and the Activity filter row](reports/SECONDARY_SCREENS_REVIEW_2026_11_13.md) | Dated review or implementation record |
| [Add transaction flow review — 21 October 2026](reports/ADD_TRANSACTION_FLOW_REVIEW_2026_10_21.md)         | Dated review or implementation record |
| [Android audit fixes and verification — 23 October 2026](reports/ANDROID_AUDIT_VERIFICATION_2026_10_23.md) | Dated review or implementation record |
| [Android production audit — 23 October 2026](reports/ANDROID_PRODUCTION_AUDIT_2026_10_23.md)               | Dated review or implementation record |
| [App audit — 16 October 2026](reports/APP_AUDIT_2026_10_16.md)                                             | Dated review or implementation record |
| [Audit fixes — 19 October 2026](reports/AUDIT_FIXES_2026_10_19.md)                                         | Dated review or implementation record |
| [Performance, database, motion and link audit](reports/AUDIT_PLAN_REVIEW_2026_10_21.md)                    | Dated review or implementation record |
| [Code cleanup — 11 October 2026](CLEANUP.md)                                                       | Dated review or implementation record |
| [Cleanup recheck — 21 October 2026](reports/CLEANUP_RECHECK_2026_10_21.md)                                 | Dated review or implementation record |
| [Code audit — 18 October 2026](reports/CODE_AUDIT_2026_10_18.md)                                           | Dated review or implementation record |
| [Repository audit — 24 October 2026](reports/CODE_AUDIT_2026_10_24.md)                                     | Dated review or implementation record |
| [Code re-audit — 19 October 2026](reports/CODE_REAUDIT_2026_10_19.md)                                      | Dated review or implementation record |
| [Code refinement — 21 October 2026](reports/CODE_REFINEMENT_2026_10_21.md)                                 | Dated review or implementation record |
| [Full-code review (22 October 2026)](reports/CODE_REVIEW_2026_10_22.md)                                    | Dated review or implementation record |
| [Consolidated UI refinements](CONSOLIDATED_UI_REVIEW.md)                                           | Dated review or implementation record |
| [Current flow audit](reports/CURRENT_FLOW_AUDIT_2026_10_20.md)                                             | Dated review or implementation record |
| [Daily outgoing spending and refunds](reports/DAILY_OUTGOING_REFUND_FIX_2026_10_20.md)                     | Dated review or implementation record |
| [Recreated Expo account setup — 23 October 2026](reports/EAS_ACCOUNT_SETUP_2026_10_23.md)                  | Dated review or implementation record |
| [F01 — atomic transaction save](reports/F01_TRANSACTION_SAVE_2026_10_23.md)                                | Dated review or implementation record |
| [F02 — readable Add labels](reports/F02_ADD_CONTRAST_2026_10_23.md)                                        | Dated review or implementation record |
| [F03 — 200% text and responsive shared controls](reports/F03_LARGE_TEXT_2026_10_23.md)                     | Dated review or implementation record |
| [F04 — accessible heatmap selection](reports/F04_HEATMAP_TARGETS_2026_10_23.md)                            | Dated review or implementation record |
| [F05 — retain every Quick Add action with larger targets](reports/F05_QUICK_ADD_TARGETS_2026_10_23.md)     | Dated review or implementation record |
| [F06 — block financial UI until capture protection succeeds](reports/F06_CAPTURE_PROTECTION_2026_10_23.md) | Dated review or implementation record |
| [F08 — atomic theme persistence and honest failure feedback](reports/F08_THEME_PERSISTENCE_2026_10_23.md)  | Dated review or implementation record |
| [F09 — separate Add workflows and presentation](reports/F09_ADD_STRUCTURE_2026_10_23.md)                   | Dated review or implementation record |
| [F10 — type maintenance rows without an escape hatch](reports/F10_TYPED_MAINTENANCE_2026_10_23.md)         | Dated review or implementation record |
| [App-wide UI and logic audit — 13 October 2026](FINAL_UI_AUDIT.md)                                 | Dated review or implementation record |
| [Final UI consistency review](FINAL_UI_CONSISTENCY.md)                                             | Dated review or implementation record |
| [App audit and corrections — 25 October 2026](reports/FULL_APP_AUDIT_2026_10_25.md)                        | Dated review or implementation record |
| [Goals and budgets review — 21 October 2026](reports/GOALS_BUDGETS_FLOW_REVIEW_2026_10_21.md)              | Dated review or implementation record |
| [Home daily remaining refresh — 20 October 2026](reports/HOME_DAILY_REMAINING_FIX_2026_10_20.md)           | Dated review or implementation record |
| [Home redesign (22 October 2026)](reports/HOME_REDESIGN_2026_10_22.md)                                     | Dated review or implementation record |
| [Shared interaction audit — 25 October 2026](reports/INTERACTION_AUDIT_2026_10_25.md)                      | Dated review or implementation record |
| [Interaction and recovery refinement](reports/INTERACTION_RECOVERY_2026_10_20.md)                          | Dated review or implementation record |
| [Loan flow review — 21 October 2026](reports/LOAN_FLOW_REVIEW_2026_10_21.md)                               | Dated review or implementation record |
| [Neat-and-clean pass: audit report (2026-10-22)](reports/NEAT_AND_CLEAN_AUDIT_2026_10_22.md)               | Dated review or implementation record |
| [Notifications redesign (2026-10-22)](reports/NOTIFICATIONS_REDESIGN_2026_10_22.md)                        | Dated review or implementation record |
| [Notification audit — 24 October 2026](reports/NOTIFICATION_AUDIT_2026_10_24.md)                           | Dated review or implementation record |
| [Morning reminder correction — 16 October 2026](reports/NOTIFICATION_FIX_2026_10_16.md)                    | Dated review or implementation record |
| [Optimization and structure review](OPTIMIZATION_REVIEW.md)                                        | Dated review or implementation record |
| [Pending-flow recheck — 21 October 2026](reports/PENDING_FLOW_RECHECK_2026_10_21.md)                       | Dated review or implementation record |
| [Planning workflow improvements — 20 October 2026](reports/PLANNING_FEATURES_2026_10_20.md)                | Dated review or implementation record |
| [Plan redesign (2026-10-22)](reports/PLAN_REDESIGN_2026_10_22.md)                                          | Dated review or implementation record |
| [Production release audit](PRODUCTION_RELEASE_AUDIT.md)                                            | Dated review or implementation record |
| [Profile and Settings redesign (22 October 2026)](reports/PROFILE_REDESIGN_2026_10_22.md)                  | Dated review or implementation record |
| [Re-audit fixes — 19 October 2026](reports/REAUDIT_FIXES_2026_10_19.md)                                    | Dated review or implementation record |
| [Release follow-up audit](RELEASE_FOLLOWUP_AUDIT.md)                                               | Dated review or implementation record |
| [Release readiness — 14 October 2026](reports/RELEASE_READINESS_2026_10_14.md)                             | Dated review or implementation record |
| [Reports, calmer (2026-10-22)](reports/REPORTS_CALM_2026_10_22.md)                                         | Dated review or implementation record |
| [Reports redesign (22 October 2026)](reports/REPORTS_REDESIGN_2026_10_22.md)                               | Dated review or implementation record |
| [Home and planning screenshot refinements — 20 October 2026](reports/SCREENSHOT_REFINEMENTS_2026_10_20.md) | Dated review or implementation record |
| [Screen source coverage](SCREEN_SOURCE_COVERAGE.md)                                                | Dated review or implementation record |
| [Expo SDK 58 upgrade](reports/SDK_58_UPGRADE_2026_10_21.md)                                                | Dated review or implementation record |
| [Related sheet navigation — 21 October 2026](reports/SHEET_FLOW_REVIEW_2026_10_21.md)                      | Dated review or implementation record |
| [App UI consistency — 20 October 2026](reports/UI_SYSTEM_REFINEMENT_2026_10_20.md)                         | Dated review or implementation record |
| [Widget validation — 23 October 2026](reports/WIDGET_VALIDATION_2026_10_23.md)                             | Dated review or implementation record |
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
