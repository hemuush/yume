# Full-code review (22 October 2026)

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Every non-test source file (459 files under `app/`, `src/`, the plugins, scripts and root configuration) was read by one of nine reviewers working from a fixed file list; each reported the count it read. Reviewers only report: every claim below was checked against the code before a change was made, and several were wrong. Nothing here was run on a phone; the automated checks are the full Jest run (needs `LANG=en_IN.UTF-8`, `TZ=Asia/Kolkata`, as in CI), typecheck, lint, the cycle check, the security tests and `expo export`.

## Fixed

| Area                  | Problem                                                                                                                                                               | Fix                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Notification settings | The "Suu's check-ins" toggle built its change on a stale render, so a quick earlier change could be undone                                                            | Reads the latest prefs like every other handler                                         |
| Onboarding            | Skip during account creation finished onboarding twice                                                                                                                | Skip does nothing while accounts are being created                                      |
| Next Due widget       | Picked recurring rules on foreign-currency accounts and printed them in the default currency                                                                          | Filters with `recurringRulesInCurrency`, as Home, Plan and Recurring do (test added)    |
| Recurring             | Rule editor and annual-bill sheet used the default currency symbol                                                                                                    | Use the rule account's currency                                                         |
| Person sheet          | Headline used the rounded balance, label and buttons the unrounded one; a failed refresh after a successful save read as "Couldn't save" (a retry would record twice) | One rounded balance everywhere; the write and the refresh are separate steps            |
| Local backup          | One file in the folder with an undecodable name failed every backup                                                                                                   | Shared `backupBaseName` guards the decode (test added)                                  |
| People                | `undoPersonTransaction` deleted any transaction when no ledger entry linked it                                                                                        | Throws instead (test added)                                                             |
| Settings              | `markWrapSeen` ran outside the settings lock; the legacy Gold accent mapped to a dropped shade; defaults were returned by reference                                   | Lock added; maps straight to Terracotta; copies returned                                |
| Activity              | Recent searches saved from inside a state updater; the filter sheet counted matches while closed                                                                      | Saved once outside the updater; counted only while open                                 |
| Tidy up               | Moving old balances into the opening balance added the report's total but deleted the rows as they now were, and undo overwrote later edits                           | Totals the rows as deleted, refuses if any changed, undoes by subtracting (tests added) |
| Database              | Read-only `exclusiveAsync` calls moved the data version on, reloading cached screens                                                                                  | `readOnly` option used by the five read callers and the backup snapshot                 |
| Splits                | The overspend check ran once per part                                                                                                                                 | Once per type, category and day                                                         |
| Loans                 | A borrowed loan fee with no fee category was filed under the income category                                                                                          | Refused (test added)                                                                    |
| What if               | A very slow pace produced the date "NaN-NaN-NaN"                                                                                                                      | No date beyond 100 years (test added)                                                   |
| Excel export          | The Total row added income, expenses and transfers as if one kind                                                                                                     | Labelled as a sum of the listed amounts                                                 |
| Money formatting      | An `Intl.NumberFormat` was built for every amount                                                                                                                     | One per currency, cached; the export reuses `getCurrencySymbol`                         |

Tidying: unused style keys, the unused `onExplore` button and the Spending / Net-worth switch inside `TrendChart` (its only caller fixes the series), misplaced or stacked doc comments, history comments, stale ignore entries, `tsconfig` `baseUrl`, the empty `submit` profile, a CI `concurrency` group and `.env` in `.gitignore`.

## Checked and left alone

- **Reported dead, but used:** `HeaderPrivacyToggle` (Profile), `timesLabel` (category page), `getAccountBalance` (many tests), the full-screen branch of `ScreenLoadError` (twelve screens), most of `loans.styles` (`app/loans.tsx`).
- **Deliberate:** the backup check reads the newest files so it never overwrites a backup from another install; `MonthlyPlanCheck` clears its figure on each reload so a figure from an older snapshot never shows; `searchQuery` reads "12.5" as a date by design; a failed backup-folder read in Needs you would fall back to "no folder" and show a false nudge, so it is not isolated.
- **Exports used only by tests:** 73 exports; none is unreferenced.

## Not done

- Splitting the large files (`add-transaction`, `reports`, `reports.ts`, `settings.ts`, `wrapData.ts`, `LoanDetailModal`, `SettingsSection`) and sharing the repeated error banner, `useSaveOnce` pass-through and stacked-layout rule across screens. These touch many files and need phone checks.
- Whether back closes the right page when a root sheet page re-renders over a child page (`ModalSheet` / `SheetFlow`); needs a runtime check.
- Running the one-time database repairs on every launch (stamp `user_version`), dropping prefix indexes, and the per-month queries in `getNetWorthTrend`.
- Small inconsistencies: `CountUpAmount` ignores hide-amounts masking (callers not audited), `PurchaseCheck` can hold a date below `minDate` after midnight, `StripCard` applies `style` to two views.
