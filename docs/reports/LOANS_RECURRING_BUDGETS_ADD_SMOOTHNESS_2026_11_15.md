# Loans, Recurring, Budgets and Add transaction smoothness (15 November 2026)

The same method as [Activity](ACTIVITY_SMOOTHNESS_2026_11_14.md), [Home](HOME_SMOOTHNESS_2026_11_14.md), [Reports](REPORTS_SMOOTHNESS_2026_11_15.md) and [Plan](PLAN_SMOOTHNESS_2026_11_15.md): measure each interaction, find where the time goes, change that, and check nothing visible moved. Nothing here was run on a phone: the browser render (react-native-web, a real SQLite database, React in production mode, the CPU slowed 6 times) shows the JavaScript cost of each tap, not native frames.

## What was measured

Each interaction on a typical ledger, at 6 times slower CPU, three runs each (Budgets' opens: eight repeats, twice, alternating old and new, because their three runs overlapped). Runs vary by about a quarter. The figures are how long React spent drawing (the commits over 4 ms).

**Loans**

| Interaction                  | Before            | After                |
| ---------------------------- | ----------------- | -------------------- |
| Open a loan's detail         | 128 to 153 ms     | 101 to 133 ms        |
| Close it                     | 31 to 48 ms      | no redraw            |
| Open "Pay next EMI"          | 147 to 174 ms     | 110 to 128 ms        |
| Open "+ Loan"                | 105 to 153 ms     | 76 to 85 ms          |
| Close the form               | 40 to 54 ms      | 10 to 19 ms          |

**Budgets**

| Interaction                  | Before            | After                |
| ---------------------------- | ----------------- | -------------------- |
| Open a budget's detail       | median 94 / 85 ms | median 84 / 94 ms (the same) |
| Open the form                | median 116 / 124 ms | median 104 / 119 ms (the same) |
| Close either                 | median 21 to 25 ms | median 2 to 4 ms     |
| Open the "More" menu         | 42 to 56 ms       | 19 to 29 ms          |
| Pick "Edit limit"            | 63 to 71 ms       | 39 to 59 ms          |

**Recurring**

| Interaction                  | Before            | After                |
| ---------------------------- | ----------------- | -------------------- |
| Open a rule                  | 94 to 112 ms      | 74 to 80 ms          |
| Close it                     | 55 to 95 ms       | 31 to 46 ms          |
| Pause a rule                 | 140 to 216 ms, 5 redraws | 60 to 72 ms, 4 redraws |
| Open "+ Add"                 | 157 to 188 ms     | 101 to 127 ms        |
| Close it                     | 79 to 111 ms      | 51 to 70 ms          |
| Close "Make recurring"       | 37 to 55 ms       | 18 to 19 ms          |
| Hide a suggestion            | 23 to 41 ms       | 9 to 15 ms           |

**Add transaction**

| Interaction                  | Before            | After                |
| ---------------------------- | ----------------- | -------------------- |
| A digit on the pad           | 40 to 95 ms       | 5 to 42 ms           |
| Pick a category              | 77 to 163 ms      | 22 to 77 ms          |
| Switch to Income             | 72 to 175 ms      | 30 to 66 ms          |
| "Money back" toggle          | 40 to 106 ms      | 16 to 26 ms          |
| Focus the category search    | 33 to 36 ms       | under 4 ms           |
| Open the account or date sheet | 75 to 147 ms    | within the spread (one run in three slower) |
| Switch to Transfer, Friend or Expense | 41 to 167 ms | the same: the page really changes |

Where the time went, from a probe that timed each part of the Add page: a digit on the pad drew the whole page. The amount, which is all a digit changes, took 1 to 2 ms; the footer (the pad, the account/date/note row, Save) took about 24, the fields (the category grid) about 20, the header about 6. Picking a category took 87 ms for the fields alone. The cause was shared by all four screens: every change redrew everything behind it. On Loans, Budgets and Recurring that was a sheet opening or closing (state of the page), a reload that set every list to a fresh array, and rows that were redrawn for every change. On Add it was one `model` object, rebuilt on every render together with every command in it, handed to every section.

## What changed

1. **Which sheet is open lives outside React state** on Loans, Budgets and Recurring ([loansSheetsStore](../../src/features/loans/loansSheetsStore.ts), [budgetsSheetsStore](../../src/features/budgets/budgetsSheetsStore.ts), [recurringSheetsStore](../../src/features/recurring/recurringSheetsStore.ts), on the small shared [valueStore](../../src/lib/valueStore.ts)), rendered by `LoansSheets`, `BudgetsSheets` and `RecurringSheets`. Opening or closing one redraws the sheets, not the hero and the rows behind them.
2. **A reload keeps what it did not change** ([useLoansData](../../src/features/loans/useLoansData.ts), [useBudgetsData](../../src/features/budgets/useBudgetsData.ts), [useRecurringData](../../src/features/recurring/useRecurringData.ts)): each reads everything as one update, keeps every row that is exactly as before (`reuseUnchangedBy`, `keepEntriesIfEqual` in [stableData](../../src/lib/stableData.ts)), and sets no state at all when nothing is new. Recurring's pause shows at once and its load, which used to set five states in two batches, is one.
3. **The rows and sections compare their props** (`LoanListItem`, `BudgetListRow`, `RuleListItem`, and the heroes, suggestions and sheets), with handlers that keep one identity. What the pages work out (`buildLoansModel`, `buildRecurringModel`) is pure and memoized. What the Budgets page does to budgets (continue one or all, delete with undo) moved to [useBudgetActions](../../src/features/budgets/useBudgetActions.ts), and what Recurring does to a rule (pause, hide a suggestion) to [useRuleActions](../../src/features/recurring/useRuleActions.ts).
4. **Add's sections are drawn again only for what they show** ([useStableModel](../../src/features/add/hooks/useStableModel.ts), [memoByModelKeys](../../src/features/add/utils/memoByModelKeys.ts)). Each section already declared the fields of the model it reads (its props were a `Pick<AddEntryModel, …>`); the list is now one exported `*_KEYS` constant that both types the props and drives the comparison, so a section cannot read a field it did not declare. The model hands out each command as one fixed function that runs the latest one (so a tap still acts on the state as it is now) and keeps the few lists and objects that are rebuilt with the same content the same until their content changes. A `hasAmount` flag replaces `expr` in the fields, so the category grid no longer depends on each digit typed.
5. **The pad's keys and the footer's detail row** ([AmountPad](../../src/components/AmountPad.tsx)): the 16 keys are memoized, and so is the account/date/note row, so Save changing its title does not redraw them.

## Code structure

| Screen    | Before | After | Owns                                                                                                   |
| --------- | ------ | ----- | ------------------------------------------------------------------------------------------------------ |
| Loans     | 226    | 157   | `useLoansData`, `buildLoansModel`, the sheets store and `LoansSheets`, `LoanListItem`, `ClosedLoans`    |
| Budgets   | 389    | 208   | `useBudgetsData`, `useBudgetActions`, the sheets store and `BudgetsSheets`, `BudgetListRow`            |
| Recurring | 390    | 228   | `useRecurringData`, `useRecurringModel` (over `buildRecurringModel`), `useRuleActions`, the sheets store and `RecurringSheets`, `RuleListItem`, `RunDateSheet` |
| Add       | split already | the sections and the model as before | `useStableModel`, `memoByModelKeys`, the `*_KEYS` of each section |

Each new piece has tests of its own, and each screen has a test on a real database that counts what is drawn: Loans, Budgets and Recurring in `src/screens`, Add in [AddRenderCounts](../../src/features/add/AddRenderCounts.test.tsx). They fail with the old code: a sheet opening or closing drew every card or row again (2 cards became 10 draws; 3 rules, 15), a reload that found nothing new drew them all again, one paid EMI drew both loans, pausing a rule drew all of them, and a digit on the pad or a sheet opening drew the header, the grid and the sheets. The existing tests of all four screens pass unchanged.

The change was checked against the version before it: 21 states across Loans (the list, the payoff timeline, a loan's detail, the pay sheet, the new-loan form), Budgets (the list, a detail, the menu, Edit limit, the new-budget form) and Recurring (the list, a rule, paused and resumed, the 30-day strip, a suggestion made recurring and one hidden, the new-rule form) are identical pixel for pixel. On Add, 15 of 16 states are (typed amount, a category, the search typed and cleared, each tab, the account, date and label sheets, money back); the 16th, the Friend tab, differs only in the people's avatar colours, which are random per page load (the old build differs from itself the same way). The click-everything run on normal, empty and stress data raises no error besides the one below.

## Not changed, and why

- **Opening a sheet costs what the sheet costs.** On Budgets the open is unchanged: what is left is the sheet mounting, and every sheet measures its header, content and footer after layout and draws once or twice more for it (`ModalSheet`, shared by the whole app). The loan detail (about 100 ms) and the rule form are the largest. Loans' "Pay" still opens the detail first and the pay sheet on top of it, as before.
- **The rule form is always mounted**, so each time it hides it is drawn once more (31 to 46 ms). Mounting it only while open would cut the sheet's exit animation, which is a design question.
- **Switching Add's tab** (Expense, Income, Transfer, Friend) still costs 40 to 150 ms: the fields, the header's control and the footer all really change.
- **Add's Save and the fields still redraw for each digit** (about 12 to 30 ms and 9 to 25 ms): Save names the amount, and the "usual" chips mark the one that matches it. They are small beside the 50 to 60 ms the whole page cost.
- **The browser warns that a `<button>` is nested in a `<button>`** on Loans (the pay pill in the card) and Budgets (More in the row), and on Plan. It is the same before and after (`LoanCard` and `BudgetRow` are unchanged): react-native-web builds it from a pressable inside a pressable; it is not a problem on Android's views.
