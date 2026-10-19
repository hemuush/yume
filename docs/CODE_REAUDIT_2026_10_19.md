# Code re-audit — 19 October 2026

Fresh review of revision `6109b40232266423db459fcd361e1e4d71f57c28` plus the existing, uncommitted audit fixes. This is an audit report, not another application-fix batch. The repository instructions, documentation index, architecture guide and exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) were consulted.

**Subsequent implementation:** see [19 October re-audit fixes](REAUDIT_FIXES_2026_10_19.md) for the follow-up changes and their validation. The findings and results below preserve the earlier audit baseline.

Seven actionable findings remain: **two P1 privacy defects and five P2 correctness/UX defects**. Eight undesired behaviors were reproduced with actual database and domain code. The full existing regression suite passes; that does not cover the newly identified cases.

## Findings and proposed fix order

### 1. P1 — A successful privacy refresh still schedules private spending-alert text

Sources: [spendAlerts.ts:91](D:/hemuush/yume/src/db/spendAlerts.ts:91), [notifications.ts:141](D:/hemuush/yume/src/lib/notifications.ts:141), [notificationPlan.ts:224](D:/hemuush/yume/src/lib/notificationPlan.ts:224).

Budget/spending alerts capture their category name and formatted financial information when queued. The privacy check runs at creation time. A later scheduler rebuild reads that saved text and passes it straight into the notification plan; it does not revalidate it against the current privacy preference or category sensitivity.

**Reproduction:** with privacy off, record ₹120 against a ₹100 budget in a sensitive category named “Private medical.” Turn privacy on before the morning slot. `setHideSensitiveAmounts(true)` returns `true`, but the replacement scheduled payload still says “Private medical is over budget” and “₹120 spent against your ₹100 monthly budget.” The queue retains the same copy.

**Impact:** the saved privacy preference and successful refresh feedback do not protect existing budget alerts. Sensitivity changes can leave equivalent stale copy. This reopens part of finding 7 from the previous audit: its bill/refund refresh fixes work, but they did not cover the spending-alert queue. The Android channel uses `PRIVATE` visibility; this evidence concerns the scheduled payload, not a demonstrated locked-screen bypass or actual phone delivery.

**Fix:** retain enough provenance to resolve an alert's category/budget family, then regenerate or suppress queued content using current privacy rules on every rebuild. Handle legacy alerts that lack that provenance conservatively. Add integration cases for privacy toggles and category-family sensitivity edits while budget/spike alerts are waiting.

### 2. P1 — Archiving a sensitive category reveals its recurring amounts

Sources: [categories.ts:167](D:/hemuush/yume/src/db/categories.ts:167), [recurring.tsx:70](D:/hemuush/yume/app/recurring.tsx:70), [plan.tsx:181](D:/hemuush/yume/app/(tabs)/plan.tsx:181), [privateSummary.ts:54](D:/hemuush/yume/src/lib/privateSummary.ts:54).

Category archive retains the associated recurring rule. Recurring and Plan fetch only active categories, then use that incomplete lookup to decide whether a rule is private. `isSavingsEntry` returns false when the category is absent. As a result, archiving removes the sensitivity metadata without removing the amount from the displayed rows, summaries or Plan calculations.

**Reproduction:** create a sensitive custom expense category and an active rule for 45,000 minor units. Enable privacy, verify the rule is classified as hidden, then archive the category. The rule remains active; the exact same classification against the screens' active-only category list changes from `true` to `false`. Recurring's row passes that result to its visible and spoken amount formatter; Plan includes the rule in `visibleRules`.

**Fix:** use complete historical category metadata for privacy decisions, independently of picker eligibility. Explicitly define what archiving means for attached recurring rules. Add screen/integration regressions for archived sensitive categories and archived sensitive parents. Missing required privacy metadata should not silently classify an entry as public.

### 3. P2 — Recurring summaries and upcoming rows combine or relabel different currencies

Sources: [recurring.tsx:95](D:/hemuush/yume/app/recurring.tsx:95), [subscriptions.ts:35](D:/hemuush/yume/src/db/subscriptions.ts:35), [RecurringHero.tsx:155](D:/hemuush/yume/src/features/recurring/RecurringHero.tsx:155), [plan.tsx:215](D:/hemuush/yume/app/(tabs)/plan.tsx:215), [UpcomingRow.tsx:54](D:/hemuush/yume/src/features/home/UpcomingRow.tsx:54).

Recurring's headline totals sum every active expense rule without account-currency scope. Plan's Coming up/due-soon inputs likewise include all visible currencies and discard currency before display. Home's recurring Upcoming inputs also carry no currency through the shared row model. The amounts are subsequently formatted as the default currency. Individual Recurring rule rows do use their account currency, so the page can contradict its own headline. Plan's runway scopes accounts separately and can disagree with its due-soon total.

