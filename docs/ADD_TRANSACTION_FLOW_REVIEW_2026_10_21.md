# Add transaction flow review — 21 October 2026

This review follows the Add transaction request on the existing uncommitted cleanup and loan work. No commit, push, APK installation or phone interaction was performed for this review. The current palette and account-based entry flow are retained.

## Scope and reproduced findings

Traced the Add route, its account/category/date/label controls, friend entries, duplicate checks, staged batches, refunds, draft recovery, plain/split edits, deletion/undo and the Split route. Persistence still uses the existing ledger, person and split services.

Five new regressions failed against the initial implementation: a captured Save callback could create a second transaction after the first commit; transfer destination changes, refund toggles and split-total changes did not activate edit protection; repeated Split Done calls navigated back twice. The first reproduction run had 5 failures and 54 passes across the two screen suites.

## Changes

- Save retains a synchronous committed guard through route completion. It displays busy feedback during duplicate checking, then releases only failed/preflight operations for retry. Save/Add more are disabled until initial loading completes. Busy entry controls reject ordinary pointer input; pad and staged-removal callbacks also check the mutation lock.
- Edit protection includes transfer destination, type/refund status, total expression and split allocation content. Baselines are established after the complete saved split is loaded. Temporary split keys do not count as data changes; reverting tested transfer/refund changes clears the prompt.
- Initial split-load failure cannot publish one part as a plain editable entry. Retry reloads the whole payment. Edit mode retains its title and actions during loading instead of offering new-entry Repeat/Add more; Repeat also waits for initial loading on a new entry. Request sequencing ignores superseded/focus-invalidated loads and their errors; missing edited transactions cannot fall through to new-entry saving.
- Confirmed deletion shares the save lock, emits a transaction-change event, bypasses the unsaved-edit prompt after success and retains Undo for ordinary on-screen completion. Late completion after unmount does not navigate or display a stale undo toast. Failure releases the lock and displays an inline error for retry. Only persistence errors are classified as delete failures.
- Split Done returns once. Cancelling clears its own session so a later direct route cannot reuse the abandoned payment. Successful Save respects reduced motion, and late duplicate-check results do not stage/save an entry after Add has unmounted.
- Zero successful writes now says “No entries saved”; partial success continues to retain only unsaved rows for retry. Existing draft preparation, exact unchanged plain-edit amounts, whole-unit typed input, future-date confirmation, currency checks and linked-record restrictions are preserved.

No payment-method controls, schema changes, financial formula changes or theme replacements were added.

## Validation

- All Add feature tests: **12 suites, 129 tests passed** (`.expo/add-audit-all-add.log`). This includes the new screen regressions, split allocation changes, failed split loading/retry, delete/save coordination, late delete completion and delete-failure recovery, plus existing draft/refund/friend/transfer/batch tests.
- Final Add feature recheck after the route-loading and deletion-feedback refinements: **12 suites, 129 tests passed**, zero failures (`.expo/add-flow-final-recheck.log`, 93.739 seconds).
- TypeScript: passed (`.expo/add-flow-types-final.log`).
- Add route/feature ESLint: passed (`.expo/add-flow-lint-final.log`).
- Changed source formatting: passed (`.expo/add-flow-format-final.log`).
- Final Android JavaScript/Hermes export: passed (`.expo/add-flow-android-final-export.log`, output `.expo/add-flow-android-final-export/`, 8.2 MB Hermes bundle). This is not an APK or an installed-device check.
- Full app tests: **311 suites, 11,297 tests passed; 2 optional suites/tests skipped**, zero failures (`.expo/add-flow-full.log`, 908.026 seconds). Final route-loading identity and deletion-feedback refinements are covered by the subsequent focused Add recheck above.

The renderer tests emit existing React `act`/icon warnings. Passing automated checks does not verify native keyboard positioning, gestures, haptic strength, TalkBack focus or visual smoothness.

## Device acceptance still required

Use a new APK with copied test data. Test expense/income/transfer/friend/refund entry, amount pad plus keyboard, account/date/label popups and large text across selected theme packs. Check rapid Save/Add more taps, duplicate warning confirmation, failed-save retry, split Done/back, changed-edit discard and delete/undo. Confirm Home/Activity balances refresh after save/delete/undo. Test reduced motion and leaving during a deliberately delayed operation in a test build. See [release device checks](RELEASE_DEVICE_CHECKS.md).
