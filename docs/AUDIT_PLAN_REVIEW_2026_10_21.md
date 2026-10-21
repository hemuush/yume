# Performance, database, motion and link audit

Recorded 21 October 2026 against `a5622a6` (Android-only Expo SDK 57 app). It adds no behavior change. Measurements are desktop fixture runs on Node 22 with `TZ=Asia/Kolkata`; the runner had no `en_IN` locale. No APK, emulator or phone was used.

## Baseline

`npm run typecheck`, `npm run lint` and `npm run format:check` passed. `npm test` passed 316 suites and 11,329 tests (2 suites and 2 tests skipped). `node scripts/auditGate.js` reported no blocking advisories; `braces` and `node-forge` remain allow-listed build tooling. `npm run test:security` passed (8 tests). `npx expo export --platform android` succeeded with an 8.2MB Hermes bundle (12MB exported). `npx expo-doctor` passed 19 of 21 checks; the two failures (config schema, React Native Directory metadata) need Expo's servers, which the sandbox could not reach, so they were not evaluated.

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

## Second pass

- **Injection and untrusted input.** Interpolated SQL fragments are constant table lists, `?` placeholder strings or SQL built in code. Backup restore takes column names from `PRAGMA table_info`, drops unknown keys, and validates rows, dates and `_minor` amounts before deleting anything. Recently-deleted restore checks the table and every column name. Excel export writes user text as plain strings; only code-built totals are formulas, so there is no spreadsheet formula injection.
- **Timers and listeners.** Every ref-based timer checked (Undo toast, amount field, milestone note, Wrap hold, pay sheet, timeline settle, Add save-and-close, Activity retry, draft recovery) is cleared on unmount.
- **Secrets.** No keystore, key or env file is tracked, and no secret-like string was found in source.
- **Generated manifest** (`expo prebuild` in a scratch copy, release profile): blocked storage, overlay and image permissions and `INTERNET` are `tools:node="remove"`; widget receivers are `exported="false"`; the only exported provider is the caller-checked widget image provider; `MainActivity` handles the `yume` scheme. Library-merged permissions (notifications, alarms) were not inspected because no Gradle build ran.
- **Advisories.** `npm audit` reports 14 high findings, all via `braces` or `node-forge` in build tooling and covered by the gate's reasoned allow-list.
- **Dependencies.** Superseded: the app moved to Expo SDK 58 later the same day; see the [SDK 58 upgrade](SDK_58_UPGRADE_2026_10_21.md).
- **Bundle.** `MaterialCommunityIcons` (a 1.3MB font plus a 217KB glyph map imported by the widget code) is used in 21 files, so it stays.

## Needs a decision or a phone (circular imports) and a recorded decision (theme)

- **Circular imports.** `madge` finds 13 cycles, all in the db/lib layer: `settings` ↔ `afterCommit` ↔ `notifications` ↔ `notificationData`/`queuedSpendAlerts`/`reports`, and `client` ↔ `recentlyDeleted`/`refundLabels`. They work today (tests, export and fixture pass) because the cross-calls happen inside functions, but they make load order fragile. Breaking them means inverting the after-commit refresh hook; not attempted without a device.
- **Light-only theme on Android.** Decided 21 October: the app stays light-only and no dark theme or `expo-system-ui` dependency is added. `app.json` sets `userInterfaceStyle: "light"`, which prebuild says needs `expo-system-ui` to take effect on Android, so on a phone in dark mode some native pieces (system dialogs, keyboard, date pickers) may still follow the system. Not verified on a device; revisit only if that shows up.

## Open

The circular-import cycles described above are unchanged by the SDK 58 upgrade.

Phone profiling (React Profiler, frame timing, startup, memory), signed-build smoke tests and the deep-link allow-list decision remain open.
