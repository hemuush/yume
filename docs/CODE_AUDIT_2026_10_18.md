# Code audit — 18 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Started 18 October; completed 19 October 2026. Validation below was run for this audit.

Follow-up: see [19 October audit fixes](AUDIT_FIXES_2026_10_19.md) for implemented corrections and new validation. This report preserves the findings and results at the reviewed revision; its source line numbers describe that baseline.

Reviewed revision: `6109b40232266423db459fcd361e1e4d71f57c28`, initially clean working tree, Windows / Node 24.15.0. This audit changes no application behavior. The findings below are current-source findings, not carried-forward claims from earlier reports.

The review covered architecture and module ownership, financial writes and reads, privacy and app lock, restore/export, notifications, shared UI controls, accessibility, dependencies, dead code and performance. A source dependency inventory covered 423 non-test JS/TS files across `src`, `app` and the entry point; that inventory is not a claim that every possible execution path was exercised. Native UI appearance and device behavior were not tested.

Read before review: [documentation index](INDEX.md), [architecture](ARCHITECTURE.md), and the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/).

## Findings

P1 means address before release; P2 means a concrete functional or privacy defect to schedule next. These are separate from the improvement opportunities later in this report.

### 1. P1 — Home module names break TypeScript resolution on Windows

Location: `src/features/home/ThisMonthHero.tsx:25`, `src/features/home/MoneyBar.tsx`, `src/features/home/moneyBar.ts`.

`ThisMonthHero` imports `./MoneyBar`, while the calculation helper is named `moneyBar.ts` and the component is `MoneyBar.tsx`. On this case-insensitive filesystem, resolution finds the `.ts` helper for the component import. Fresh `npm run typecheck` reports TS1149 / TS1261 and TS2305: no exported member `MoneyBar`. The existing screen smoke tests also reproduce a Home render failure: `Element type is invalid ... got: undefined`, pointing to `ThisMonthHero`. This blocks the typecheck gate and breaks Home in the Windows renderer run. A successful bundling command alone would not demonstrate that the component renders correctly.

Rename the helper to a distinct name such as `moneyBarSegments.ts` and update both component and test imports. Validate typechecking and render Home using the actual import rather than a component mock.

### 2. P1 — A public parent budget exposes sensitive child spending

Location: `src/db/budgets.ts:117` and `src/db/budgets.ts:123`; display path: `app/budgets.tsx:84` and `src/features/budgets/BudgetRow.tsx:58`.

The privacy query filters budget categories using their own/inherited sensitivity. `spendByCategory` then rolls every child transaction into the parent without a sensitive-child restriction. A public parent with a private child survives the filter, carrying the private spending in its spent/remaining/progress figures and spoken label.

Reproduced with a public parent, a sensitive child, a parent budget and only 42,000 minor units of child spending: `listBudgetsForMonth('2026-10', true)` returns the public budget with `spentMinor: 42000`. The supposedly hidden amount is directly visible. Rollover calculations use the same unfiltered aggregation.

Apply a consistent category-family privacy policy before returning parent budgets and their derived totals, including rollover and lapsed-budget paths. Add integration coverage for a sensitive child under a public budgeted parent, not only top-level sensitive categories.

### 3. P2 — Editing an annual bill's currency can make its own backup unrestorable

Location: `src/db/recurring.ts:157–181`; invariant established in `src/db/annualBills.ts` and checked on restore in `src/lib/backup.ts`.

Creating an annual preparation link requires matching bill and reservation-account currencies. Editing a linked rule only guards its type and frequency; changing its expense account to a different currency is accepted. The existing reservation then gets compared to an unrelated currency amount. Export still succeeds, but restore rejects the resulting snapshot as an invalid annual preparation goal.

Reproduced by preparing an INR annual bill using an INR account, editing the bill to use a USD account, building a snapshot and restoring it. The edit succeeds; restore throws `This backup contains an invalid annual preparation goal. Nothing was changed.` The restore refusal is protective; the defect is allowing an invalid state to be saved in the first place.

