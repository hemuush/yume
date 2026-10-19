# Re-audit fixes — 19 October 2026

Follow-up to the [seven-finding code re-audit](CODE_REAUDIT_2026_10_19.md), on revision `6109b40232266423db459fcd361e1e4d71f57c28` plus the existing fix working tree. Those earlier changes were preserved. Repository instructions, current guides and the exact Expo SDK 57 documentation were consulted before implementation. Historical audit/test results remain in their original reports.

## Resolution checklist

All seven findings are implemented. The fresh full regression below passes with 38 added test cases; device acceptance remains separate.

| Finding | Implemented behavior | Regression evidence |
| --- | --- | --- |
| 1. P1 — Queued spending-alert privacy | New budget/spike alerts retain structured provenance. The scheduler resolves current financial copy and category-family privacy before planning; private, obsolete or unresolvable alerts are removed. Legacy copy is discarded when hiding. Queue reconciliation preserves concurrent additions/replacements. | Real SQLite and the actual planner/scheduler with a simulated native adapter verify hide, live amount/name refresh, sensitive-family changes, spending spikes, legacy copy, scheduler failure and concurrent queue additions. |
| 2. P1 — Archived sensitive recurring categories | Recurring and Plan fetch historical category metadata. The shared privacy predicate treats missing required metadata as private. Active-only picker choices remain separate; existing rules can retain an archived category. | Actual Home, Plan and Recurring routes render a rule under an archived sensitive parent without exposing its amount in visible or spoken output, while a public rule remains visible. Predicate coverage also checks incomplete lookups. |
| 3. P2 — Mixed recurring currencies | A shared helper scopes Home Upcoming, Plan due-soon/runway inputs and Recurring totals/shares/timeline to the default currency. Recurring's individual rows retain their account currency; a caption explains the summary scope when other currencies are present. | Actual route tests verify ₹100 + $100 produces a ₹100 summary/upcoming forecast, while Recurring still shows the $100 rule. Pure scope/total coverage checks both default currencies and unknown/mismatched transfer accounts. |
| 4. P2 — Lost recurrence anchor | Plan carries `anchorDay` into `PlanRuleInput` and uses it with the shared recurrence calculation. | Month-end cases cover 29th–31st anchors, leap February and two-month intervals. A real posting-engine rule passed through the actual Plan route no longer predicts a March-28 shortfall for a March-31 bill. |
| 5. P2 — Obsolete notifications after mutations | Account archive refreshes after pausing rules. Person receipts, transaction-backed deletion/restore and Undo refresh logging state after commit. Category archive/restore also refresh bill eligibility. Balance-only adjustments do not rebuild. | Integration checks inspect paused-rule schedule removal, category eligibility, today's logging nudge across receipt/delete/restore/Undo, one rebuild on the initial writes, rejected writes, balance-only adjustments and committed data surviving scheduler failures. |
| 6. P2 — Cross-currency subscription patterns | Detection and rule suppression group by category/currency. Suggestions and Needs you carry currency into visible and spoken amounts. New dismissals identify a denomination; legacy category-wide hidden keys remain honored and reversible. | SQLite rejects a false three-month INR/USD pattern, accepts three actual USD months, preserves a USD suggestion despite an INR rule, and separates unscheduled rows/dismissals. Renderer coverage verifies foreign symbols in suggestions and Needs you. |
| 7. P2 — Name collisions on category restoration | Reactivation validates the category and any restored parent inside its transaction. Undo validates all restored category names before commit, rolling budgets back too on conflict. Creation validates/inserts atomically. Errors identify the active name to rename before retry. | SQLite covers case-insensitive roots, siblings, implicit parents, family/budget Undo rollback and successful retry, plus allowed identical names in different kinds/parents. |

Category archive continues to mean “hide from pickers and retain history”; attached recurring entries keep running. Its confirmation now states this and points to Recurring for pausing. Archiving an account continues to pause its rules; unarchiving that account leaves those rules paused. No histories are merged or deleted to resolve name conflicts.

No database schema migration or dependency changes are required. Alert provenance and currency-specific suggestion keys use existing settings JSON. Discarded private/legacy spending alerts are not resurrected by revealing amounts; future qualifying spending can generate new alerts according to the existing nudge policy.

## Fresh validation

| Check | Result |
| --- | --- |
| Focused regression checks | Initial focused run: 118 passed; two new fixture assertions needed correction (merged short copy and an explicitly enabled evening slot). Corrected database/scheduler integration plus actual screen suite: 150 passed. Final full regression below is the acceptance result. |
| Full Jest regression (`npm test -- --runInBand --silent`) | Passed: 295 suites / 11,142 tests, zero failures; 2 opt-in performance suites/tests skipped here. 385.747 seconds, exit 0. This includes 38 added regression cases. |
| TypeScript | Final `npm run typecheck` passed, exit 0. |
| ESLint / formatting | Both passed, exit 0; ESLint reported no errors or warnings. |
| Security scripts | All 8 passed. |
| Dependency gate | Passed with the two existing tooling advisory exceptions for `braces` and `node-forge`. This is not a vulnerability-free dependency tree. |
| Performance / output parity | Both suites/tests passed. Desktop fixtures: Home 93 ms, Reports 127 ms, Budgets 3 ms; not phone latency. A comparison against the pre-fix audit fixture found 277/279 result groups unchanged; only `monthlyPatterns` and `unscheduledSubscriptions` changed as intended for currency identity. |
| Expo dependency compatibility / Doctor | Dependencies up to date; Doctor passed all 21 checks. |
| Android JavaScript export | Passed: 2,341 modules, 8.1 MB Hermes bundle, exit 0. Output in `.expo/reaudit-2026-10-19/fix-bundle`. |
| Whitespace checks | `git diff --check` passed after the report and guide updates. |

Fresh local logs use the `fix-` prefix under `.expo/reaudit-2026-10-19/`; the earlier unprefixed files belong to the audit baseline. The original reproduction script asserts the presence of defects and is not a fixed-behavior acceptance test. The permanent regressions added to `src` assert corrected behavior instead.

Final acceptance logs: `fix-jest-full.log`, `fix-quality.log`, `fix-security.log`, `fix-audit.log`, `fix-expo.log`, `fix-perf.log`, `fix-parity-comparison.log` and `fix-export.log`. The parity comparison uses preserved before/after fixtures in that same directory. No application changes followed the full regression run; the remaining edits recorded validation in documentation.

All SQLite scenarios use in-memory databases. No user financial database was opened or modified. Native notification behavior is simulated at the Expo scheduling boundary; real device delivery, launcher behavior, authentication, TalkBack, large-text reflow and physical appearance still require phone acceptance. A JavaScript export is not a signed Android build or release.
