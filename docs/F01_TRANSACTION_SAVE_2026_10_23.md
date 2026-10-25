# F01 — atomic transaction save

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Root cause and expected outcome

`createTransaction` committed its INSERT before reading/converting the saved row. If that read failed, Add treated the rejection as unsaved and retained the staged entry for retry. Retrying could insert another entry.

Validation, insert and result conversion now share one transaction on its supplied handle. A read/missing-row failure rolls back the new entry. Reminder refresh remains after commit and cannot invalidate the financial save.

## Files and change

- [transactions.ts](../src/db/transactions.ts:198): replace separate validation/INSERT/SELECT with a transaction; return the converted result after commit.
- [transactionSaveAtomicity.test.ts](../src/db/transactionSaveAtomicity.test.ts:1): real SQLite behind a serialized boundary matching the app client.
- This validation record. Existing widget changes are excluded from this fix.

Before: validate → committed INSERT → SELECT/convert → reminder refresh.

After: transaction(validate → INSERT → SELECT/convert) → commit → reminder refresh.

No migration, dependency, schema, navigation or visual changes.

## Regression evidence

Before the fix, the six-test suite had three failures: read failure left one entry instead of zero; missing result left one instead of zero; retry left two instead of one. The other three behavior checks passed.

After the fix all six focused tests pass:

1. Read failure leaves no entry or balance change.
2. Missing saved row rolls back the insert.
3. Retrying a rejected save inserts exactly one entry.
4. Overlapping saves finish without blocking the database queue.
5. A transfer returns the saved entry and changes both balances.
6. Reminder failure after commit leaves income saved and returns success.

Fresh checks: TypeScript, whole-repository lint, formatting, cycle check and all seven security checks passed. Full regression: **327 suites / 11,398 tests passed; 2 suites/tests skipped**, 348.5 seconds. The first in-process run was stopped as memory grew; the completed run used one worker recycled above 384MB. The strengthened six-test regression was also rerun and passed.

## Self-review and remaining acceptance

All validation and row reads inside the transaction use its supplied handle, avoiding recursive queue access. Production call sites were checked: none calls `createTransaction` from inside another transaction. Existing raw-insert paths for compound financial operations retain their own transaction boundaries.

No new `any`, non-null assertion, lint suppression, dependency or swallowed financial error was introduced. Result conversion runs before commit; only the existing best-effort reminder path runs after commit. Per-entry staged partial-save behavior is preserved.

Android manual checks remain unperformed here: save expense/income/transfer; retry a simulated read failure; confirm balances and single-entry count; exercise staged partial saves and Log again. Check large text, keyboard/Back and OS dark appearance with the configured light app. iOS is outside scope. No startup/frame/memory metric is claimed for this correctness fix.

Risk: transaction scope is slightly wider, including validation reads. The serialized concurrency test covers the principal deadlock risk. Native expo-sqlite acceptance still requires an Android device.

Rollback: revert this fix's commit; no data migration is required. Reverting restores the original rejected-save/duplicate risk.