Inside the edit transaction, validate any linked preparation goal against the new bill account's currency. Require unlinking or a compatible account before saving.

### 4. P2 — Deleting a category loses its budgets even after Undo

Location: `src/db/categories.ts:275–291`; `budgets.category_id` uses `ON DELETE CASCADE` in `src/db/schema.ts`.

Category deletion rejects transactions and recurring rules but does not check budgets. It snapshots only categories. Deleting an unused category that has a budget silently cascades the budget away; Undo restores the category rows but cannot restore the budget. For a leaf category, the UI performs the delete immediately with an Undo toast, making this particularly misleading.

Reproduced by creating an otherwise-unused category with an October budget, deleting it, then calling `restoreCategory` with the returned snapshot: the category returns and the budgets table remains empty.

Either block deletion when any category in the deleted family has budgets, or capture and atomically restore those budgets alongside the category. Include historical budgets in the decision.

### 5. P2 — Parent actions bypass built-in category protection

Location: `src/db/categories.ts:157–161`, `src/db/categories.ts:209–230`, `src/db/categories.ts:243–280`; UI: `src/features/categories/AddCategoryModal.tsx:76`.

Built-in categories cannot be renamed, archived or deleted directly, but their parent is editable. Move a childless built-in such as Loan EMI under an ordinary expense category, then archive/delete the parent. The guard checks only the selected parent, while the mutation also affects children. Archiving hides the built-in from active category lookups; deleting an unused family removes it outright. Loan filing/payment context and automatic category selection can consequently fail or fall back incorrectly.

Both the archive and delete bypasses reproduced against real SQLite. Protect system categories from reparenting, and defensively check all affected descendants inside the archive/delete transaction. UI restrictions alone would not cover restored or older data.

### 6. P2 — Tracked refunds do not net against the purchase's expense label

Location: `src/db/refundTracking.ts:228`; grouping: `src/db/expenseLabels.ts`.

The received-refund writer creates `note: Refund: <purchase label>`. Since expense labels now live in `transactions.note` and reports group by exact trimmed text, this creates a separate label. It differs from the immediate Refund action, which prefills the original label.

Reproduced: a 100,000-minor-unit purchase labelled `Shoes` and a full tracked refund produce `Shoes: +100000` and `Refund: Shoes: -100000`. The overall total is correct, but the Shoes report and exact Activity label filter exclude its refund. Unlabelled purchases also gain a synthetic label when refunded through this path.

Preserve the purchase label for newly created receipts and express refund identity using `is_refund` / the existing UI badge. Decide explicitly how to handle historical prefixed labels without rewriting unrelated user text.

### 7. P2 — Enabling privacy does not replace already-scheduled private reminders

Location: `src/theme/PrivacyContext.tsx:84–87`, `src/db/settings.ts:740–748`; filtering: `src/db/notificationData.ts:8–14`.

Optional bill/refund notifications exclude private category families when the schedule is built. Turning on Hide savings & investment amounts only updates context and the saved preference; it does not rebuild that schedule. Notifications queued while details were visible retain their private bill/purchase labels until another rebuild. Changing a category's sensitivity also lacks notification invalidation.

The settings path was executed with a notification rebuild spy: enabling privacy caused no rebuild. Source tracing confirms that already scheduled OS payloads are not updated by the preference change. Actual OS delivery was not tested. Foreground maintenance can later repair the schedule, but it does not prevent a previously queued alert from firing while the app stays open.

Refresh privacy-sensitive scheduled content after a committed privacy/sensitivity change. Handle scheduling failure without silently claiming the queued content is now private.

### 8. P2 — Recording a refund received on an earlier day leaves stale follow-ups

Location: `src/db/refundTracking.ts:238–239`; delegated date condition: `src/db/transactions.ts:190–203`.

When `receiveRefund` creates a new transaction, it calls the generic transaction notification helper instead of the refund-topic rebuild. That helper rebuilds for an income/refund only if its date is today. A valid receipt dated yesterday can fully satisfy an expected refund while leaving future outstanding-refund reminders scheduled.

