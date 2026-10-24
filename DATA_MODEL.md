# Data model

Persisted money uses **integer minor units** (for example paise). Rate, interest and schedule calculations may use floating-point intermediates before rounding to stored units; do not assume every intermediate is an integer. New typed amounts intentionally round to whole major units in [money.ts](src/lib/money.ts). Unedited historical and loan-linked amounts can retain minor-unit precision. Display formatting uses whole major units.

Currency is never hardcoded. `formatMoney()` reads the user's chosen currency from Settings; a specific ISO code can still be passed per-call (an account keeps its own currency if it differs from the default).

## Accounts (`accounts`)

Every rupee/dollar the app knows about lives in an account: `bank`, `cash`, `wallet`, `credit_card`, or `savings`. A **savings account is a real account**, not a category — this matters because it means:

- Moving money into savings, an SIP, or a PF contribution is a **transfer** from a spending account into a savings account.
- Withdrawing from savings is a transfer the other way.
- The savings account's balance follows the same derivation as other account balances: opening balance + signed transactions, with the latest valuation adjustment for tracked accounts.

An **investment** is a savings account with `tracked = 1`; the account forms show it as its own Investment type. It may carry `investment_kind` (mutual fund, stocks, gold, fixed deposit, PPF/EPF, other) and `funding_account_id`, the bank, cash or wallet account its money normally comes from (cleared if that account is deleted). Money goes in or out by ordinary transfers: a transfer into an investment is read as Invested (SIP when `transactions.rule_id` shows a recurring rule posted it), out of one as Withdrawn, between two as Moved. Nothing about an entry is stored for this; it is derived from the accounts. A tracked account may also keep `units` (units held, for a units × price update), `maturity_date` and, with `interest_rate_annual_bp`, a yearly rate: a deposit or provident fund then shows an estimated value from its last update, never stored. A credit card may carry `min_due_bp` and `min_due_floor_minor` (its minimum due as a share of the statement, and the least it can be), used only to show the minimum on its bill.

An account's `currentBalanceMinor` is **never stored** — it's computed on every read from `opening_balance_minor` plus the sum of every transaction that touches that account (see [accounts.ts](src/db/accounts.ts) and [valuationSql.ts](src/db/valuationSql.ts)). There is no independently stored current-balance field to update. Tracked valuations are a separate source of balance adjustments; review them alongside transaction history.

## Categories (`categories`)

Mostly user-defined: name, income/expense kind, optional parent (for subcategories — one level deep, enforced in `assertValidParent`), icon, color, archive flag, an `is_sensitive` flag, and an `is_system` flag. Archiving keeps historical transactions intact while removing the category from new-entry pickers, and cascades to subcategories — nothing is ever hard-deleted if it has transaction history. When `is_sensitive` is set and the global "hide sensitive amounts" setting is on, that category's amounts render masked everywhere (Savings Deposit and Investments start flagged).

**`is_system`** marks the five built-in categories the app looks up _by name_ at runtime to auto-file real transactions: **Loan EMI** (expense), **Loan Repayment** (income), **Fees & Charges** (expense), and **Friends & Family** (one income, one expense). These names identify the built-in filing categories, so deleting, archiving or renaming them would break their contract — `deleteCategory` / `archiveCategory` / `updateCategory` (name change) all reject a system category. Icon, colour, `is_sensitive`, and adding subcategories stay editable. User-created categories are never system, even one named identically to a built-in. `flagSystemCategories` in `src/db/client.ts` re-asserts the flag on every launch (and `restoreFromSnapshot` repeats it inline, for a backup taken before the column existed).

## Transactions (`transactions`)

Three types:

- `income` — increases an account's balance, requires a category
- `expense` — decreases an account's balance, requires a category
- `transfer` — moves money between two accounts, no category (the accounts themselves say what it was: e.g. spending → savings)

