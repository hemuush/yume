# Architecture and logic

Reviewed against current source on 11 October 2026. This is a module and behavior map, not a claim that every line or device state has been proven correct.

## Ownership and data flow

[app/](../app) owns Expo Router routes. [src/features/](../src/features) owns screen presentation; [src/components/](../src/components) provides reusable controls. [src/db/](../src/db) owns persisted records and transactional queries. [src/lib/](../src/lib) owns independent calculations and platform workflows. Themes and widgets have separate directories.

The [root layout](../app/_layout.tsx) initializes application services and providers. Screen loads use [useScreenLoad](../src/lib/useScreenLoad.ts); stale requests must not replace a newer scope. Mutations use database transactions and, where appropriate, [useSaveOnce](../src/lib/useSaveOnce.ts) to prevent repeated submissions. [Client](../src/db/client.ts) serializes database operations; callbacks must use the supplied transaction/exclusive handle rather than reopening the database inside that operation.

[runAppMaintenance](../src/lib/runAppMaintenance.ts) shares overlapping runs, catches up recurring entries before backup and emits transaction-change events when records were added. Recurring failures are logged; the backup step still runs. This is foreground maintenance, not a guaranteed background scheduler.

## Financial contracts

| Area                    | Source                                                                             | Contract                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts                | [accounts](../src/db/accounts.ts), [valuations](../src/db/valuations.ts)           | Balances derive from ledger movements; tracked valuations add their own adjustment. Transfers affect both accounts.                                                    |
| Categories              | [categories](../src/db/categories.ts)                                              | At most one parent level, matching kind, no self-parenting; parent privacy applies to children. Archiving preserves history. Built-in filing categories are protected. |
| Transactions and splits | [transactions](../src/db/transactions.ts), [splits](../src/db/splits.ts)           | Positive stored amount plus type/refund semantics determines sign. Linked loan/person records must remain consistent when editing or deleting.                         |
| Loans                   | [loanRecords](../src/db/loanRecords.ts), [loanPayments](../src/db/loanPayments.ts) | Payment, ledger and outstanding-principal changes belong to one transaction. Incomplete schedules must remain visible rather than implying a reliable payoff date.     |
| People                  | [people](../src/db/people.ts)                                                      | Positive balance means owed to you. Balance-only adjustment creates no account transaction; choosing an account represents actual cash movement.                       |
| Goals                   | [savingsGoals](../src/db/savingsGoals.ts)                                          | Manual goal progress and account-linked progress have different sources. A manual contribution is not an account transfer. Withdrawals validate available progress.    |
| Budgets                 | [budgets](../src/db/budgets.ts)                                                    | Category/month limits use scoped spending; rollover and refunds must follow query semantics.                                                                           |
| Recurring               | [recurring](../src/db/recurring.ts)                                                | Catch-up validates each occurrence against live rule state and writes atomically. Keep anchored calendar behavior and bounded catch-up.                                |
| Reports                 | [reports](../src/db/reports.ts), [spendSql](../src/db/spendSql.ts)                 | Apply currency/privacy scope consistently, preserve refund signs and distinguish partial-period comparisons from completed periods. No implicit currency conversion.   |
| Deleted records         | [recentlyDeleted](../src/db/recentlyDeleted.ts)                                    | Restoration must validate related records; retention and permanent deletion are separate from backup recovery.                                                         |

See [data model](../DATA_MODEL.md) for persisted fields. Whole-major-unit entry, local SQLite and plain JSON backup are current product decisions.

## Screen coverage

| Routes / flows                                           | Review focus                                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Home, Activity, Plan, Reports                            | Empty/loading/error states, scope changes, privacy, date selection, compact layout and drill-down navigation.                     |
| Add and Split                                            | Calculator validity, keyboard/pad switching, queued entries, account/category choice, duplicate-save prevention and linked edits. |
| Accounts and tracked values                              | Transfers, credit cycles, valuation dates and derived balances.                                                                   |
| Categories and category detail                           | Parent editing, inherited sensitivity, archive/system restrictions and historical totals.                                         |
| Loans, Recurring, People                                 | Schedule/payment actions, setup edits, settlement direction, live balances and history.                                           |
| Budgets, Savings goals, What-if                          | Limits, rollover, completed/zero progress, scenario controls and existing detail actions.                                         |
| Garden and Wrap                                          | Provisional daily state, eligible history, reduced motion, accessible controls and missing data.                                  |
| Profile, Themes, Notifications and notification settings | Persisted preferences, permission failures, lock state and valid destination routing.                                             |
| Backup, Recently deleted and Tidy up                     | Existing folder discovery, replacement warnings, recovery metadata, guarded deletion and failure recovery.                        |

Route entry points are discoverable in [app](../app); screen-specific helpers/tests are in [features](../src/features). Test coverage should exercise behavior and invariants, not simply duplicate implementation.

## Privacy, restore and platform boundaries

[App lock](../src/lib/appLock.ts) controls access but does not encrypt SQLite or exported backups. [Widget sources](../src/widgets) use a separate hide-details preference; do not infer widget privacy from the lock setting. Restore preserves this phone's folder grant and backup status, and gives already-set local lock/widget preferences precedence over the snapshot.

[Backup](../src/lib/backup.ts) captures table reads in one exclusive operation. [Safety copy](../src/lib/safetyCopy.ts) captures pre-restore records in the same exclusive section as replacement. Recovery refers to that saved snapshot's contents and date; it is not automatic selection of the newest folder file. See [backup guide](../BACKUP.md).

## Verification and limits

Tests live beside their modules, including [backup tests](../src/lib/backup.test.ts), [recurring integration](../src/db/recurring.integration.test.ts), [user journey](../src/db/userJourney.test.ts) and [privacy queries](../src/db/privacyQueries.test.ts). [Build guide](../BUILD.md) lists checks and physical-device release validation. Historical pass counts are retained in the reports and must not be presented as a fresh full-suite run.

Source review and desktop timing do not establish smooth scrolling, native permission behavior or accessibility on every phone. Record actual failures and validation limits rather than claiming a perfect app.
