# Yume — Cleanup, Restructure & Test-Coverage Report

_Generated at the end of the multi-step cleanup pass. Every number below was produced by
running the commands in the [Verification](#7-verification) section against the working
tree._

---

## 1. Final status — all green

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` (`tsc --noEmit`) | ✅ **0 errors** |
| Lint | `npm run lint` (`eslint .`) | ✅ **0 problems** (0 errors, 0 warnings) |
| Formatting | `npm run format:check` (`prettier --check .`) | ✅ clean |
| Tests | `npm test` (`jest`) | ✅ **25 suites, 7 668 tests, 0 failures** |
| Module resolution | `tsc` + `jest` | ✅ every `@/…` / `@/features/…` import resolves — `tsc` checks all paths, `jest` actually imports and runs every module via `moduleNameMapper` |

> **`expo export --platform web` is not a valid check for this repo** and was not used as
> one. It fails — before and after this work — inside vendored `node_modules/expo-sqlite/web/worker.ts`
> trying to resolve `./wa-sqlite/wa-sqlite.wasm`, because there is no `metro.config.js`
> wiring up `.wasm` assets and web is not a target of this mobile app (`orientation:
> portrait`, new architecture, SQLite storage). Metro did bundle all **1 106** app modules
> — including every `src/features/*` file — before reaching that vendored file, which
> confirms the alias codemod at the bundler level too.

Baseline before this work: `tsc` clean, **19 suites / 3 188 tests**, 48 ESLint warnings, no
lint/format tooling.

### Core-logic guarantee

Nothing in `src/db/**` or the pure-logic parts of `src/lib/**` changed behaviour. The
EMI/amortization engine, date math, reports SQL, ledger writes and backup serialization
compute and write exactly what they did before — proven by the full pre-existing test
suite staying green, plus **4 480 new combinatorial tests** hammering the same functions.

Two **new pure helpers** were added (not behaviour changes to existing code):

- `computeTrackedBalance(...)` in [`src/db/reports.ts`](src/db/reports.ts) — the shared
  "Tracked Balance" formula. Home previously used a hand-rolled version that ignored a
  loan's tracked asset value and could therefore show a **different headline number than
  Profile for the same data**; both screens now call this one function.
- `daysUntilIsoDate(...)` in [`src/lib/date.ts`](src/lib/date.ts) — replaced two identical
  copies of the same countdown math in `index.tsx` and `notifications.tsx`.

---

## 2. New files created (53)

### Tooling / config (5)

| File | Purpose |
|---|---|
| `eslint.config.js` | ESLint 9 flat config: `eslint-config-expo` + `eslint-plugin-prettier`, with documented rule calibration (see §5) |
| `.prettierrc.json` | single quotes, 110 print width, 2-space, es5 trailing commas |
| `.prettierignore` | excludes `dist/`, `.expo/`, `package-lock.json`, `scripts/fixtures/`, `*.md` |
| `jest.setup.ts` | automocks `expo-notifications` so its import-time push-token listener doesn't leak a handle in the Node test env |
| `.github/workflows/ci.yml` | on push/PR → `npm ci` → typecheck → lint → format:check → test (Node 20) |

### Tests relocated out of `scripts/` (12)

`scripts/` now contains **only real scripts** (`make_icons.py`, `generateRealDataBackup.js`)
plus `scripts/fixtures/`. Every Jest spec is co-located.

| New path | Was |
|---|---|
| `src/db/calculation.scenarios.test.ts` | `scripts/calculationScenarios.test.ts` |
| `src/db/networth.scenarios.test.ts` | `scripts/networth.scenarios.test.ts` |
| `src/db/reports.scenarios.test.ts` | `scripts/reports.scenarios.test.ts` |
| `src/db/reportsLiveQueries.test.ts` | `scripts/reportsLiveQueries.test.ts` |
| `src/db/transactionSafety.test.ts` | `scripts/transactionSafety.test.ts` |
| `src/db/transactionEditLink.scenarios.test.ts` | `scripts/transactionEditLink.scenarios.test.ts` |
| `src/db/subcategories.test.ts` | `scripts/subcategories.test.ts` |
| `src/db/recurring.integration.test.ts` | `scripts/recurring.test.ts` |
| `src/__tests__/screenConsistency.test.ts` | `scripts/screenConsistency.test.ts` |
| `src/__tests__/realData.test.ts` | `scripts/realData.test.ts` |
| `src/__tests__/validateRealDataBackup.test.ts` | `scripts/validateRealDataBackup.test.ts` |
| `src/test-support/realDataTestDb.ts` | `scripts/realDataTestDb.ts` (the better-sqlite3 harness) |

Plus the fixture: `scripts/fixtures/yume-real-data-import.json` (was at the repo root).

### New combinatorial test files (6 — see §4 for what they cover)

| File | Tests | Subject |
|---|---:|---|
| `src/lib/date.matrix.test.ts` | 1 507 | every local-calendar date helper |
| `src/lib/loan.matrix.test.ts` | 1 576 | EMI / amortization / prepayment engine |
| `src/lib/period.matrix.test.ts` | 645 | browsable-period cursor |
| `src/db/reports.trackedBalance.matrix.test.ts` | 530 | `loanNetWorthContribution` + `computeTrackedBalance` |
| `src/lib/money.matrix.test.ts` | 167 | `toMinor`/`toMajor`/`formatMoney`/`getCurrencySymbol` |
| `src/lib/format.matrix.test.ts` | 49 | `formatPctChange` cap |

### Per-screen feature modules (29)

Each large `app/` route file is now a thin orchestrator; its modals, list rows, styles,
constants and helpers live under `src/features/<screen>/`.

```
src/features/loans/           loans.styles.ts, LoanCard.tsx, LoanDetailModal.tsx,
                              AddLoanModal.tsx, AssetModal.tsx, AccountModal.tsx,
                              RateChangeModal.tsx, PrepayModal.tsx            (8)
src/features/transactions/    transactions.styles.ts, transactions.constants.ts,
                              MonthPickerModal.tsx, FilterModal.tsx, TransactionRow.tsx,
                              TransactionDetailModal.tsx, AddTransactionModal.tsx (7)
src/features/profile/         profile.styles.ts, profile.constants.ts,
                              AddAccountModal.tsx, AccountDetailModal.tsx     (4)
src/features/categories/      categories.styles.ts, CategorySection.tsx,
                              AddCategoryModal.tsx                            (3)
src/features/recurring/       recurring.styles.ts, recurring.helpers.ts,
                              RuleCard.tsx, RuleModal.tsx                     (4)
src/features/reports/         reports.styles.ts, SavingsRing.tsx             (2)
src/features/add-historical/  addHistorical.styles.ts                        (1)
```

(`src/features/Onboarding.tsx` and `src/features/PeopleSection.tsx` already existed and
are unchanged in structure.)

### Files removed / relocated

- Deleted: stray root screenshot `ChatGPT Image Sep 5, 2026, 12_28_15 PM.png`, empty dir
  `src/components/illustrations/`, dead `SCHEMA_VERSION` constant.
- Already-staged deletions kept: `App.tsx`, `index.ts`, `assets/android-icon-monochrome.png`,
  `src/components/CapsuleBarChart.tsx`, `src/components/QuadStatGrid.tsx` (all verified
  unreferenced).

---

## 3. Structural changes

### 3.1 Path alias `@/*` → `src/*`

`tsconfig.json` gained `baseUrl`, `paths` and an explicit `include`; `jest.config.js`
gained the matching `moduleNameMapper`. **63 files** were codemodded from
`../../src/x` / `../src/x` chains to `@/x`. Expo SDK 57's Metro resolves `tsconfig` paths
natively (no babel/metro plugin needed); `tsc` and `jest` both resolve every alias, and
Metro bundled all 1 106 app modules with the new imports.

### 3.2 Screen decomposition

| Route file | Before | After | Δ |
|---|---:|---:|---:|
| `app/(tabs)/loans.tsx` | 2 020 | **169** | −92 % |
| `app/(tabs)/transactions.tsx` | 1 247 | **397** | −68 % |
| `app/profile.tsx` | 781 | **302** | −61 % |
| `app/(tabs)/reports.tsx` | 584 | **439** | −25 % |
| `app/recurring.tsx` | 667 | **152** | −77 % |
| `app/categories.tsx` | 607 | **209** | −66 % |
| `app/add-historical.tsx` | 730 | **631** | styles only |
| `app/(tabs)/index.tsx` | 545 | 517 | dead code trimmed |
| `app/settings.tsx` | 376 | 376 | left as-is (already small) |

Sub-components were moved **verbatim** — only their imports changed and a shared
`<screen>.styles.ts` replaced the inline `StyleSheet`. Module-level functions can only
reference module-level things, so the extraction cannot capture stale screen state.

### 3.3 De-duplication

- `computeTrackedBalance` — Home + Profile + `screenConsistency.test.ts` now share one
  formula (was three copies; two had already drifted apart on asset-value handling).
- `daysUntilIsoDate` — was duplicated in `index.tsx` and `notifications.tsx`.
- Dead code removed from `index.tsx`: the `trend` state, its `getIncomeExpenseTrend`
  fetch, and `shortComparisonLabel` (all computed, none rendered).
- `src/lib/autoBackup.ts` — dropped the `getLastBackupAt`/`setLastBackupAt` re-export
  aliases; callers import the real `getLastDriveBackupAt`/`setLastDriveBackupAt`.
- `app/_layout.tsx` — registered the `recurring` screen in the root `<Stack>` (its route
  was pushed but not declared).

### 3.4 Docs

`README.md`, `DATA_MODEL.md` and `BACKUP.md` were updated to match the current schema
(v6, `loan_id` on transactions, `loan_rate_changes`, floating-rate loans, asset equity,
`is_sensitive`, recurring rules, migrations) and the current navigation / project layout.

---

## 4. Test coverage — what the 7 668 tests exercise

### 4.1 New combinatorial coverage (4 480 cases)

**`date.matrix.test.ts` (1 507)** — every pure local-calendar helper, across a 6-year span
that includes two leap years:

- `toLocalIsoDate` — first/mid/last day of every month of 2024/2026/2028, plus
  time-of-day invariance.
- `parseLocalIsoDate ∘ toLocalIsoDate` round-trips to the identical Y/M/D.
- `addMonthsToIsoDate` — every start month × day {1, 28} × step
  {0,1,2,6,11,12,13,24,60,240}, checked against native local `Date` math; additive
  composition (`+a then +b == +(a+b)`); no-op at 0 for all 31 days of January.
- `addDaysToIsoDate` — months {1,2,6,12} × day {1,28} × step
  {0,1,7,14,31,90,365,366,−1,−7,−31,−365}; `+N then −N` round-trip.
- `monthsBetweenIsoDates` — every month, later-by {0,1,6,12,13,24}, both exact and
  "minus one day → floors down"; never negative when `to` precedes `from`.
- `partsToIsoDate` — **every** `YYYY-MM-DD` for 2024–2025 with day 1‥31 (real dates
  accepted, impossible ones like Feb 30 rejected); out-of-range month/year and
  non-numeric input rejected.
- `daysUntilIsoDate` — every offset −30‥+30 from local midnight today.

**`loan.matrix.test.ts` (1 576)** — the EMI / amortization engine:

- **Full matrix**: 10 principals (₹10 … ₹5 cr) × 12 rates (0 %–30 % p.a.) × 12 tenures
  (1–240 mo) = 1 440 schedules, each asserting: length ≤ tenure and sequentially
  numbered; last installment lands on exactly `0`; outstanding never negative and
  non-increasing every month; principal components sum back to the exact principal;
  interest never negative (exactly `0` for a 0 % loan, whose EMI is a plain even split);
  every non-final EMI equals the standalone `calculateEmi`; `emi == principal + interest`
  for every row; due dates step one calendar month from the start date.
- `monthlyRateFromAnnualBp` — `0 → 0`, strictly increasing in bp, equals `bp/10000/12`.
- **Monotonicity**: EMI strictly increases with principal, is non-decreasing in rate, and
  non-increasing in tenure — across every combination of the other two inputs.
- `recalculateAfterPrepayment` — 81 prepayment scenarios (principal × rate × tenure ×
  prepay-fraction): the tail re-amortizes to `0`, never runs longer than the untouched
  remainder, principal sums to the reduced outstanding, and no EMI exceeds the original;
  plus the "EMI can't cover interest → returns an empty schedule" guard across 9
  principal × rate combinations.

**`period.matrix.test.ts` (645)** — the browsable-period cursor, across 10 reference dates
(month-end days, leap-Feb, both year boundaries) × offsets to −36:

- `periodRange` (month) — start on the 1st, end on that month's real last day, same
  month/year, `start ≤ end`, anchored `offset` months before the reference.
- `periodRange` (year) — exact `YYYY-01-01`‥`YYYY-12-31`.
- `previousPeriodRange` — ends the day before the current range starts (contiguous, no
  gap/overlap) and equals `periodRange` at `offset − 1`.
- `canStepForward` / `stepPeriod` — forward is clamped at the current period, back always
  decrements, and _N_ steps back then _N_ forward returns to `CURRENT_PERIOD`.
- `setGranularity` — switching axes resets to the current period; same axis is a no-op.
- `periodLabel` — always a non-empty string.

**`reports.trackedBalance.matrix.test.ts` (530)**:

- `loanNetWorthContribution` — 6 principals × 7 paid-fractions (incl. over-paid) ×
  {no asset, 6 asset-value fractions}: a lent loan adds its outstanding (asset value
  ignored); a borrowed loan subtracts its outstanding, or nets to `assetValue −
  outstanding` when tracked (incl. underwater and fully-paid-with-asset cases).
- `computeTrackedBalance` — 6 account sets × 8 loan sets × 4 people sets, each checked
  against an independent hand formula; ordering-invariance; a fully closed loan changes
  nothing whether present or absent; non-default-currency accounts always excluded.

**`money.matrix.test.ts` (167)** — `toMinor` returns integers and matches
`Math.round(major*100)` for positive and negative values; `toMajor ∘ toMinor` round-trips
exactly; `toMinor` is additive over a running total (no float drift over up to 137 small
adds); `formatMoney` never throws and always contains the rounded amount's digits for
every supported currency × magnitude, marks negatives, shows no fractional noise, and
falls back to a plain number when `Intl` rejects the code.

**`format.matrix.test.ts` (49)** — `formatPctChange` over 24 magnitudes × both signs:
sign-stripped, rounded, capped at `>999%`, always ending in `%`; `+x` and `−x` identical.

### 4.2 Pre-existing coverage retained (3 188 cases)

Unchanged and still green — the DB-integration suites (run against a real `better-sqlite3`
engine via `src/test-support/realDataTestDb.ts`): loan lifecycle & prepayment safety,
transaction edit/delete link guards, subcategory rollup, recurring-rule catch-up, reports
live SQL, net-worth reconstruction, a full real-data backup round-trip, and the
Home/Profile/Loans "screens agree on totals" consistency check (now asserting against the
shared `computeTrackedBalance`).

### 4.3 New unit tests added to existing files

- `src/lib/date.test.ts` — `daysUntilIsoDate` (today = 0, past negative, future positive,
  time-of-day invariant).
- `src/db/reports.test.ts` — `computeTrackedBalance` (default-currency filter, borrowed vs
  lent, asset offset, defaulted counts / closed drops, people net).

---

## 5. ESLint — the 48 warnings, resolved

| Rule | Count | Resolution |
|---|---:|---|
| `react-hooks/refs` | 21 | **Fixed** — `useRef(new Animated.Value()).current` → lazy `useState(() => new Animated.Value())` in `usePressScale`, `useFadeIn`, `ToggleSwitch`, `notification-settings` |
| `react-hooks/set-state-in-effect` | 14 | Rule **off** in `eslint.config.js`, with rationale: it flags the standard "re-init a modal's form when it opens" pattern; this app doesn't use the React Compiler |
| `react/no-unescaped-entities` | ~50 (err) | Rule **off** — apostrophes in copy are intentional |
| `react-hooks/immutability` | 1 | **Fixed** — `PieChartDoodle` accumulator → precomputed cumulative array |
| `exhaustive-deps` | 3 | **Fixed** — 2 by depending on primitives / a stable `useMemo` value; 1 documented `// eslint-disable` where re-running would wipe a half-filled form |
| `no-unused-vars` / `no-require-imports` in tests | 5 | **Fixed** unused bindings; `no-require-imports` off for `**/*.test.ts` (mid-body `require()` after `jest.mock` is legitimate there) |

`refs` and `immutability` stay **on as warnings** so a regression is caught. `npm run lint`
now exits 0 with no output.

---

## 6. Out of scope / not done

Flagged earlier and deliberately left (you deselected these):

- **Jest "worker failed to exit gracefully"** notice — a pre-existing open-handle leak in
  the `better-sqlite3` harness. Non-fatal (`jest` still exits 0). `jest.setup.ts` removed
  the `expo-notifications` contribution but the DB connections are still not explicitly
  closed.
- **`npm audit fix`** — the new ESLint/Prettier toolchain brought 14 moderate dev-only
  advisories.
- **`listAccounts` / `listPeople` N+1 queries** — one balance query per row; a perf-only
  change to core `src/db` code.
- **Wiring `PRAGMA user_version`** for real migration versioning (the dead `SCHEMA_VERSION`
  constant was just deleted).
- **`index.tsx` / `settings.tsx` decomposition** — already reasonable sizes with no
  cleanly separable sub-components.

---

## 7. Verification

```bash
npm ci
npm run typecheck        # tsc --noEmit           → 0 errors
npm run lint             # eslint .               → 0 problems
npm run format:check     # prettier --check .     → clean
npm test                 # jest                   → 25 suites, 7 668 tests, 0 failures

# Do NOT use `expo export --platform web` — it fails inside vendored expo-sqlite web
# code (no metro.config.js for .wasm; web is not a target), unrelated to this work.

# On a device / emulator, smoke-test the split screens:
#   Home + Profile show an identical "Tracked Balance"
#   Loans: open a loan → Pay / Prepay / Update rate / Asset / EMI account / Delete
#   Transactions: week/month nav, month picker, filter, add, edit, detail/undo
#   Categories: add / edit / archive / subcategory pills
#   Recurring: add / edit / pause / delete
#   Reports: bars/pie toggle, spend/IO/net-worth trend, savings ring
```