A transaction can optionally link to a `loan_payment_id` (it was an EMI payment) — this is how loan repayments show up in both the loan's amortization schedule and the ordinary transaction list without being duplicated data. It can also carry a `loan_id` for a loan's own disbursement, processing-fee, and prepayment transactions (`ON DELETE CASCADE`, so deleting a mis-entered loan removes them with it). Those rows also record which of the four they are in `loan_tx_kind` (`disbursement`, `fee`, `prepayment`, `prepayment_charge`) — only a `prepayment` reduces the loan's principal, which is how the net-worth trend and the Home debt sparkline count it. `getTransactionLink` / `isLinkedTransaction` (`src/db/ledger.ts`) detect both cases so the UI routes edits/deletes of linked rows through the loan or person "undo" flow instead of a raw write.

## Loans (`loans`, `loan_payments`)

A loan is either `borrowed` (a liability — you owe someone) or `lent` (an asset — someone owes you), each with its own full amortization schedule generated up front.

**EMI formula** (standard reducing-balance):

```
EMI = P × r × (1+r)^n / ((1+r)^n − 1)
```

where `P` = principal, `r` = monthly interest rate (annual rate ÷ 12), `n` = tenure in months. Zero-interest loans fall back to a straight-line split. The last installment absorbs any rounding residue so the outstanding balance hits exactly zero — see `src/lib/loan.ts`.

**Prepayment**: reduces outstanding principal immediately, keeps the EMI fixed, and regenerates the remaining schedule with a shorter tenure (`recalculateAfterPrepayment`). An optional prepayment/foreclosure charge is recorded separately (expense for a borrowed loan, income for a lent loan), never folded into the principal.

**Floating-rate loans** (`rate_type = 'floating'`): `applyRateChange` records a rate change and offers the borrower's real choice — `keepEmi` (EMI fixed, tenure absorbs the change) or `keepTenure` (EMI recomputed to still finish on the same date). Every change is logged to `loan_rate_changes` so the rate history survives being overwritten.

**Asset-backed loans**: a borrowed loan can record what it financed (`asset_label`) and that asset's current value (`asset_value_minor`). When set, the loan's net-worth contribution becomes its real equity (asset value − outstanding) instead of pure debt — see `loanNetWorthContribution` and `computeTrackedBalance` in `src/db/reports.ts`, the shared helpers Home and Profile both use so their headline "Tracked Balance" can never disagree.