Reproduced with refund alerts enabled: recording a full receipt dated 2 October for a purchase dated 1 October made no rebuild call. Linking an existing receipt takes a different branch that does refresh the topic.

Always invalidate refund follow-ups after a receipt commits, including backdated receipts, and coordinate that with any same-day logging reminder update to avoid duplicate rebuilds.

## Data flow and structure

The main ownership split is sensible: routes coordinate screens; feature modules render and handle forms; database modules own persistence; pure financial/date helpers live in `src/lib`. The serialized database handle, transaction callbacks, save guards, foreign keys, restore rollback and explicit post-commit notification helpers provide useful safeguards.

The repeated weakness is maintaining invariants across boundaries: category deletion versus budget snapshots, annual-rule edits versus goal links, refund writers versus label semantics, and privacy changes versus OS notification state. Shared invariants and explicit post-commit invalidation should be preferred over adding more screen-specific conditions.

`useScreenLoad` guards its loading/error bookkeeping, but it cannot prevent an arbitrary supplied callback from calling stale `setState` functions. Callers still own response guards. Its contract should say this clearly; a future data-returning loader API could centralize commit checks. This is an architectural concern, not an additional reproduced failure in this audit.

Large modules concentrate responsibilities: `src/db/reports.ts` 1,136 lines; `app/add-transaction.tsx` 1,046; Activity route 1,019; settings 925; Reports route 873; Home route 815. Line count alone is not a defect. Useful extraction boundaries are form/draft state and save orchestration, report query families, and typed settings domains. Preserve database transaction ownership when extracting.

## Design, UI and UX

Source review found a coherent palette, shared sheets/dialogs, pinned actions, explicit loading/error states, reduced-motion support and numerous named accessibility controls. The refund labels and misleading category Undo are concrete UX failures described above.

Further improvements to validate on a device:

- `src/components/Text.tsx:8` caps all text/input scaling at 1.3. This is an explicit existing product choice, but it limits usability for people who need larger text. Reflow critical forms and financial figures before relaxing the cap; test at 200% instead of treating 130% as universal acceptance.
- `src/features/home/SpendBars.tsx:59` uses square-root bar scaling, while the visible chart does not explain the nonlinear scale. Exact amounts are available on selection, but relative heights can suggest misleading spending ratios. Consider a disclosed scale or a linear mode.
- Verify small-screen and long-value layouts, TalkBack traversal and nested action buttons, focus returning from child sheets, amount-pad/system-keyboard transitions, Android back behavior, and reduced motion on the signed app. Source and renderer tests do not establish these native interactions.

No physical phone, emulator, native screenshots, signed APK, launcher compatibility, real authentication prompt or actual notification delivery was tested. Android platform tools were not available on PATH and no generated native project was present.

## Dead code and optimization

Runtime import tracing, followed by repository reference searches, found two unused components: `src/components/OdometerAmount.tsx` and `src/components/SoftCard.tsx`. OdometerAmount has an obsolete test mock; SoftCard survives in comments. Remove these after confirming there is no external consumer. Do not remove `src/perf/seedLedger.ts` or `src/types/index.ts`: the former serves tests/benchmarks and the latter type-only imports.

Fresh performance fixtures passed. Selected desktop SQLite measurements:

| Workload        |   Time | Instrumented database calls |
| --------------- | -----: | --------------------------: |
| Home            |  95 ms |                          52 |
| Reports, month  | 143 ms |                          51 |
| Activity, month |  20 ms |                          15 |
| Plan            |  10 ms |                           5 |
| Needs you       |  66 ms |                          38 |
| Budgets         |   3 ms |                           4 |
| Backup snapshot |  79 ms |       1 exclusive operation |

These are fixture timings on this desktop, not on-device latency. The exclusive backup count covers multiple internal table reads. Home/Reports/Needs you query fan-out is a useful profiling target because native database bridge operations are serialized. Batch related reads where consistency and measured performance justify it; preserve privacy and currency scope.

## Security and dependency review