**Reproduction:** one monthly INR rule for ₹100 and one monthly USD rule for $100 produce a monthly total of 20,000 minor units and a yearly total of 240,000. With INR as the default, the headline presents ₹200 per month. Plan's due-soon calculation also returns 20,000 minor units. No exchange rate or conversion is involved.

**Fix:** consistently scope default-currency summaries, or group totals by currency and retain explicit currency in every upcoming row. Cover Home, Plan, Recurring totals, shares and accessibility copy with mixed-currency fixtures. Keep conversion out unless an explicit conversion feature is designed.

### 4. P2 — Plan loses the recurrence anchor and can predict a false shortfall

Sources: [plan.tsx:201](D:/hemuush/yume/app/(tabs)/plan.tsx:201), [planOverview.ts:118](D:/hemuush/yume/src/features/plan/planOverview.ts:118), [planOverview.ts:175](D:/hemuush/yume/src/features/plan/planOverview.ts:175).

The posting engine preserves a rule's original `anchorDay`, but the Plan input omits it. `buildDueItems` substitutes the day of `nextRunDate`. After a day-31 rule reaches February's clamped date, Plan predicts subsequent occurrences on the 28th rather than returning to the 31st. Those predicted occurrences feed its runway calculation as well as Coming up.

**Reproduction:** a monthly January-31 rule retains `anchorDay = 31` and has a February-28 next run. Plan's February-28 through March-29 window produces February 28 and March 28. For a 15,000-minor starting balance and 10,000-minor bill, it forecasts a 5,000-minor shortfall on March 28. The actual posting engine records only February 28 in that window and retains March 31 as the next occurrence.

**Fix:** carry the stored anchor through `PlanRuleInput` and use it with the shared recurrence calculation. Test leap/non-leap February, 29th–31st anchors, interval counts and the resulting runway dates.

### 5. P2 — Some committed mutations leave obsolete notifications scheduled

Sources: [accounts.ts:363](D:/hemuush/yume/src/db/accounts.ts:363), [people.ts:185](D:/hemuush/yume/src/db/people.ts:185), [YouSection.tsx:317](D:/hemuush/yume/src/features/profile/YouSection.tsx:317), [PersonDetailModal.tsx:182](D:/hemuush/yume/src/features/people/PersonDetailModal.tsx:182).

Notification invalidation is inconsistent across database writers. Account archive pauses its recurring rules but does not rebuild the schedule. Receiving money from a person creates a transaction but does not refresh the conditional logging reminder. The corresponding UI callbacks reload data, not notifications. These are two independently reproduced triggers of the same missing after-commit effect.

**Reproduction A:** schedule tomorrow's bill, then archive its account. The rule becomes inactive, but rebuild count remains zero and its bill payload remains in the simulated native schedule.

**Reproduction B:** schedule today's evening logging nudge, then record money received from a person today. `hasLoggedOn(today)` becomes `true`, but rebuild count remains zero and “Add today’s spending while it’s fresh in mind” remains scheduled.

**Fix:** apply the appropriate shared after-commit scheduler effect to all mutations that change bill eligibility or logging state, including their delete/Undo counterparts. Preserve a committed database write if scheduling fails, and avoid duplicate refreshes. Integration tests should inspect schedule replacement through the actual writer and UI callback chain.

### 6. P2 — Subscription pattern detection treats different currencies as one charge

Sources: [subscriptions.ts:149](D:/hemuush/yume/src/db/subscriptions.ts:149), [subscriptions.ts:174](D:/hemuush/yume/src/db/subscriptions.ts:174), [SuggestionsList.tsx:42](D:/hemuush/yume/src/features/recurring/SuggestionsList.tsx:42).

Monthly pattern detection groups transaction history only by category and compares raw minor units and day-of-month. It does not load or compare account currency. Suggestions also omit currency and use the default formatter. This is separate from finding 3's summary arithmetic: the detector can fabricate continuity between unrelated denominations before any rule exists.

**Reproduction:** record ₹100 on August 10, $100 on September 10 and $100 on October 10 under one custom category. The query returns a “3 months in a row” pattern, carrying the latest USD account and amount 10,000. The suggestion formatter presents that as ₹100 when INR is default.

**Fix:** include currency in detection/grouping and suggestion identity/display, or explicitly limit the feature to the default currency. Verify that differently denominated transactions cannot complete each other's monthly pattern. Check the unscheduled-subscriptions branch's currency display too.

### 7. P2 — Unarchiving bypasses active category-name uniqueness

Sources: [categories.ts:102](D:/hemuush/yume/src/db/categories.ts:102), [categories.ts:200](D:/hemuush/yume/src/db/categories.ts:200).

Create/edit reject duplicate active names for the same kind and parent, but unarchive activates rows without that validation. An automatically reactivated parent also bypasses it. Category Undo uses raw snapshot restoration and warrants the same invariant check.

**Reproduction:** create “Travel,” archive it, create another active “Travel,” then unarchive the original. Both top-level expense categories are now active under the same name. This is a normal management flow, with no direct SQL needed. Pickers/reports become ambiguous and subsequent ordinary edits can hit a uniqueness error.

