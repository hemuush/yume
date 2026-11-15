# Reports smoothness and code structure (15 November 2026)

The same method as [Activity](ACTIVITY_SMOOTHNESS_2026_11_14.md) and [Home](HOME_SMOOTHNESS_2026_11_14.md): measure each interaction, find where the time goes, change that, and check nothing visible moved. Nothing here was run on a phone: the browser render (react-native-web, a real SQLite database, React in production mode, the CPU slowed 6 times) shows the JavaScript cost of each tap, not native frames.

## What was measured

Each interaction on a typical ledger (about 100 entries), at 6 times slower CPU, three runs each. Runs vary by about a quarter. The figures are how long React spent drawing (the sum of its commits over 4 ms), because the longest stretch in the browser also contains the in-browser database read, which on a phone runs off the JavaScript thread.

| Interaction                         | Before                          | After                             |
| ----------------------------------- | ------------------------------- | --------------------------------- |
| Step to another month               | 5 to 6 redraws, 160 to 220 ms   | 4 redraws, 95 to 130 ms           |
| Pick a day on the heatmap           | 2 redraws, 90 to 200 ms         | 2 redraws, 40 to 100 ms           |
| Open a day's sheet                  | 70 to 130 ms                    | 30 to 45 ms                       |
| Open a category in Breakdown        | 3 redraws, about 150 ms         | 3 redraws, 80 to 100 ms           |
| Switch to Year                      | 335 ms                          | 225 ms                            |
| First open of the tab               | about 1 s                       | about 0.9 s (within noise)        |

Where the time went: a period step replaced the page with the skeleton and rebuilt it, then redrew the whole page three more times as the biggest spends, the heatmap's day entries and the other details arrived, each redraw recomputing every figure and redrawing every card and all of the heatmap's cells. Every detail read was also started twice per step: once when the period changed, and again when the period's days landed (the effect listed the days as its trigger), so the first read was thrown away. The day's entries were read again whenever the categories or savings lists were rebuilt with the same content.

## What changed

1. **Details are read once the period has landed, and again after a reload** ([useReportDetails](../src/features/reports/useReportDetails.ts)): the biggest spends, a category's subcategories, the accounts split and the narrowed heatmap's days are tied to the period's data being ready and to a count of loads that landed, not to the identity of arrays. One read per step instead of two (a test fails with the old code).
2. **The day's entries are not read again for lists that did not change** ([useDayEntries](../src/features/reports/useDayEntries.ts); the loaded categories and savings accounts keep their identity when a reload finds the same content, via the shared [stableData](../src/lib/stableData.ts)).
3. **Each tab is its own memoized piece** ([OverviewTab](../src/features/reports/OverviewTab.tsx), [BreakdownTab](../src/features/reports/BreakdownTab.tsx), [TrendsTab](../src/features/reports/TrendsTab.tsx)): everything a tab works out (the heatmap's days, the "worth a look" cards, the breakdown's totals and changes, the trend baseline) is computed inside it, memoized, and only for the tab on show. Their sections are memoized too, and the heatmap grid inside its card, so a day's entries arriving redraws the inspector and not 30 or more cells. The handlers they get keep one identity. A test fails with the old code when the heatmap is drawn again for entries arriving.
4. **The header** is memoized: it was redrawn, range sheet included, on every change on the page.

## Code structure

`app/(tabs)/reports.tsx` went from 940 to about 420 lines.

| Piece                                                                      | Owns                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [useReportsData](../src/features/reports/useReportsData.ts)                | The period's comparison, trends, days, categories and budget; the load (newest wins); reloads on a write or a new day |
| [useReportDetails](../src/features/reports/useReportDetails.ts)            | What is read on top of a period, tied to what is open                                                   |
| [useDayEntries](../src/features/reports/useDayEntries.ts)                  | The heatmap day's entries                                                                               |
| [periodModel](../src/features/reports/periodModel.ts)                      | What the tabs share about the period (name, length, by-month, spending so far)                          |
| Overview, Breakdown and Trends tabs                                        | One lens each                                                                                           |

The screen keeps what crosses tabs (the period, the tab, the flow and grouping, the day, the category picked or narrowed to), the deep links, and the loading and error shells. Each piece has its own tests, and `ReportsScreen.test.tsx` (40 tests) passes unchanged.

The change was checked against the version before it: 14 Reports states (the overview, a day picked and its sheet, the heatmap scope menu, Breakdown, a category open, Income, each Trends chart, a step each way, the period menu) are identical pixel for pixel, except two same-day entries that swap places between page loads in this browser setup (the old build differs from itself the same way). The click-everything run passes on normal and stress data.

## Not changed, and why

- **A step still redraws four times:** the skeleton, the period landing (the heavy one, a full mount of the page), the biggest spends and the day's entries. Folding the last two into the landing would mean reading them inside the main load; with the sections memoized, each now costs a small redraw of its own part.
- **The page is still rebuilt on a step.** It shows the skeleton while the next period loads so that one period's figures are never under another's name; keeping the old page mounted and hidden would save the mount but risks state of the heatmap and the cards leaking across periods.
- **Year view** mounts a matrix of every day of the year in one commit (about 150 ms at 6 times slower); lighter cells would change what the matrix is.
- **Nothing on the page animates its layout** (no row slides or exit animations), so the native-layer issues found in Activity do not apply.
