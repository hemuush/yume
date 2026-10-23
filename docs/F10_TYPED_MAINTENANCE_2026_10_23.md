# F10 — type maintenance rows without an escape hatch

## Root cause / result

The rounding query described every column as `number | null`, although all six participating tables use text IDs. Its follow-up query erased that mismatch with an explicit `any[]` cast. The query projection now has a required string ID and SQL-compatible scalar columns. Both snapshots and lookup maps use that row type; IDs bind directly as `string[]`.

Files: [maintenance row and queries](../src/db/maintenance.ts:103), [production lint guard](../eslint.config.js:26). SQL, transaction boundaries, values, chunk size and conditional undo are unchanged. No dependency or migration.

## Regression evidence

This is a static type defect, not a newly demonstrated runtime failure. The added production `no-explicit-any` rule failed on the old binding at maintenance.ts:167 with one error. Test fixtures and performance harnesses are outside that production rule. Removing the cast through an accurate row type satisfies it without a suppression.

The existing real-SQLite maintenance and data-core regression suites pass: **2 suites / 32 tests**. They exercise rounding, atomic failure, preservation of loan-linked amounts and conditional undo that does not overwrite later edits.

Strict TypeScript, whole-repository lint, formatting, circular-import and security checks pass. Fresh full regression with coverage: **331 suites / 11,434 tests passed; 2 suites/tests skipped**, 567.3 seconds. Those two performance suites run separately. Line coverage against the original revision increases from **88.18% to 88.32%** under the same explicit production scope; see the [verification report](ANDROID_AUDIT_VERIFICATION_2026_10_23.md) for denominators, remaining checks and limits. No test assertion or type/lint rule is weakened.

## Risk / rollback / manual acceptance

Low risk: a compile-time correction with unchanged SQL. Review confirms all bound values remain supported SQLite scalars. Rollback: revert this fix's commit; no data conversion is needed.

Android acceptance remains pending: on a disposable ledger, round fractional amounts, check accounts and planning totals, edit a rounded entry, then undo. The edited value must survive. Check the confirmation and feedback with TalkBack, 200% text and OS dark appearance (the app is configured light). iOS is outside scope. No native performance improvement is claimed.
