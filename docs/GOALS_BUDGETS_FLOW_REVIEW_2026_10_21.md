# Goals and budgets review — 21 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

This review follows the goals/budgets request on the existing uncommitted work. No commit, push, APK installation or native phone interaction was performed. Existing theme packs, category colors and shared sheet/button design are retained.

## Scope

Traced Home/Plan previews, dedicated list routes, overview/edit sheets, creation, category/account selection, monthly pace, rollover, manual goal progress, followed accounts, reservations, releases/moves, archived goals, completion letters, history and delete/undo. Existing currency, privacy and financial contracts were checked against the database tests.

## Corrected behavior

- Budget and goal list cards open their existing overview sheets, matching Plan. Edit remains a separate action. The budget menu retains direct Edit limit and Delete shortcuts. Selected overview data refreshes in place.
- Creation/edit/archive/delete share a keyed-sheet mutation helper. It locks synchronously, dismisses input, separates write failures from refresh failures, retains committed state and ignores obsolete UI callbacks after unmount. Failed writes remain retryable. Busy forms withhold interactive content from accessibility focus and disable text editing.
- A goal contribution cannot be replayed from an old callback after completion or successful refresh. Financial writes are classified separately from feedback/read failures. Reservation release has a separate committed guard. Money actions explain whether they update manual progress or earmark an existing account balance; neither creates a transfer.
- Reservation read failures offer Retry. Destination selection is required for Move. Completing an action from the editor returns to its unsaved draft and refreshes progress instead of discarding edits. Refreshing the same goal does not reset its draft; opening another goal creates a new form session.
- New budget writes require an active expense category. Duplicate checking, insertion and result lookup share a transaction; missing edits report an unavailable budget. Delete captures its Undo snapshot in the delete transaction. Goal insertion and its result lookup also share a transaction, so failure to read the created record rolls back instead of inviting duplicate creation.
- Archived manual goals require unarchiving before additions or withdrawals. Archived reservations retain their existing release/move rules. Goal history and existing archive/delete restrictions are preserved.
- Budget overview queries filter spending/refunds before applying the recent-entry limit; ordinary income cannot crowd out relevant entries. Parent/category rollups and refunds retain their existing financial scope.
- Combined budget totals count parent-covered child budgets once. Each child retains its own row, limit and warning. The Budget hero explains nested totals. Monthly commitment estimates retain their existing parent-limit and account-following deduplication rules.
- New-budget category choices apply the same family privacy rule as budget queries, including sensitive archived children. Unavailable followed accounts cannot launch a transfer from the goal list; editing offers a path to another account. Archived accounts remain available as existing-goal metadata but are omitted from new selection.
- Automatic goal letters wait for visible savings and for other sheets to close. The list loader no longer marks letters as read. Both list and contribution reveals persist the read flag on acknowledgement. Failure remains retryable; closing does not repeat the financial write, and dismissing a failed automatic reveal defers letters for that screen visit. Manual completion while hidden leaves the letter for later. The reveal component also protects a visible letter when privacy changes.

The first reproduction run failed six new regression cases; it reported seven failures because the accepted invalid-category fixture also affected a later budget assertion. Subsequent targeted runs exposed and corrected a transaction-return mistake in the first delete implementation and async `act` handling in two existing overview tests. Those intermediate results are not fresh validation of the final source.

## Structure and performance

`useSheetMutation` owns sheet write/refresh/completion state. Thin modal wrappers own session lifetime; their forms initialize once per opening/record rather than resetting during render or on every refreshed object.

`budgetCategories` owns picker eligibility and family privacy. `budgetScope` owns parent-covered aggregate selection. Budget spending is accumulated into maps once per query instead of reducing every spending row for each budget. Goal lists memoize account lookups, active/archived lists, hues and totals. One shared `useToday` subscription/timer replaces per-budget-row listeners and updates on local midnight/resume. Removed list-route navigation imports and superseded form-reset/guard code are no longer needed.

No persisted schema, currency conversion, typed-amount quantization, manual-progress ledger semantics or rollover policy was changed. Rollover still uses the documented previous-month base-limit carry. Goal totals remain progress toward individual goals, not a claim of distinct bank cash when several goals follow one account.

## Validation

The first broad regression run (`.expo/goals-budgets-full.log`, 460.15 seconds) executed 315 suites: 312 passed, 3 failed and 2 optional suites were skipped. It recorded 11,317 passing tests, 4 failing assertions and 2 optional skipped tests. The failures were two smoke assertions still expecting direct edit sheets, a contribution assertion treating any Done button as a completion reveal, and an old completion-copy assertion. Tests were updated to check overview → edit navigation, actual reveal visibility and the target-reached wording. This initial run is not described as a clean full-suite pass.

The corrected integration run passed 31 suites / 351 tests (`.expo/goals-budgets-verified.log`, 76.057 seconds). After the final acknowledgement/retry refinements, the same coverage plus three additional regressions passed **31 suites / 354 tests** (`.expo/goals-budgets-verified-final-all.log`, 75.213 seconds). This includes all goal/budget feature tests, list-route navigation, full screen smoke tests, completion/privacy, SQLite budget/goal/reservation/account-following behavior, Plan summaries, monthly commitments and the sheet mutation helper. Expected notification failure-injection warnings and asynchronous icon-loader `act` warnings remain in test output; there are no failing assertions in the final run.

Final TypeScript (`tsc --noEmit`), repository-wide ESLint and Prettier checks of changed/new TypeScript sources passed. Evidence is in `.expo/goals-budgets-types-verified.log`, `.expo/goals-budgets-lint-verified.log` and `.expo/goals-budgets-format-verified.log`. `git diff --check` passed and the index remains empty.

Android production export passed (`expo export --platform android --output-dir .expo/goals-budgets-android-export`), producing one 8.2 MB Hermes bundle and metadata. Evidence is `.expo/goals-budgets-android-export.log`. This verifies bundling, not APK installation or native interaction. Updated review/index/architecture/device-check documents also passed formatting.

Earlier Add/loan reports remain historical evidence, not test runs for this change. Native keyboard geometry, TalkBack focus, haptic strength and modal sequencing are still device acceptance items.

## Device checks still required

Use a new APK and copied data. Verify overview/edit/back navigation, keyboard/pad dismissal, native modal sequencing, long names, enlarged text, TalkBack and reduced motion under each selected theme. Exercise all goal modes, failed-save/retry, failed reservation reads, privacy during completion, preserved drafts, archive/unarchive and budget delete/undo. Confirm current-month rollover/continuation and Home/Plan/account refresh on the phone. See [release device checks](RELEASE_DEVICE_CHECKS.md).
