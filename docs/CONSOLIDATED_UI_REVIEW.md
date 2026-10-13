# Consolidated UI refinements

Recorded 13 October 2026 against `19d1c06` plus the refinements below. This records source review and automated validation, not phone visual acceptance. No APK or bundle was built.

## Changes by area

| Area             | Result                                                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home             | Explicit View all accounts action, aligned financial digits, semantic comparison text and narrow-screen loading widths. Spending/category controls remain.                                                                   |
| Plan             | Payment total has a separate context line and stronger hierarchy; selected day details wrap; numeric typography is aligned. Disclosures, jars, forecasts and links remain.                                                   |
| Reports          | Breakdown total/comparison precede filters; Trends summary stacks on narrow phones; labels and totals wrap. Period comparisons and grouping remain.                                                                          |
| Activity         | Note-first single rows with category/account context, Split labels and quieter date headings. Clear all resets type/category/account, including type-only filters. Stable date keys and screen-owned expanded groups remain. |
| Loans            | Payment footer wraps; zero repayment has no forced fill segment; amounts align. Pay, schedules and detail actions remain.                                                                                                    |
| Recurring        | Notes lead, category/account context stays secondary, amount reading is explicit and pause remains a separate control.                                                                                                       |
| Goals            | Saved/target figures precede the track; remaining/percentage are quieter; privacy, completion, following and reservation actions remain.                                                                                     |
| Budgets          | Remaining/over-limit money leads, spent/limit is secondary; pace, daily guidance and jar/meter/actions remain.                                                                                                               |
| People           | Explicit payment direction precedes balance; last activity is secondary. Settlement and actual cash movement retain their existing logic.                                                                                    |
| Profile and Wrap | Long explanation/category labels wrap and financial digits align. Playback, reduced motion, privacy and navigation remain.                                                                                                   |

Existing colours, fonts, calculations and stored-data contracts are preserved. Categories, notification settings, Backup and Garden retain their current controls and behaviour. The automatic unlock redesign is already committed in `19d1c06` and is outside this presentation diff.

## Validation

- Full Jest regression passed: 264 suites and 10,874 tests, exit 0 (412.532 seconds). Two opt-in performance tests were skipped by the normal command and are checked separately.
- Type checking, repository lint and formatting passed.
- Eight URI/native-widget security checks passed.
- Diff whitespace checks passed.
- Earlier targeted checks exercised narrow/large-text layouts, hidden amounts, completed/empty goals, below/over-budget states, grouping, filters and payment actions. Their counts are not added to the full-run count.

- Both opt-in performance suites passed on the existing 20,000-entry fixture, including output parity (23.623 seconds). Desktop database workload measurements: Home 76ms/52 queries, Activity month 11ms/15 queries, Reports month 113ms/51 queries, Plan 10ms/5 queries and backup snapshot 43ms/1 query. These are fixture measurements, not Android frame-rate measurements or a before/after speed claim.

## Phone checks still open

- Review 320dp/narrow layouts, long labels, large amounts and enlarged system text with the actual installed fonts.
- Verify keyboard/docked-pad clearance, native authentication placement and cancellation/retry.
- Verify scrolling, back navigation and edit/delete return position with expanded Activity groups.
- Verify notification delivery, backup folder permission/restore and widgets using the release device checklist.

Renderer/source tests do not measure Android layout geometry, native delivery or frame performance. Earlier dated reports remain historical evidence. No public-release signoff is implied.
