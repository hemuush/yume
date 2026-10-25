# Application verification record: implementation record

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](../ARCHITECTURE.md); for the newer check results see the [repository re-audit](../REPOSITORY_REAUDIT_2026_10_25.md).

## Reading guide for this record

Reviewed against the repository on **11 October 2026**. Source and automated checks are evidence for specific invariants, not proof that every device behavior is correct. The latest APK is version code 15. The last full Jest run had one selector-fixture failure; its corrected focused rerun passed all eight tests. A clean full rerun after that fixture correction has not been recorded.

Implementation: [src/**tests**](../../src/__tests__) and [scripts](../../scripts). Tests generally live beside these modules; use the [architecture and logic guide](../../docs/ARCHITECTURE.md) to find related flows.

This document preserves earlier findings and validation. Statements inside the historical record describe that revision, including old layouts, build status and test counts. They are not new verification results. See the [documentation index](../../docs/INDEX.md), [data model](../../DATA_MODEL.md), [backup guide](../../BACKUP.md) and [build guide](../../BUILD.md) for current contracts.

<details>
<summary>Historical findings, implementation and validation</summary>

## Scope

Reviewed Expo Router screens and shared UI, startup and migrations, transaction writers, splits, accounts, categories, loans, friends ledger, recurring rules, budgets, goals, valuations, reports, backup/restore, app lock, notifications, widgets, caching and performance. Read the versioned Expo SDK 57 documentation before editing. Existing features and local JSON/SQLite storage decisions are preserved.

## Confirmed issues fixed

- Direct transaction edits and split conversion could sever loan-payment or friend-ledger links. The database now checks those links inside the same transaction used to change the entry. Individual split parts require editing the whole group. Missing originals/groups cannot silently become new entries.
- Fractional minor-unit amounts and account balances, impossible calendar dates, malformed recurring schedules, blank person/loan names, and invalid budget months could bypass screen validation. The affected data writers now reject these inputs. Refund behavior and omitted payment modes remain supported.
- Loan installments could be paid out of order, making the principal balance inconsistent. Earlier pending installments must be paid first.
- Legacy database rename failures could start the app with empty data. Upgrade copies preserve the original database, copy journal sidecars before the main file, clean up failed copies and block startup on failure.
- Automatic backup and recurring catch-up ran independently. App maintenance now catches up recurring entries before backing up and shares overlapping resume jobs. Work waits until navigation interactions finish.
- Backup screen focus caching could miss files changed outside the app. The screen now rescans on every visit. Restore validates required table structure, whole minor units and calendar dates before replacing data.
- Jest crawled generated security-install fixtures and found duplicate packages. Generated build/preview directories are excluded from its module crawl.

Regression tests cover the new guards, transactional preservation, failed database-copy retry and maintenance ordering.

## Security and dependency findings

No application fetch/axios/WebView network calls or backend endpoints were found in the source audit. Release configuration blocks Android INTERNET permission. This is a source/config finding, not a penetration test of a newly built APK.

The audit gate and security regression tests pass. Two acknowledged upstream toolchain advisories remain: node-forge GHSA-86w9-cpqp-85rv (Expo CLI signing tooling), and braces GHSA-vfj7-8cjw-p6xm (Jest/Metro glob tooling). The registry versions checked were node-forge 1.4.0 and braces 3.0.3; a forced npm audit fix would downgrade core dependencies and was not applied. The dependency tree is not vulnerability-free.

## Code structure and performance

TypeScript checks unused imports, parameters and locals. Static import traversal included all file-based routes and the index.js widget registration: no unreachable production modules were found. The performance seed is used by its test entry points. This does not prove every exported function is used or every branch is necessary.

The 20,000-entry load/performance suite and output-parity suite pass. Timings are workstation database measurements; they do not establish Android frame rate or eliminate device-specific scroll lag. Shared data-access and screen-load boundaries remain in place; features were not removed to obtain passing checks.

## Required device verification

No connected Android device was available for this audit. Before release, verify a native build on a real phone:

1. Cold start, onboarding, upgrading an existing install and recovery after low storage.
2. Every tab, long-list scrolling, modal opening/closing, keyboard resizing and Android Back, including larger system font sizes.
3. Expense/income/transfer/refund, bulk entries, split edits, undo, friend settlement and loan payment/prepayment/rate change.
4. Existing backup folders with newer data, external file additions, canceled restore, invalid files, failed writes and revoked folder access.
5. App lock after backgrounding, screenshots/recent-app privacy, notification taps, reminder permissions and widget refresh/privacy.

Automated results are recorded below. Passing checks reduce risk; they do not establish that every possible state is perfect.

## Verification

- TypeScript, ESLint, Prettier and git diff whitespace checks: passed.
- Focused regression run: 7 suites, 63 tests passed.
- Performance/output parity: 2 suites, 2 tests passed with 20,000 entries.
- Security decoder/parser regressions: 4 tests passed; dependency audit gate passed with the two acknowledged tooling advisories above.
- Expo SDK dependency alignment: passed (`expo install --check`).
- Android production export: passed, including the Hermes bundle and asset metadata. This is not a native APK installation test.

- Full Jest run: **250 suites and 10,752 tests passed**, no failures. The two skipped suites are opt-in performance suites; both passed separately with `npm run test:perf`. Jest reported lingering asynchronous handles after producing the complete passing results; this is a test-runner cleanup limitation, not a demonstrated app-runtime failure.

A focused `--detectOpenHandles` follow-up did not complete within the bounded diagnostic run and was stopped. The lingering-handle cause remains unresolved; no force-exit option was added to hide it.

## Follow-up edge-case audit — final source pass

Reviewed every route, the shared editors and the data/restore boundaries. This pass preserves the existing storage, backup-format and amount-design decisions.

| Area                                              | Boundaries reviewed and regression coverage                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup/onboarding                                | Empty install, existing data, failed migration copy, retry, canceled/invalid onboarding restore, settings reads and app maintenance ordering.                  |
| Home, Activity, Reports and Plan                  | Empty/loading/error states, period changes, stale results, privacy, category selection, charts, direct payment routes and linked transaction edits.            |
| Add, splits and refunds                           | Invalid/zero/large values, dates, account/category validity, cross-currency transfers, batch saving, split integrity, refunds and repeated presses.            |
| Accounts, categories and investments              | Create/edit/archive/restore/delete, system category restrictions, parent/child editing, partial account creation retry and valuation failures.                 |
| Loans, goals, budgets and friends                 | Installment order, exact payoff, prepayment/rate boundaries, over-withdrawal, linked balances, conflicting actions, completion notes, rollover and settlement. |
| Recurring, Garden, What-if and Wrap               | Catch-up, pause/resume, insufficient history, goal boundaries, calculations, interrupted playback and export/share cleanup.                                    |
| Backup, recovery, Recently deleted and Tidy up    | Latest valid folder data, corrupt/oversized input, canceled restore, write failures, recovery copy, undo and restore/delete conflicts.                         |
| Settings, themes, notifications, lock and widgets | Settings restoration, denied permissions, notification routing, failed preference writes, background privacy and masked widget values.                         |

### Additional fixes

- Applied the existing synchronous save lock to unprotected editors and action handlers. Repeated presses in one frame, and save/delete conflicts in the same editor, cannot run overlapping writes. The lock releases after a failure so retry remains possible.
- Backup/export/restore/recovery share an operation lock. Empty-folder setup no longer nests a guarded operation inside another guarded operation; a regression confirms that two folder-selection presses create exactly one backup and adopt the folder.
- Recently deleted locks restore against permanent clearing, exposes the busy state, and disables destructive actions while an operation runs.
- A blank interest-rate input no longer silently applies 0%. An explicitly entered zero remains valid. Negative or nonnumeric prepayment fee/tax percentages are rejected rather than omitted from the saved payment.
- Wrap's eyebrow font is explicitly declared, satisfying the source-level typography check while retaining its inherited typography.

### Verification and remaining limits

- Full sweep initially produced 250 passing suites / 10,771 passing tests and one font-consistency failure. That failure was corrected and rerun separately; the initial result is retained here rather than presented as a clean full-run result.
- After mutation locking: 26 editor/sheet suites, 186 tests passed.
- Final backup, prepayment, rate, shared-lock and all-screen smoke regressions: 5 suites, 155 tests passed.
- Performance/output parity: 2 suites passed with 20,000 entries. Security parser/decoder: 4 tests passed. Dependency audit has no unacknowledged high/critical advisories; the two previously recorded toolchain advisories remain.
- The full runner again reported lingering asynchronous handles after printing results. Its completed process was stopped after capturing the result; this does not resolve that cleanup issue.
- Device verification above remains required. Source review and automated tests cannot establish Android scroll frame rate, OEM permission behavior, actual biometric enrollment, low-storage recovery, or layout quality at every device/font configuration. No assertion of perfection or exhaustive coverage of all possible states is made.

- Final backup folder and typography rerun: 2 suites, 15 tests passed.
- Final-source TypeScript, ESLint, Prettier and whitespace checks: passed.
- Final-source Android production export: passed (Hermes bundle and metadata). No native APK/device installation test was performed in this pass.

</details>