Paying an installment (`payInstallment`) atomically: creates the linked transaction (expense if borrowed, income if lent — money moves the opposite direction depending on which side of the loan you're on), marks the installment paid, and updates the loan's outstanding principal — all inside one SQLite transaction so a crash mid-write can't leave the loan and the ledger disagreeing.

The confirmation defaults the actual money-movement date to the local device day; the user can select an earlier date without changing the agreed due date. The schedule shows that actual paid/received date when recorded. Paid-before-tracking history has no fabricated account entry or actual payment date. Derived payoff dates require a final pending row whose remaining principal is zero; missing/truncated schedules do not establish a reliable debt-free date.

## Friends & Family ledger (`people`, `person_ledger_entries`)

Distinct from `loans` on purpose: this is for informal, interest-free IOUs — "I paid for dinner, a friend owes me ₹500" — not scheduled bank loans. Each entry has a signed `amount_minor`: positive means the person now owes you more, negative means they owe you less (they repaid you, or you're settling a debt to them). A person's balance is just `SUM(amount_minor)` across their entries — no separate stored balance to get out of sync.

`recordMoneyGivenToPerson` / `recordMoneyReceivedFromPerson` create both the real account transaction (money actually moved) and the ledger entry in one step, for the common case of paying cash for a friend. `addLedgerEntry` on its own supports pure IOU bookkeeping with no account impact — e.g. logging a debt that was settled entirely in cash outside the app.

## Reports (`src/db/reports.ts`)

Period comparisons (day/week/month/year vs. the immediately preceding equivalent period) are computed directly from the transaction and account tables — there's no separate aggregation table to keep in sync. `getPeriodSummary` returns income, expenses, net, net savings-account contribution, and per-category expense and income breakdowns for any date range; `getPeriodComparison` runs it twice (current + previous period) and computes percentage change. Every aggregate query joins to `accounts` and filters to the default currency, so totals are never summed across currencies. The category breakdown rolls subcategory spend up into the parent row, with `getSubcategoryBreakdown` for the drill-down. `getNetWorthTrend` reconstructs net worth as of the end of each of the last N months from the same tables filtered to a cutoff date.

Reports looks at a _report window_ (`src/lib/period.ts`): a month or year by offset from today, or a custom range the person picks. A custom range made of whole months steps by that many months (so a financial year, 1 April to 31 March, steps to the next one); any other range steps by its number of days, and is compared with the same number of days just before it.

## Recurring rules (`recurring_rules`)

A rule is a template (type, account(s), category, amount, note) plus a cadence (`frequency` × `interval_count`) and a `next_run_date`. On every app open, `runDueRecurringRules` catches each active rule up to today, creating **one real transaction per missed occurrence** through the same `createTransaction` a manual entry uses (capped at 500 per rule). A rule that fails once (e.g. its category was deleted) is deactivated rather than retried forever. Each occurrence is inserted in the same database transaction that advances `next_run_date`, so an interrupted catch-up never re-posts occurrences it already wrote. A monthly/yearly rule also keeps its real day-of-month in `anchor_day`: a rule on the 31st runs on each month's last day when the month is shorter (Feb 28), then goes back to the 31st.

## Settings (`settings`)

A plain key/value table — default currency, accent color, user name, onboarding flag, app-lock toggle, "hide sensitive amounts" privacy toggle, notification preferences, backup frequency, the chosen local backup folder, and the last local backup timestamp and outcome. Deliberately schema-less so a new preference never needs a migration; hot values (currency, accent, user name, …) are cached in memory and re-primed after a restore via `resetSettingsCache()`.

## Savings goals (`savings_goals`)

A named target amount with an optional target date, an optional linked account, and an optional note sealed until the goal is first reached (`note_to_self`, `letter_revealed`). Progress works one of three ways (`src/db/savingsGoals.ts`):

- **By hand** (`track_account = 0`, `reserve_account = 0`, the default): `current_amount_minor`, moved by "+ Add money". There is no contribution ledger and nothing creates a transaction, so adding to a goal is never confused with moving money. A linked account is then only a label.
- **Following the linked account** (`track_account = 1`): progress is that account's balance, worked out on every read in the same query that loads the goal (opening balance + income and transfers in − expenses and transfers out, never below zero). `current_amount_minor` is left untouched meanwhile, so switching back to "by hand" brings the old amount back. "+ Add money" is refused; the goal's button opens a transfer into the account instead. What-if uses the account's net growth over the last 90 days as the goal's saving rate (`getAccountMonthlyGrowth`), not the whole balance, which includes money from before the goal existed.

- **Reserved from an account** (`reserve_account = 1`, `track_account = 0`): progress is the explicitly reserved share, while the previous manual amount remains untouched. All reservation goals share a live available balance. See Goal reservations below for safeguards and lifecycle behavior.

For legacy manual/following goals, account deletion unlinks the account and restores hand-tracked progress. Reservation goals must first release their allocation and change tracking mode before the account can be deleted.

## Budgets (`budgets`)

A per-category monthly spending limit (`src/db/budgets.ts`). Progress is the category's spend this month, subcategories included; a pace marker compares it with an even spread across the month (`src/lib/pace.ts`). Each budget sends at most one notification at 80% and one when over, per month (`budget_nudges_sent` in settings).

## Subscriptions and bills (`src/db/subscriptions.ts`)

Not a table: worked out from `recurring_rules` and `transactions` for the Recurring screen. `subscriptionTotals` adds up running expense rules at their monthly share (a weekly rule counts about 4.35 times, a yearly one a twelfth). Suggestions come from two places: entries under a Subscriptions subcategory in the last 60 days with no running rule, and `findMonthlyPatterns`, which finds the same category charged once a month for three months in a row (within 10% of the latest amount and five days of its day of the month, the latest in this month or last). Loan entries, system categories, and categories that already have a running rule are never suggested. A suggestion hidden with ✕ is stored in `hidden_subscription_suggestions`; a pattern also shows in Needs you, and hiding it in either place hides it in both.

## Migrations

`CREATE_TABLES_SQL` runs `IF NOT EXISTS` on every launch for fresh installs; `runMigrations` in `src/db/client.ts` adds any column an older install is missing (via `ensureColumn`, which also drives one-time backfills). Category flags like `is_sensitive` / `is_system` and the built-in "Friends & Family" category are seeded on a fresh install and backfilled for upgrades. A default category's _colour_ is migrated the same targeted way: `remapLegacyCategoryColors` updates a built-in category's colour only when its name, kind, and current colour all still exactly match what an older version of the app originally seeded — so a category the user has renamed or recoloured themselves is never touched, and the migration is a no-op once applied (there's nothing left for the `WHERE` to match).

## Implementation and validation

The [schema](src/db/schema.ts) defines persisted fields and constraints. [Client serialization](src/db/client.ts) protects transaction boundaries; [currency invariants](src/db/currencyInvariant.ts) prevent unsupported mixed-currency financial links. See [architecture](docs/ARCHITECTURE.md) for flow ownership and test locations. Existing scenarios are evidence for their inputs, not proof of every possible financial case.

## Goal reservations

A goal can use manual progress, follow its whole linked account, or reserve a share of the account. `reserve_account` and `track_account` are mutually exclusive. Reservation progress is `reserved_amount_minor`; the pre-existing `current_amount_minor` remains untouched for switching back to manual tracking. All reservation goals, including archived/completed ones, count against available money. New reservations cannot exceed the live account balance minus reservations; release and same-account reassignment remain available during a shortfall. Allocations do not change the ledger, net worth, income or spending. Account deletion and incompatible retyping are blocked until reservation goals are detached explicitly.

## Refund and annual-bill planning

`refund_expectations` stores one expected amount and optional due date per ordinary purchase. `refund_receipts` links actual income/refund transactions to that expectation, recording whether tracking created the transaction. Expectations never change balances. Partial receipts cannot exceed the remaining expected amount. Linking an existing refund does not create another transaction; undo removes a created receipt transaction, but only unlinks an existing one. Tracked purchases and receipts cannot be edited or deleted independently; use their detail actions to maintain consistency.

`annual_bill_goals` links one yearly expense rule to one reservation goal. Creating/linking a preparation goal does not allocate money automatically. Unlinking retains the goal and reserved money. Changing a linked rule away from a yearly expense, changing the goal away from reservations, or deleting either record requires unlinking first. Pausing a rule retains its preparation link.

Purchase checks and spending explanations are calculated, not persisted. Purchase checks subtract reservations and project recorded account-specific recurring movements and pending/overdue loan installments through 30 days after a purchase date (up to 90 days ahead). Expected refunds and unrecorded everyday spending are excluded; missing loan schedules remain visible. Spending explanations compare equal elapsed ranges in the default currency and apply category privacy. Their symmetric frequency/average-purchase decomposition plus refund changes sums to the exact net spending difference, without claiming a cause.

## Expense labels and compatibility

Expense labels reuse the existing `transactions.note` and expense-recurring `note` fields. There is exactly one optional text value per expense; old note text remains available as a label without a migration or duplicate tag relation. Labels are matched as exact trimmed text; existing case variants are not silently merged. Income, transfer, loan and person notes are unchanged. Backup JSON continues using the original column names, preserving older restore compatibility. Label reports net refunds by their recorded label, apply the default currency/date range and exclude private category groups when requested; they do not infer labels or move a refund to a different label.

## Planning additions

`goal_activity` journals manual goal additions/withdrawals and reservation changes atomically with progress. It retains the signed minor-unit change, balance after, currency, kind and timestamp. Whole-account balance fluctuations are not journalled. Goals with history must be archived rather than deleted.

Recurring rules have `posting_mode` (automatic/confirm), optional `next_amount_minor`, and `scheduled_date` for the original date of a postponed occurrence. Advancing clears the one-off fields and preserves the original cadence. Confirm-first rules create no automatic ledger entries.

Transaction `payment_mode` is retained as optional legacy metadata for existing entries, edits, repeats and backup compatibility. Entry controls, Activity filters, details, reports and Excel exports no longer expose payment methods; accounts identify the source/destination. Unrecorded methods remain null; no method is inferred. The unused method-report query has been removed. Currency-specific `monthly_plan_income_<currency>` settings hold optional planning estimates without creating income transactions.
