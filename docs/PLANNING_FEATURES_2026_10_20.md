# Planning workflow improvements — 20 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

These changes are local and uncommitted. They preserve the selected app theme and use existing sheets, controls and typography.

## Where to check

- **Plan → Upcoming → a recurring entry → Manage next occurrence:** change one amount, postpone within the current cycle, skip once or record the actual amount/date. Under Schedule choose Automatic or Confirm first. Confirmation advances the rule atomically; a repeated/stale action is rejected. A postponement preserves the original cadence. Overdue confirm-first bills remain in remaining commitments.
- **Plan → Goals → a goal → Progress history:** paginated additions, withdrawals, reservations, releases and reservation moves. Each journal entry shares the progress transaction. No old history or account-following contributions are invented. Privacy masks journal amounts. Archive goals with history to preserve it.
- **Add/edit an entry → Payment method:** choose a method or leave Not recorded. Staged entries and splits retain the choice. **Activity → Filters** can select a method; **Reports → Breakdown → Explore payment methods** shows net spending using the recorded method, default currency and category-family privacy exclusions. Refunds reduce their recorded method.
- **Plan → Money plan → Does your monthly plan fit?:** optional currency-specific expected income alongside combined spending and savings requirements. Parent budgets cover matching children/bills; matching savings transfers and goal funding are not added twice. Card repayments are not additional spending. Unbudgeted daily spending can be missing; undated/overdue goals and missing loan schedules are flagged as excluded. This is an estimate, separate from the dated forecast.
- **Plan → Debt → Compare extra payment** (two or more borrowed loans): compares the same amount using each live loan schedule in one exclusive read slot. It creates no payments or ledger entries. Assumes unchanged rates and EMI; excludes lender charges. Review the loan separately before paying.

## Persistence and recovery

Backup format 4 includes goal activity and recurring one-off/recording fields. Formats 1–3 remain readable. Missing journal data stays empty and missing recording modes default to automatic. Malformed journal references are rejected before replacement. Older apps reject newer backup formats.

## Initial implementation verification

Verification recorded before the follow-up audit below:

- Full second regression run: **301 suites passed; 11,191 tests passed**. Two opt-in performance suites/tests were skipped. No failures.
- TypeScript `--noEmit`, repository ESLint plus final changed-file checks, Prettier and `git diff --check`: passed.
- Security scripts: **8 tests passed**.
- Latest Android JavaScript/Hermes export: passed, output `.expo/planning-features-verified-export`. No APK was built or installed.
- Focused coverage includes cadence preservation, one-off amounts, confirm-first/stale submissions, unchanged paise, goal journal atomic rollback/pagination/privacy/restore refresh, old backup compatibility, private category families, currency scope, monthly overlap calculations and read-only loan comparison.

The first broad run caught a goal-menu regression. The menu now uses derived journal presence, preserving Delete for never-funded goals and Archive for goals with history even at zero balance. Its focused retest and complete second run passed. Earlier audit reports describe their own revisions.

Device-only checks remain open: native sheet transitions, keyboard/safe areas, large text, screen readers and theme appearance on the user's APK. A JavaScript Android export is not an installed APK check.

## Follow-up audit requested by the user

The five implemented flows were rechecked through their UI entry points, persistence, calculations, privacy scope and restore behavior. Three gaps were found and corrected:

1. **Income validation:** the generic amount-preview helper converted invalid, negative or oversized input to zero. The monthly estimate now preserves invalid values until the settings validator rejects them; an explicit zero remains valid.
2. **Restore freshness:** the monthly estimate and loan comparison could retain results when refreshed data kept the same currency, loan balance and due date. Both now use the loaded Plan snapshot as a refresh scope. Results from an obsolete snapshot are excluded immediately, and an old save completion cannot overwrite the restored income estimate.
3. **Automatic catch-up warning:** changing an overdue rule from Confirm first to Automatic kept the same next date and bypassed the past-entry warning. That mode change now requires the warning before saving.

Regression coverage includes invalid/zero income, same-currency restore, late-save/restore races, loan recalculation after an unchanged-balance refresh, hidden comparisons and explicit acceptance before automatic catch-up. Fresh follow-up verification: **305 suites and 11,204 tests passed**, with two opt-in performance suites/tests skipped and no failures. TypeScript, lint for all follow-up source/test files, whitespace checks and the Android export passed. Export output: `.expo/planning-reaudit-export`. This does not represent an installed APK test.

No native phone inspection was performed: ADB was unavailable on PATH and at the default Android SDK path. Selected-theme usage and masking were checked in source and component tests; native appearance and transitions remain device checks. No commit or push was made.

## Follow-up UI polish

Loan comparison payoff dates now use the shared locale-aware day/month/year formatter, parsing calendar dates locally. Activity payment-method selections now appear in the existing horizontally scrollable capsule row beside category/account filters, with the selected theme tint, remove icon, 48dp touch target and Clear all support. The separate plain-text payment-filter row is removed.

Fresh checks for this presentation change: 41 tests passed across five affected suites; TypeScript, lint, formatting and whitespace checks passed. No financial calculation or persisted record changed. No commit, push or native-device appearance check was performed.

Acceptance recheck of the two presentation changes: 43 tests passed across five suites, including removal of UPI/Not recorded without clearing other selections and Clear all when payment method is the only filter. TypeScript, lint and whitespace checks passed. Source review confirms shared theme/spacing and local calendar-date parsing. Native-device visual acceptance remains open.
