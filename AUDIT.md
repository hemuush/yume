# Yume audit — 11 October 2026

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