**Fix:** validate every row/parent being reactivated inside the same transaction. On conflict, retain the archived state and provide a clear rename/resolve path. Add root, child and parent-reactivation tests; review Undo for equivalent collisions without silently merging categories or histories.

## Coverage, design and structure

The review traced startup/privacy gating, notification planning and native-adapter boundaries; account/category/transaction/refund writers and Undo; recurring execution and suggestion detection; backup validation/restore boundaries; and money/privacy propagation into Home, Activity, Reports, Plan and Recurring. Source review covered shared amount formatting, spoken labels and archived metadata. It is not a claim that every possible input, screen state or native behavior was exercised.

The fresh import-graph inventory contains 423 non-test JS/TS files across `app`, `src` and `index.js` (including support files). Its only non-route-reachable candidates outside `test-support` were the performance seed and type index. The seed is used by both opt-in performance suites; the simple graph's resolution/type limitations explain the type-index candidate. Neither is evidence of removable application code. The two previously deleted unused components and the old Home module collision have no remaining active references. No further dead-code deletion is justified by this scan alone.

Large modules remain extraction opportunities: reports database logic is 1,136 lines, Add transaction 1,046, Activity 1,019 and settings 928. Size alone is not a defect. Prefer cohesive extraction around actual ownership changes, especially money scope/privacy and after-commit effects, with existing query/output parity coverage. The newly found errors show that those policies currently diverge between consumers.

For UI/UX, money identity, privacy and schedule accuracy are the actionable defects above. The previously recorded 1.3 text-scale ceiling remains an accessibility improvement item, not a newly discovered regression. Phone appearance, large-text reflow, touch/keyboard/back behavior, TalkBack and real authentication/notification behavior were not exercised in this desktop audit. Renderer tests and a JavaScript export cannot establish those acceptance results.

## Previous eight-finding fix list

The existing full regression and source review continue to support fixes 1–6 and 8: Home module naming; parent-budget privacy; annual-bill currency validation; category-budget Undo; system-category protections; tracked-refund labels; and backdated-refund reminder refresh. Finding 7 is **partially resolved and reopened**: bill/refund scheduling and failure feedback are covered, while spending-alert copy still bypasses current privacy validation (finding 1 above). Finding 7 here concerns name collisions on reactivation, not loss of budget snapshots from the earlier Undo defect.

A suspected split/refund data-loss path was rejected: SQLite's refund foreign key blocks split deletion and rolls back the operation, preserving both parts and tracking data. Archived annual-goal reservation behavior is intentionally supported and was not reported as a defect.

## Fresh validation

Results below were run again for this audit, independently of historical report results.

| Check | Result |
| --- | --- |
| Full regression: `npm test -- --runInBand --silent` | Passed: 293 suites, 11,104 tests; 2 opt-in performance suites/tests skipped here. 409.654 seconds, exit 0. |
| Focused audit reproductions | Eight undesired behaviors confirmed using real database/domain modules. One suspected data-loss case rejected by the actual foreign-key guard. Exit 0 means the script successfully demonstrated those states; it is not a fix-verification result. |
| TypeScript / ESLint / formatting | All passed, exit 0; ESLint reported no errors or warnings. |
| Security: `npm run test:security` | All 8 checks passed, including URI decoder compatibility and widget-provider generation/access guards. |
| Performance/output parity: `npm run test:perf` | Both suites/tests passed. Desktop fixtures: Home 92 ms, Reports 121 ms, Budgets 2 ms; not phone latency measurements. |
| Expo compatibility: `npx expo install --check` | Dependencies up to date. |
| Expo Doctor: `npx expo-doctor` | 21/21 checks passed. |
| Dependency gate: `node scripts/auditGate.js` | Passed under the existing `braces` and `node-forge` tooling-advisory allowances. |
| Raw `npm audit --json` | Exit 1: 50 affected dependency entries (45 high, 5 moderate, 0 critical). These include dependency-chain entries, not 50 distinct root advisories. The gate permits the two existing high-severity root advisories; its success does not mean zero vulnerabilities. |
| Android JavaScript export | Passed: 2,339 modules, 8.1 MB Hermes bundle, exit 0. |
| `git diff --check` | Passed after adding the report and documentation links. |

Local evidence is under `.expo/reaudit-2026-10-19/`: `jest.log`, `reproduce.cjs`, `reproduce.log`, `quality.log`, `security.log`, `perf.log`, `expo.log`, `audit.log`, `npm-audit.json`, `source-graph.log` and `export.log`. That directory is ignored and is not a committed regression suite. The reproduction script uses in-memory SQLite and a simulated native notification adapter with actual application planning/scheduling logic; it never opened the user's financial database or scheduled notifications on a phone.

No application source was changed during this re-audit. The pre-existing fix working tree was preserved. No signed native build, device acceptance or release is implied.
