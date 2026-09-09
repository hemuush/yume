# Data model

All money is stored as **integer minor units** (e.g. paise, cents) everywhere — in the database, in memory, in every calculation — and only converted to a decimal for display. This is the single rule that keeps loan and budget math from drifting due to floating-point rounding.

Currency is never hardcoded. `formatMoney()` reads the user's chosen currency from Settings; a specific ISO code can still be passed per-call (an account keeps its own currency if it differs from the default).

## Accounts (`accounts`)

Every rupee/dollar the app knows about lives in an account: `bank`, `cash`, `wallet`, `credit_card`, or `savings`. A **savings account is a real account**, not a category — this matters because it means:

- Moving money into savings, an SIP, or a PF contribution is a **transfer** from a spending account into a savings account.
- Withdrawing from savings is a transfer the other way.
- The savings account's balance is always correct because it's derived the same way every account balance is derived: opening balance + all transactions that touch it.

An account's `currentBalanceMinor` is **never stored** — it's computed on every read from `opening_balance_minor` plus the sum of every transaction that touches that account (`ledger.ts: getAccountBalance`). This means a balance can never silently drift out of sync with its transaction history; there's no separate number to forget to update.

## Categories (`categories`)

Mostly user-defined: name, income/expense kind, optional parent (for subcategories — one level deep, enforced in `assertValidParent`), icon, color, archive flag, an `is_sensitive` flag, and an `is_system` flag. Archiving keeps historical transactions intact while removing the category from new-entry pickers, and cascades to subcategories — nothing is ever hard-deleted if it has transaction history. When `is_sensitive` is set and the global "hide sensitive amounts" setting is on, that category's amounts render masked everywhere (Savings Deposit and Investments start flagged).

**`is_system`** marks the five built-in categories the app looks up *by name* at runtime to auto-file real transactions: **Loan EMI** (expense), **Loan Repayment** (income), **Fees & Charges** (expense), and **Friends & Family** (one income, one expense). The loan and Friends & Family screens do `categories.find(c => c.name === '…') ?? categories[0]`, so a delete, archive, or rename would silently mis-file EMI/fee/friend transactions — `deleteCategory` / `archiveCategory` / `updateCategory` (name change) all reject a system category. Icon, colour, `is_sensitive`, and adding subcategories stay editable. User-created categories are never system, even one named identically to a built-in. `flagSystemCategories` in `src/db/client.ts` re-asserts the flag on every launch (and `restoreFromSnapshot` repeats it inline, for a backup taken before the column existed).

## Transactions (`transactions`)

Three types:
- `income` — increases an account's balance, requires a category
- `expense` — decreases an account's balance, requires a category
- `transfer` — moves money between two accounts, no category (the accounts themselves say what it was: e.g. spending → savings)

A transaction can optionally link to a `loan_payment_id` (it was an EMI payment) — this is how loan repayments show up in both the loan's amortization schedule and the ordinary transaction list without being duplicated data. It can also carry a `loan_id` for a loan's own disbursement, processing-fee, and prepayment transactions (`ON DELETE CASCADE`, so deleting a mis-entered loan removes them with it). `getTransactionLink` / `isLinkedTransaction` (`src/db/ledger.ts`) detect both cases so the UI routes edits/deletes of linked rows through the loan or person "undo" flow instead of a raw write.

## Loans (`loans`, `loan_payments`)

A loan is either `borrowed` (a liability — you owe someone) or `lent` (an asset — someone owes you), each with its own full amortization schedule generated up front.

**EMI formula** (standard reducing-balance):

```
EMI = P × r × (1+r)^n / ((1+r)^n − 1)
```

where `P` = principal, `r` = monthly interest rate (annual rate ÷ 12), `n` = tenure in months. Zero-interest loans fall back to a straight-line split. The last installment absorbs any rounding residue so the outstanding balance hits exactly zero — see `src/lib/loan.ts`.

