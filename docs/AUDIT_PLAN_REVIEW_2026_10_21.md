# Performance, database, motion and link audit

Recorded 21 October 2026 against `a5622a6` (Android-only Expo SDK 57 app). It adds no behavior change. Measurements are desktop fixture runs on Node 22 with `TZ=Asia/Kolkata`; the runner had no `en_IN` locale. No APK, emulator or phone was used.

## Baseline

`npm run typecheck`, `npm run lint` and `npm run format:check` passed. `npm test` passed 316 suites and 11,329 tests (2 suites and 2 tests skipped). `node scripts/auditGate.js` reported no blocking advisories; `braces` and `node-forge` remain allow-listed build tooling. `expo-doctor`, `expo export --platform android` and `npm run test:security` were not run.

## Query plans

`EXPLAIN QUERY PLAN` was run for all 48 distinct read statements issued by the `loadPerf` fixture (20,000 entries). 36 were flagged for a table scan or temporary B-tree. Every flagged statement was one of:

- a scan or ordering of a small table (accounts, categories, loans, loan payments, budgets, goals, recurring rules, people);
- a `GROUP BY` or `ORDER BY` over a date-ranged slice of `transactions`, which needs a temporary B-tree by definition;
- the free-text label search, which scans `idx_transactions_date` (about 2 ms on the fixture);
- startup counts of fractional amounts over small tables.

No large-table lookup was missing an index, so no index migration is proposed. The existing composite indexes (`account_date`, `category_date`, `account_flow`, `to_account_flow`, `split_id`, repeat-group) already cover the transaction access paths.

## Fixture timings

Home 62ms / 52 queries, Activity month 10ms / 15, Reports month 131ms / 51, Plan 8ms / 5, search 2ms / 1, backup snapshot 39ms / 1. These measure database work only. Frame rate, startup, memory and scrolling on a phone remain unmeasured. Each query waits in the single serialized queue in `db/client.ts`, so round-trip counts matter more on a phone than these desktop times.

## Findings with no change made

- **Lists.** Activity, the only unbounded list, is a virtualized `FlatList` with a small render window. The other routes show tens of rows (accounts, loans, goals, budgets, people, recurring rules), so converting them is not justified without profiler evidence from a phone.
- **Motion.** 16 duration literals, one easing family (cubic out), reduced-motion handling in 39 files. `useNativeDriver: false` is limited to text and size animations (`CountUpAmount`, Wrap, Garden). A shared presets module would not change behavior.
- **Logging.** All 27 non-test `console` calls log static text plus an error object; none logs amounts, names or notes.
- **Links.** Notification taps navigate only to the `NOTIFICATION_ROUTES` allow-list. The widget opens `yume://` routes from that list. The `yume://` scheme is also reachable by other apps and any route can open, but links only navigate or prefill forms, nothing is written without the user's action, and the lock screen replaces the whole tree while locked. A `+native-intent` allow-list would add hardening but could break widget links and needs a device to verify, so it is not applied.
- **Large files.** `add-transaction.tsx` (1,317 lines) is one component whose pure logic is already in `src/features/add`. Splitting its remaining state, locks and refs needs device checks of keyboard, sheet and lock behavior.

## Change

CI now runs `npm run test:perf` after the main tests as a report-only step (`continue-on-error`), so fixture timings and the output-parity check are visible per run without failing the build on shared-runner noise.

## Open

Phone profiling (React Profiler, frame timing, startup, memory), signed-build smoke tests and the deep-link allow-list decision remain open.
