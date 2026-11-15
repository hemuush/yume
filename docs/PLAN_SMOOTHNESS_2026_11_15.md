# Plan smoothness and code structure (15 November 2026)

The same method as [Activity](ACTIVITY_SMOOTHNESS_2026_11_14.md), [Home](HOME_SMOOTHNESS_2026_11_14.md) and [Reports](REPORTS_SMOOTHNESS_2026_11_15.md): measure each interaction, find where the time goes, change that, and check nothing visible moved. Nothing here was run on a phone: the browser render (react-native-web, a real SQLite database, React in production mode, the CPU slowed 6 times) shows the JavaScript cost of each tap, not native frames.

## What was measured

Each interaction on a typical ledger, at 6 times slower CPU, three runs each. Runs vary by about a quarter. The figures are how long React spent drawing (the commits over 4 ms) and, for sheets, when the first change reached the screen.

| Interaction                          | Before                                   | After                                   |
| ------------------------------------ | ---------------------------------------- | --------------------------------------- |
| Open a budget's sheet (Overview)     | React 52 to 70 ms; on screen at 92 to 120 ms | React 22 to 26 ms; on screen at 56 to 66 ms |
| Open a person's sheet                | React 58 to 66 ms; on screen at 94 to 99 ms  | React 23 to 26 ms; on screen at 46 to 60 ms |
| Open "Add to your plan"              | React 41 to 61 ms                        | React 14 to 17 ms in two runs, 44 in one |
| Close a sheet (budget, person, Add menu, bill, loan comparison, loan) | One redraw of 25 to 109 ms (usually 30 to 40) | No redraw over 4 ms, except the comparison (0 to 21 ms: it stays mounted and hides) |
| Forecast details (the runway card's own panel) | Open 34 to 41 ms, close 11 to 36 ms | The same: its state was already its own |
| Switch tab (median of 18 switches)   | Upcoming 40, Money plan 53, Debt 40, Overview 82 ms | 45, 56, 33 and 68 ms: the same within the spread |
| First open of the tab                | about 0.8 s                              | about 0.8 s (the same)                  |

Where the time went: opening or closing a sheet changed a `useState` on a 930-line screen that held about 30 of them, so the whole open tab (the runway, six panels, the pending refunds, the habit card) was drawn again behind a sheet that covers it. A reload then set about twenty lists to fresh arrays, so even a reload that found the same plan redrew everything. Both showed in a test: with the old screen, opening "Add to your plan" or reloading with nothing new drew the runway card and the panels a second time.

## What changed

1. **Which sheet is open lives outside React state** ([planSheetsStore](../src/features/plan/planSheetsStore.ts), rendered by [PlanSheets](../src/features/plan/PlanSheets.tsx)): the same pattern as Home's and Activity's stores. Opening or closing a sheet redraws the sheets, not the page behind them. The installment-payment lookup (ticket so a stale answer never opens a sheet, busy flag, cancel on leaving the tab) moved into the store with tests of its own.
2. **A reload keeps what it did not change** ([usePlanData](../src/features/plan/usePlanData.ts), [planData](../src/features/plan/planData.ts), `keepFieldsIfEqual` in [stableData](../src/lib/stableData.ts)): the 14 reads still run together with the newest request winning, the plan is derived by one pure function, and each field of the result keeps its previous object when its content is the same. A count of loads that landed (`version`) is what the pending refunds and the monthly check use to read their own data again.
3. **Each tab is its own memoized piece** ([PlanOverviewTab](../src/features/plan/PlanOverviewTab.tsx), [PlanUpcomingTab](../src/features/plan/PlanUpcomingTab.tsx), [PlanMoneyTab](../src/features/plan/PlanMoneyTab.tsx), [PlanDebtTab](../src/features/plan/PlanDebtTab.tsx)). They get the data, one `actions` object that keeps its identity ([planActions](../src/features/plan/planActions.ts)) and, on the two that read their own data, a token that changes with each load. Overview and Money plan memoize their sections too.

## Code structure

`app/(tabs)/plan.tsx` went from 932 to 211 lines.

| Piece                                                                    | Owns                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [usePlanData](../src/features/plan/usePlanData.ts)                       | The 14 reads, newest wins, reload on focus, a write or a new day; the data for the current privacy setting |
| [planData](../src/features/plan/planData.ts)                             | What Plan derives from those reads (pure, tested): runway, due groups, budgets, people, habit, what-if |
| [planSheetsStore](../src/features/plan/planSheetsStore.ts), [PlanSheets](../src/features/plan/PlanSheets.tsx) | Which sheet is open, the payment lookup, every sheet Plan opens |
| The four tab components                                                  | One tab each                                                                                     |

The screen keeps the tab, the `?tab=` deep link (Home's "See all upcoming"), the header and the loading and error shells. New tests: `planData`, `planSheetsStore`, `keepFieldsIfEqual` and [PlanScreen](../src/screens/PlanScreen.test.tsx), which assembles the page on a real database and fails with the old screen when a sheet opens or a reload lands (the Add menu and the reload each drew the runway and the panels a second time). The existing `PlanScreen.test.tsx` under `features/plan` passes unchanged.

The change was checked against the version before it: 14 Plan states (Overview, Forecast details, a budget's and a person's sheet, the Add menu, Upcoming, a date picked, All dates, a bill's sheet, Money plan, Debt, the comparison, a loan's sheet, back to Overview) are identical pixel for pixel, with two exceptions that are not the change: the people's avatar colours are chosen at random when the page loads (the old build differs from itself there), and 13 to 16 anti-aliased pixels at the tab strip's top corners differ by at most 2 of 255 on the Debt states. The click-everything run on normal, empty and stress data gives the same three browser messages before and after (see below).

## Not changed, and why

- **The first open** costs the same: the 14 reads and the mount of the Overview tab. Neither moved.
- **Opening an item's sheet still takes one redraw of the sheet itself** (about 25 ms at 6 times slower), which is the sheet mounting; the loan sheet is the largest.
- **Tab switches cost what they did** (the medians above): each tab is still mounted when picked, under the same entrance. Keeping all four mounted would make a switch cheaper and the page slower to open, and Plan's tabs hold timers and reads that should not run unseen.
- **The browser warns that a `<button>` is nested in a `<button>`** somewhere on Plan, and it did so identically before this change (48 times in the click-everything run). react-native-web builds that from a pressable inside a pressable; it is not a problem on Android's views, but the source was not tracked down here.