**Prepayment**: reduces outstanding principal immediately, keeps the EMI fixed, and regenerates the remaining schedule with a shorter tenure (`recalculateAfterPrepayment`). An optional prepayment/foreclosure charge is recorded as its own separate expense, never folded into the principal.

**Floating-rate loans** (`rate_type = 'floating'`): `applyRateChange` records a rate change and offers the borrower's real choice — `keepEmi` (EMI fixed, tenure absorbs the change) or `keepTenure` (EMI recomputed to still finish on the same date). Every change is logged to `loan_rate_changes` so the rate history survives being overwritten.

**Asset-backed loans**: a borrowed loan can record what it financed (`asset_label`) and that asset's current value (`asset_value_minor`). When set, the loan's net-worth contribution becomes its real equity (asset value − outstanding) instead of pure debt — see `loanNetWorthContribution` and `computeTrackedBalance` in `src/db/reports.ts`, the shared helpers Home and Profile both use so their headline "Tracked Balance" can never disagree.

Paying an installment (`payInstallment`) atomically: creates the linked transaction (expense if borrowed, income if lent — money moves the opposite direction depending on which side of the loan you're on), marks the installment paid, and updates the loan's outstanding principal — all inside one SQLite transaction so a crash mid-write can't leave the loan and the ledger disagreeing.

## Friends & Family ledger (`people`, `person_ledger_entries`)

Distinct from `loans` on purpose: this is for informal, interest-free IOUs — "I paid for dinner, Abhinav owes me ₹500" — not scheduled bank loans. Each entry has a signed `amount_minor`: positive means the person now owes you more, negative means they owe you less (they repaid you, or you're settling a debt to them). A person's balance is just `SUM(amount_minor)` across their entries — no separate stored balance to get out of sync.

`recordMoneyGivenToPerson` / `recordMoneyReceivedFromPerson` create both the real account transaction (money actually moved) and the ledger entry in one step, for the common case of paying cash for a friend. `addLedgerEntry` on its own supports pure IOU bookkeeping with no account impact — e.g. logging a debt that was settled entirely in cash outside the app.

## Reports (`src/db/reports.ts`)

Period comparisons (day/week/month/year vs. the immediately preceding equivalent period) are computed directly from the transaction and account tables — there's no separate aggregation table to keep in sync. `getPeriodSummary` returns income, expenses, net, net savings-account contribution, and a per-category expense breakdown for any date range; `getPeriodComparison` runs it twice (current + previous period) and computes percentage change. Every aggregate query joins to `accounts` and filters to the default currency, so totals are never summed across currencies. The category breakdown rolls subcategory spend up into the parent row, with `getSubcategoryBreakdown` for the drill-down. `getNetWorthTrend` reconstructs net worth as of the end of each of the last N months from the same tables filtered to a cutoff date.

## Recurring rules (`recurring_rules`)

A rule is a template (type, account(s), category, amount, note) plus a cadence (`frequency` × `interval_count`) and a `next_run_date`. On every app open, `runDueRecurringRules` catches each active rule up to today, creating **one real transaction per missed occurrence** through the same `createTransaction` a manual entry uses (capped at 500 per rule). A rule that fails once (e.g. its category was deleted) is deactivated rather than retried forever.

## Settings (`settings`)

A plain key/value table — default currency, accent color, user name, onboarding flag, app-lock toggle, "hide sensitive amounts" privacy toggle, notification preferences, backup frequency, and the last local/Drive backup timestamps and outcomes. Deliberately schema-less so a new preference never needs a migration; hot values (currency, accent, user name, …) are cached in memory and re-primed after a restore via `resetSettingsCache()`.

## Migrations

`CREATE_TABLES_SQL` runs `IF NOT EXISTS` on every launch for fresh installs; `runMigrations` in `src/db/client.ts` adds any column an older install is missing (via `ensureColumn`, which also drives one-time backfills). Category flags like `is_sensitive` / `is_system` and the built-in "Friends & Family" category are seeded on a fresh install and backfilled for upgrades.