App lock is an access gate, not SQLite or backup encryption. Plain JSON backups and separate widget privacy are documented product choices. The reviewed code includes authenticated export with app lock enabled, a startup privacy-read gate, parameterized value queries, schema-whitelisted restore columns, foreign-key validation before restore commit, private notification visibility and a caller-checked widget image provider. These controls were inspected; native effectiveness was not newly established.

Targeted searches found no matching embedded private keys/API-key patterns in the searched application/plugin/script sources and no application `fetch`/Axios/eval path. This was not a complete Git-history secret scan or a penetration test.

`npm audit --omit=dev --json` reports 14 high-severity affected package nodes, no critical nodes, arising from two underlying advisories through Expo/Metro build tooling. They are already explicitly allowlisted in `scripts/auditGate.js`:

- [node-forge signature verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- [braces nested-pattern denial-of-service advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

These counts do not mean 14 independent runtime exploits. Keep the tooling exceptions narrow and review them when upstream patches become available. The audit's proposed Expo/RN downgrades are not a suitable automatic fix.

## Fresh verification

| Check                                                                           | Result                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                             | Failed: TS1149, TS1261 and TS2305 from the Home `MoneyBar` / `moneyBar` collision.                                                                                                                                                                |
| `npm run lint`                                                                  | Failed: one import-casing error at `ThisMonthHero.tsx:25`, no warnings.                                                                                                                                                                           |
| `npm run format:check`                                                          | Passed.                                                                                                                                                                                                                                           |
| `npm test -- --runInBand --silent`                                              | 289 suites passed, 3 failed, 2 skipped; 11,038 tests passed, 40 failed, 2 skipped. Failures are in `screens.smoke.test.tsx`, `ThisMonthHero.test.tsx` and `HomeMotion.test.tsx`, with invalid Home component rendering consistent with finding 1. |
| `npm run test:security`                                                         | All 8 tests passed. These cover URI decoding and widget-provider checks, not a full penetration test.                                                                                                                                             |
| `node scripts/runPerf.cjs`                                                      | Both performance suites and both tests passed. These opt-in tests were skipped by the ordinary test run and exercised separately here.                                                                                                            |
| `npx expo install --check`                                                      | Dependencies are up to date for the installed SDK.                                                                                                                                                                                                |
| `npx expo-doctor`                                                               | All 21 checks passed.                                                                                                                                                                                                                             |
| `npm audit --omit=dev --json`                                                   | Reported 14 high-severity affected package nodes, no critical nodes; details and two underlying advisories above.                                                                                                                                 |
| `node scripts/auditGate.js`                                                     | Passed under the repository's existing allowlist for those two advisories. This does not mean the dependency audit is vulnerability-free.                                                                                                         |
| `npx expo export --platform android --output-dir .expo/audit-2026-10-18/bundle` | Passed: 2,337 modules bundled, Android Hermes bundle and assets exported. This verifies JavaScript export, not native compilation, installation or successful screen rendering.                                                                   |

The lint and formatting results above are clean reruns after temporary audit scripts were moved under the ignored `.expo` evidence directory. Application code was not changed. The full ordinary test run took approximately 19.5 minutes; older validation reports were not substituted for fresh results.

The independent reproduction script uses the real database modules with in-memory `better-sqlite3`; native notifications are replaced by a counter. It verifies seven undesired current behaviors corresponding to findings 2–8. It intentionally asserts their presence, so its exit code 0 means reproduction succeeded, not that these defects are fixed. Local evidence: `.expo/audit-2026-10-18/reproduce.cjs` (run from repository root with `node .expo/audit-2026-10-18/reproduce.cjs`). No user financial database was opened.

## Recommended order

The local reproduction script above asserts pre-fix bug presence. After applying the follow-up fixes, use the tracked regression suites listed in the fix report as validation; that historical script is not a passing gate for corrected code.

Resolve the module naming collision and parent-budget privacy leak first. Then repair currency/link integrity and category deletion/Undo protections. Follow with refund label and notification invalidation changes, adding regression tests for the reproduced journeys. Dead-code removal and module extraction can follow once those behavioral contracts are covered.
