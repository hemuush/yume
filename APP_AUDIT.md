# Yume app review — 10 October 2026

## Fix progress

All eight findings now have implementation changes. See FIX_REPORT.md for the final behavior, regression coverage and verification. The sections below preserve the original pre-fix audit.

## Scope and verification

This is a broad static audit and architecture map, with deeper tracing of startup, ledger mutations, loans, IOUs, recurring entries, privacy, reports, backup/restore, notifications and widgets. It is not a claim that every line has been independently verified. Decorative UI, animation paths and some secondary screens received less detailed inspection. No Android device or release build was exercised.

The Expo SDK 57 versioned documentation was read as required by AGENTS.md. No application code was changed during the initial audit. The existing modification to app.json was left alone.

Checks against the current checkout and installed dependencies:

| Check | Result |
| --- | --- |
| TypeScript | Failed: SpendBars/spendBars module resolution collision and missing installed expo-screen-capture |
| ESLint | Failed: the same component import casing problem and missing expo-screen-capture |
| Jest | All 241 suites failed during setup; zero tests executed because expo-screen-capture cannot be resolved |
| npm audit gate | Passed its configured policy; two advisories were explicitly allowed by the repository allowlist |

expo-screen-capture is declared in package.json and the lockfile, but absent from node_modules. This is an installation problem, not evidence of an undeclared dependency. Existing tests cannot currently substantiate runtime correctness.

## App map

Yume is an Android-only, offline personal finance app built with Expo Router, React Native and SQLite. Accounts can have different currencies; ordinary monetary summaries generally scope to the selected default currency rather than converting currencies. Amounts are intended to be integer minor units.

- **Startup:** app/_layout.tsx initializes fonts and the database, decides onboarding and app-lock gating, mounts theme/privacy providers, handles notification navigation, runs due recurring entries and automatic backups, and refreshes widgets around lifecycle transitions.
- **Storage:** src/db/client.ts wraps SQLite with a serialized write queue and exclusive database sections. schema.ts defines accounts, categories, transactions, splits, recurring rules, loans and payment schedules, people and IOU entries, savings goals, budgets, valuations, settings and recently deleted records. Migrations and seed data run at initialization.
- **Ledger:** transactions.ts validates and writes ordinary entries; accounts.ts derives balances from openings, transactions and valuations. Categories support one parent level, sensitivity flags, archiving and reserved system categories. Transfers are constrained to the same currency. Savings accounts use transfers rather than ordinary income/expense logging.
- **Money workflows:** loanRecords.ts creates loans and amortization schedules; loanPayments.ts handles installment payment, undo, prepayment and rate changes. people.ts atomically pairs money movements with IOU records. recurring.ts catches up due rules. savingsGoals.ts supports manual progress or following an account. budgets.ts supports category budgets and carry-over.
- **Screens:** Home presents the period snapshot, recent activity and shortcuts. Activity presents searchable/filterable entries and spending charts. Plan combines budgets, goals, repeating items, loans and people. Reports combines comparisons, trends, daily details and projections. Add supports editing, staged entries, refunds, splits and repeat shortcuts. Additional routes cover account/category management, loans, people, settings, stories and what-if calculations.
- **Consistency:** dataEvents.ts notifies screens after mutations. Freshness hooks combine focus, day changes and database versions. cachedRead.ts caches bounded read promises. Several screens also use sequence counters to reject stale loads.
- **Privacy:** PrivacyContext and amount components mask savings/investment amounts. AppLockContext and the root gate support local authentication, background relocking and screen-capture protection. Privacy must also affect aggregate queries, shortcuts, accessibility labels and widgets, which is where gaps were found.
- **Backup:** backup.ts creates/restores structured JSON snapshots with an exclusive section, a transaction and foreign-key validation. localBackup.ts uses Android folder access, daily snapshots and retention. safetyCopy.ts keeps the pre-restore database as a local recovery snapshot. exportExcel.ts generates a styled financial workbook.
- **Notifications/widgets:** local notification plans cover repeating entries and loan installments, with allowlisted destinations. Android widgets read shared financial summaries and provide quick-add actions. Native widget/keyboard functionality requires the appropriate native build.

Useful safeguards already present include serialized writes, atomic loan and IOU updates, same-currency transfer validation, foreign-key checking during restore, guarded installment undo, and duplicate-save guards in several entry flows. Those protections do not cover all concurrency or privacy paths below.

## Findings

### 1. P1 — Home component/helper names break module resolution on Windows

Evidence: app/(tabs)/index.tsx:59–60; src/features/home/SpendBars.tsx; src/features/home/spendBars.ts.

The component and helper differ by casing and extension. In this Windows checkout TypeScript resolves the component import against the helper and reports a missing SpendBars export plus TS1261/TS1149 casing errors. ESLint also rejects the import. Rename the helper to a distinct basename and update imports. This is directly verified by both checks.

### 2. P1 — Repeated-entry shortcuts reveal sensitive amounts

Evidence: src/features/home/RepeatEntrySheet.tsx:19–24, 78, 95; src/features/add/useAddSuggestions.ts:53; src/features/add/AddSections.tsx:331–337; src/db/transactions.ts getRepeatEntries.

