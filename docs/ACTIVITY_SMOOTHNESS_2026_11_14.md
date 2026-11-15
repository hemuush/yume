# Activity smoothness and code structure (14 November 2026)

A second pass on the Activity screen after it still felt laggy on a phone. Nothing here was run on a phone: the browser render (react-native-web, a real SQLite database, React in production mode, the CPU slowed 6 times) shows how much JavaScript each tap costs, but it has no native animation layer, so two of the three changes below rest on Reanimated's own source and on tests, not on a measurement. Please check them on a device ([release device checks](RELEASE_DEVICE_CHECKS.md)).

## What was measured

Each interaction on a typical ledger (about 100 entries over 75 days) and on a busy one (3,000 extra entries), at 6 times slower CPU, with React's production build. The figures are the longest single stretch of JavaScript a tap caused, and how many times React committed. They vary by about a quarter from run to run, so only differences larger than that mean anything: removing the last commit (change 1) is visible as one commit fewer, but its effect on the longest stretch is inside that noise.

| Interaction                      | Longest stretch | React commits (over 4 ms) |
| -------------------------------- | --------------- | ------------------------- |
| Previous or next week            | 190 to 680 ms   | 4 to 10                   |
| Previous or next month           | 280 to 710 ms   | 4 to 11                   |
| Week to Month, Month to Week     | 110 to 390 ms   | 3 to 10                   |
| A type chip (Spent, Income, All) | 100 to 270 ms   | 1 to 2                    |
| Insights, month picker, an entry | 50 to 190 ms    | 2 to 5                    |
| Search: each letter typed        | under 110 ms    | 1 each                    |
| First visit to the tab           | 800 to 1,300 ms | 3                         |

The low end is the typical ledger and the high end the busy one. "Longest stretch" is the longest single task the browser reported, which also includes the in-browser database read that on a phone runs off the JavaScript thread, so the real figure is lower.

Stripping every per-row wrapper (the sliding row, the draggable line, the glow) made no measurable difference to these, and keying the list by period (so each period mounts from scratch in small batches) made them worse. Neither was kept.

## What changed

1. **No redraw after a period lands.** The days that mount as a period arrives fade in for 400 ms; turning that off was a state change, so the whole screen redrew once more after every period step with nothing on it different (25 to 45 ms of that at 6 times slower). It is a ref now ([useActivityLedger](../src/features/transactions/useActivityLedger.ts)); a test counts the commits and fails with the old code.
2. **A day that holds a group no longer slides its lines.** Opening a group changes its panel's height every frame. The lines below it each had a slide into place (`MovingRow`'s layout transition), and Reanimated starts a new slide whenever a line's position changes (`LayoutAnimationsProxy::handleUpdatesAndEnterings`), so every line below chased the panel's edge a few frames behind: overlapping it as it opened, leaving a gap as it closed. This is the likely reason the group's open and close never looked right even once its height animated. Days without a group still slide when an entry above goes or comes ([TimelineDay](../src/features/transactions/TimelineDay.tsx), `slides`).
3. **A day that leaves does not play each line's exit first.** When a whole day is removed (the period changed, or the list scrolled it out of its window), Reanimated keeps the removed subtree on screen until every exit animation inside it has finished (`startAnimationsRecursively`), so the old days sat over the new ones for 150 ms, with an animation per line. `LayoutAnimationConfig skipExiting` on the day turns that off. Deleting one entry still fades that row out.

Tests: `TimelineDay.test.tsx` (how a day's lines move; fails without 2 and 3), `TransactionsScreen.test.tsx` (the screen does not redraw when the days have finished arriving; fails without 1).

## What the browser render cannot show

Changes 2 and 3 act on the phone's native animation layer, which the render replaces with a stand-in. The code path was read in `react-native-reanimated` 4.7.1 (`Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp`, `src/component/LayoutAnimationConfig.tsx`); no frame was recorded. If a group still looks off when it opens, record a screen capture of it: the next suspect is the height animation itself writing layout props each frame.

## Code structure

`app/(tabs)/transactions.tsx` went from 1,264 to about 930 lines by moving whole concerns out, each now with its own tests; the screen keeps the period, filters, links and the list.

| Piece                                                                                          | Owns                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [useActivityLedger](../src/features/transactions/useActivityLedger.ts)                         | The entries, accounts, categories and totals of the period; the load, newest-wins; the arrival window             |
| [useActivitySearch](../src/features/transactions/useActivitySearch.ts)                         | Search mode: the debounced query, newest-wins results, recent searches, the back button                           |
| [useDayJump](../src/features/transactions/useDayJump.ts)                                       | Jumping the list to a day from a chart bar, and the one retry when the list has not measured that far             |
| [ActivityPeriodBar](../src/features/transactions/ActivityPeriodBar.tsx)                        | The ‹ This week › pill and the Week \| Month switch                                                               |
| [useDayReorder](../src/features/transactions/useDayReorder.ts)                                 | Hand-ordering inside one day (lift, drag, drop, Move up / down)                                                   |
| [TimelineDay.styles](../src/features/transactions/TimelineDay.styles.ts)                       | The day's styles                                                                                                  |
| `searchSuggestionsFor`, `laneKey` in [transactions.helpers](../src/features/transactions/transactions.helpers.ts) | Pure helpers that were inline in the screen and the day                                                           |

The refactor was checked against the version before it: 15 Activity states (week, scrolled, both steps, a filter, a group open and closed, month and back, Insights, the month picker, search open, typed and closed) are identical pixel for pixel.

## Considered, not done

- **Mounting the other tabs early.** Activity's first visit costs about 900 ms of JavaScript at 6 times slower while the tab's own fade runs. Mounting it ahead (after Home has settled) would move that cost to an arbitrary moment on Home. A trade, not a gain; left for a device check.
- **A smaller list window or smaller days.** Needs a device to find the point where fast scrolling starts to show blank space.
- **Test environment.** Run the suite as CI does (`LANG=en_IN.UTF-8 LC_ALL=en_IN.UTF-8 TZ=Asia/Kolkata`): without it 42 tests that expect Indian digit grouping fail, whatever the code.
