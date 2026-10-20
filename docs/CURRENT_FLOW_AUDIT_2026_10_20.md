# Current flow audit

## Scope

Reviewed screen handlers and current contracts for Home daily spending/account/upcoming navigation, Activity type/account/category/search/reorder/detail flows, Add/edit/staged/split/refund/friend/transfer paths, Plan forecast/recurring/budget/goal/debt actions, Reports periods/charts/privacy/currency/export, and supporting loan/goal/account/backup flows. Tests exercise these routes; this is not a claim that every native phone interaction was manually performed.

## Corrections

1. Clearing the new-entry form then backgrounding or leaving before autosave settled could retain a stale filled recovery copy. Pending deletions now flush too.
2. A pending recovered draft could be replaced on background by a newly typed form before Resume/Discard. Automatic persistence stays suspended until that choice resolves.
3. A failed Discard could leave autosave permanently blocked. Failed navigation discards now restore the prior persistence state.
4. Draft reference checks included unused Friend/Transfer fields after switching entry type. Resume validates only active form references plus the actual staged/split entries.
5. Future-date confirmation checked the form date instead of every entry being saved. Far-future staged rows now prompt even after the current form date changes back; unused form dates do not drive the confirmation.
6. Split persistence could succeed and its follow-up highlight lookup fail, presenting a false save failure. Highlight lookup is now optional after commit.
7. A refund could offer Make recurring with an expense category, even though recurring rules do not represent refunds. That action is omitted for refunds; Log today keeps its refund semantics.
8. Refund refresh/callback failures were caught as write errors. Committed updates clear receipt input and report Saved with refresh guidance. Actual write failures retain the input for retry.
9. Recovery snapshots could outlive an in-progress save and replay already committed entries after interruption. New-entry/split saves first remove and suspend the recovery copy; failures resume recovery from the remaining form. If preparation fails, no financial write starts and the form remains intact. This does not turn staged multi-entry saving into an atomic batch: existing partial-save behavior retains only unsaved entries. Interruption during saving can lose unsaved draft work, but cannot replay the old recovery batch automatically.

10. Leaving Add before a pending save completed could schedule a second Back navigation after unmount. Completion now checks screen lifetime, pending timers are cancelled, and successful/partially successful writes emit the data-change signal so the visible lists refresh. Conflicting Repeat/Delete/type actions are guarded during saving.

Four failing regressions first reproduced the cleared-draft, pending-draft, future-date and refund-recurring issues. A separate failing late-completion test reproduced the extra Back navigation. Further tests cover failed-discard retry, save preparation failure, optional split lookup failure and receipt write-versus-refresh behavior.

## Validation

Focused flow/animation/date checks: 28 suites and 253 tests passed before the final two additional failure-path tests. The final post-review check passed 5 suites / 214 tests, including real screen smoke tests and the late-completion regression. Fresh verification completed:

- Full regression: 307 suites passed, 11,242 tests passed; two opt-in performance checks skipped.
- Final post-review recheck: 5 suites / 214 tests passed, including the last mount-lifetime/navigation and data-change notification edits. The full run started before those last narrow edits; this recheck covers their final revision.
- TypeScript and scoped ESLint passed after final source changes.
- Android Hermes export passed to `.expo/flow-audit-final-export`.
- Native privacy/URI scripts: 8 tests passed.
- `git diff --check` passed.

No APK was built, no device was connected, and no commit or push was performed. Prior chat validation reports apply to prior revisions.

Payment-method UI stays removed. Theme colors and financial recording units are unchanged. No commit or push is authorized by this audit.

## Remaining native acceptance

ADB is not available on PATH or at the standard local SDK path. Native device animation smoothness, keyboard/safe-area behavior, force-stop interruption and enlarged-font layout have not been manually checked here. Android JavaScript export does not build or install an APK.