Repeat entries can originate from sensitive non-system expense categories. The repeat sheet directly formats their amounts and repeats them in the undo toast. Add's usual-entry chips directly format amounts in both visible text and accessibility labels. These paths do not apply the privacy setting or retain sensitivity metadata for masking.

Reproduction to validate on device: log the same sensitive-category expense repeatedly, enable hiding savings/investment amounts, then open the repeat sheet or Add's usual-entry shortcuts. Apply privacy filtering or masking to the query results, visible labels, accessibility text and feedback.

### 3. P1 — Archiving a sensitive category exposes historical entries

Evidence: src/db/categories.ts:37–40; app/(tabs)/index.tsx:260; app/(tabs)/transactions.tsx:255; src/features/home/RecentTransactionRow.tsx:81; src/features/transactions/TimelineDay.tsx:97–106.

Home and Activity load only active categories. Historical transactions still reference archived categories, but their sensitivity metadata is absent from the screen's map. Home consequently passes a false/undefined sensitive flag to Amount; Activity's privacy predicate also lacks the category. Its chart filter explicitly retains entries with missing categories.

Reproduction to validate on device: archive a sensitive category with existing transactions, then enable hiding amounts and view those historical entries. Load archived category metadata for history and privacy decisions, while keeping pickers restricted to active categories.

### 4. P2 — Multi-currency history is summed and displayed as the default currency

Evidence: app/(tabs)/transactions.tsx:226–236, 253, 294–306; src/features/transactions/spendChart.ts; app/(tabs)/reports.tsx:260–263; src/features/transactions/TimelineDay.tsx:27–42; src/lib/exportExcel.ts:315 onward.

Activity's chart input contains transactions from all accounts and filters sensitivity but not currency. Headline totals use the default currency. With an INR account expense of 100 and a USD account expense of 10, the chart aggregates face values as 110 while the default-currency headline is 100. Activity's row/day formatting also lacks account currency. Reports' daily drilldown similarly fetches all account currencies.

Excel's Transactions sheet formats every amount with one default-currency money style and provides a subtotal across those amounts, despite its Summary filtering ordinary transaction totals by currency. Preserve each entry's currency, scope aggregates, and avoid cross-currency subtotals without conversion.

### 5. P2 — Recurring catch-up can overwrite a concurrent pause/edit or continue after deletion

Evidence: src/db/recurring.ts:220–263.

The runner snapshots all due rules once, then uses the captured amount, account, dates and active state for each occurrence. Each transaction inserts an entry and unconditionally advances/reactivates the rule without rereading it. User edits, pause/delete operations, account archiving, or restore can interleave between catch-up transactions. A pause can be replaced with active=1; a deleted rule can still produce entries because the UPDATE affecting zero rows is not checked.

This is a source-traced concurrency risk, not a reproduced device failure. Revalidate rule existence, active state and expected next-run date inside each occurrence transaction using the transaction handle; stop or restart when the rule changes. Include a deterministic interleaving test.

### 6. P2 — An older recovery snapshot can be presented as undo for the latest restore

Evidence: src/lib/safetyCopy.ts:93–100, 117–130; app/backup.tsx:224–230, 493–509.

A successful restore without a new safety copy, or a failure to promote the new pending copy, returns undoAvailable=false but leaves an older safety copy intact. The completion dialog respects that result. Reopening Backup loads the older copy and presents it as "Undo your last restore"; the confirmation promises data from just before the restore. Restoring it can discard more recent data than that promise implies.

Keeping the older recovery copy is useful, but persist its relationship to the restore and label it as an older recovery snapshot when it is not an undo of the latest restore. Existing tests explicitly preserve that older copy; they do not make the UI promise accurate.

### 7. P2 — This Month widget projections do not consistently honor hidden amounts

Evidence: src/widgets/data.ts:86–125; src/db/reports.ts getMonthPaceInputs/getStillToPayThisMonth.

The widget applies privacy to comparison totals and carry-in, but calls the pace and remaining-bills queries without their privacy argument. Those queries default to including sensitive categories. Hidden spending or repeating amounts can therefore influence the displayed projection, bill slice and after-bills amount, and disagree with Home's privacy-aware figures. Pass the setting consistently through all contributing queries and test the rendered data with hidden recurring expenses.

### 8. P2 — Loans, IOUs and account-following goals have no consistent currency ownership

Evidence: src/db/schema.ts loan/person/goal tables; src/db/people.ts:42, 119–182; src/db/savingsGoals.ts; src/features/goals/GoalAccountField.tsx; src/features/loans/AccountModal.tsx; src/db/reports.ts trackedBalanceParts.

Accounts own currencies, but these financial entities do not consistently own one or restrict linked account choices. A person's ledger sums signed minor units even when linked money movements use different currencies. Following a foreign-currency account compares its numeric balance with a default-currency target. Loan payments can use an account in a different currency without conversion or rejection. Totals then treat unowned amounts as default-currency money.

Choose an explicit invariant: give these entities a currency and enforce matching account currency, or constrain them to default-currency accounts. This needs migration and product decisions; it should not be patched by silently converting face values.

## Follow-up verification

First reconcile the installed dependencies and resolve the component/helper naming collision, then rerun typecheck, lint and Jest. Add targeted tests for the privacy, currency and recurring interleaving cases. Exercise backup failure/undo, app background relocking, notifications and widgets in an Android native build. Release export and native-build correctness remain unverified in this audit.
