# Follow-up code audit — 10 October 2026

## Scope

This is a repository-wide follow-up to APP_AUDIT.md and the subsequent UI/performance fixes. It combines the architecture/source review, targeted tracing of failure and concurrency paths, the complete regression suite, native configuration checks, dependency auditing and Android bundle verification. It is not a claim that every line has been independently proved correct or that every screen has been exercised on a phone.

The route/shared-layer inventory covers 26 route/layout files, 50 shared components, 187 feature files, 36 database files, 70 library files, three theme files and 12 widget files. These are inventory counts, not counts of files receiving a line-by-line review. All 23 actual screen routes are exercised by the existing empty/populated/privacy smoke tests. Expo 57 versioned documentation was read before editing.

Existing design and features are preserved. No database schema migration, exchange-rate conversion, APK build or deployment was performed.

## Findings fixed

| Priority | Finding | Result |
| --- | --- | --- |
| P1 | LockScreen treated a failed device-security query as an unsecured device, exposing the lock-disable recovery action after a native failure. | Recovery is offered only when Android explicitly returns false for device security. Unknown/error status keeps the app locked. A synchronous guard prevents duplicate authentication prompts. |
| P2 | AppLockProvider started from false even after startup had verified lock-on; a failed second read could leave relocking/screenshot protection disabled after unlock. Older reads could also overwrite newer toggles. | The provider receives startup's verified preference. Reads and rollback handlers use a generation check; obsolete results cannot replace newer state. |
| P2 | Savings contributions validated goal/account tracking separately from the write. A stale withdrawal silently clamped to zero, and accumulated additions could exceed exact integer precision. | Existence, account-tracking mode, live saved balance and resulting safe-integer total are checked in the same transaction as the update. Over-withdrawals reject without changing the balance. Saving above a goal target remains supported. |
| P2 | Recently Deleted depended on startup purging to enforce its 30-day retention, so a long-running app could list/count/restore expired entries. | List, count and restore apply the retention cutoff directly. Startup purging still removes expired stored rows. |
| P2 | Recently Deleted read the snapshot before its restore transaction, allowing another queued operation to clear entries between validation and restoration. | Snapshot lookup, split-part lookup, reinsertion and removal now share one database transaction. |
| P2 | Enabling app lock could reject from Android's security API without user feedback. | Settings catches the failure, preserves the preference and displays an actionable error. |
| P2 | Continue all budgets swallowed individual failures and could begin overlapping operations before the UI disabled the action. | Partial failures identify their categories; later budgets still continue. A shared synchronous guard prevents overlapping continuation starts. |

## Areas covered by the broader audit

| Area | Evidence and checks |
| --- | --- |
| Home, Activity, Plan, Reports | Existing UI/flow tests and all-screen smoke tests; period transitions, selection, charts, privacy and loading regressions. Home spending and Plan debt changes from the preceding pass retained. |
| Add, transfers, refunds and splits | Input validation, currency restrictions, duplicate-save controls, split persistence and linked transaction safety tests. |
| Accounts, categories, budgets and goals | Database invariants, archived metadata, balance calculations, account-following goals, budget rollover and new live-balance/partial-failure tests. |
| Loans and friends | Real SQLite loan/payment/undo/rate/prepayment scenarios, same-currency ownership and IOU atomic updates. |
| Recurring | Existing deterministic pause/edit/delete/catch-up tests, schedule/calendar helpers and editor tests. |
| Backup, restore and recovery | Existing snapshot validation, foreign-key checks, exclusive restore queue, recovery metadata and local backup tests. Native folder access still needs device verification. |
| Privacy, app lock and onboarding | New lock-screen and preference-ordering tests plus existing privacy, restore-settings and onboarding tests. |
| Notifications and widgets | Existing route allowlisting, planning, scheduling and widget privacy tests. Real Android delivery/launcher behavior remains pending. |
| Garden, What-if, Wrap, Themes, Tidy up, deleted entries and settings | Existing feature and screen smoke tests; deleted-entry retention and restore logic traced and corrected. |
| Shared forms, sheets, animation and loading | Existing font/contrast/font-scale/control/motion/freshness tests; prior performance and UI refinements retained. |

## Verification

| Check | Result |
| --- | --- |
| Complete regression suite | 249 suites passed, 10,726 tests passed; two existing PERF=1 opt-in suites/tests skipped. Final run exited successfully without the earlier open-handle warning. |
| Follow-up after lint cleanup | App-lock provider and restore-settings suites passed: three tests. |
| TypeScript | Passed. |
| ESLint | Entire repository passed with zero warnings. |
| Expo Doctor | All 21 checks passed. |
| Dependency gate | Passed existing policy; braces and node-forge remain allowlisted tooling advisories. |
| Android Hermes export | Final export passed: 2,301 modules, 7.8MB, `dist/followup-audit-check/_expo/static/js/android/index-2023b386a8fb8281df3c1f648646099a.hbc`. |
| Diff whitespace | Passed. |

The full-suite log is `.expo/full-audit-final-tests.log`. Doctor results are in `.expo/followup-audit-doctor.log`. Logs and generated bundles are ignored local artifacts, not source files committed to Git.

New regression coverage includes unknown native security status, confirmed-unsecured recovery, duplicate prompt prevention, preserved startup lock state, stale preference reads, partial budget failures, expired deleted entries without startup purging, and goal withdrawal/precision boundaries.

The first full run found one journey test still expecting the old silent goal clamp. It was changed to assert rejection with the saved balance unchanged, followed by a valid withdrawal. That completed run also left a Jest open handle; its verified task-owned process was stopped after results were collected. The final run's outcome is recorded separately below.

## Pending areas

1. **Android visual and performance testing:** small-screen layout, enlarged fonts, scroll/navigation frame rate, sheets, keyboard and system-bar seams. Component tests and Hermes export do not measure actual phone rendering or FPS.
2. **Native security/lifecycle testing:** biometric/PIN fallback, cancel/retry, background relock, screenshot/recent-app protection and own-picker return behavior.
3. **Native integrations:** real notification delivery, launcher widgets, Android folder permissions, backup files, share/export and restore on a device.
4. **Tooling advisories:** the dependency gate still permits the existing braces and node-forge advisories under repository policy. They are tooling dependencies; no dependency update was made in this pass.
5. **Release delivery:** the current shared APK predates these changes. A new build and device signoff remain separate work; no APK was created here.

There is no newly disabled feature or placeholder screen introduced by this audit. The pending items above are explicit verification/release work, not evidence that a test-passing app has no remaining defects.
