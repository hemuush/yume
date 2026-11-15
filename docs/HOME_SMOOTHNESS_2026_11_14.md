# Home smoothness and code structure (14 November 2026)

The Activity pass ([smoothness](ACTIVITY_SMOOTHNESS_2026_11_14.md)) found that most of what feels slow is a whole screen redrawing for a change that touches one part of it. Home had the same shape, so it was measured and changed the same way. Nothing here was run on a phone: the browser render (react-native-web, a real SQLite database, React in production mode, the CPU slowed 6 times) shows the JavaScript cost of each tap, not native frames.

## What was measured

Each interaction on a typical ledger (about 100 entries), at 6 times slower CPU, three runs each before and after. Runs vary by about a quarter, so only differences larger than that mean anything.

| Interaction                                  | Before                                      | After                                       |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Open an account's summary                    | 150 to 190 ms to first change, 230 to 270 ms longest stretch | 70 to 80 ms, 140 to 150 ms                  |
| Close it                                     | 115 to 135 ms                               | 25 to 50 ms, no long stretch                |
| Open an entry from Recent activity           | 150 to 190 ms, 200 to 250 ms longest        | 60 to 70 ms, 110 to 140 ms                  |
| Close it                                     | 105 to 120 ms                               | 25 ms, no long stretch                      |
| Reload in place (an entry saved elsewhere)   | 3 redraws of the page, 80 to 125 ms each    | none, when nothing on the page changed      |
| Step to another month                        | first redraw 85 to 125 ms, 4 to 5 redraws   | first redraw 65 to 70 ms, 4 to 5 redraws    |
| First open of the tab                        | about 1 s                                   | about 1 s (not changed)                     |

Where the time went: every one of Home's roughly thirty pieces of state lived in one 886-line component, so opening a sheet, a flag turning over or a reload that found the same data each redrew the month card, the accounts, Coming up and Recent activity, about 100 to 150 ms of the 6 times slower CPU each time. A probe that listed what changed in each render showed six renders at first open and three on a reload, two of them for nothing: a flag that turns the opening fade off 800 ms after the first load, and a list of "things that need you" that was replaced by an identical one.

## What changed

1. **Sheets are outside the page's state** ([homeSheetsStore](../src/features/home/homeSheetsStore.ts), [HomeSheets](../src/features/home/HomeSheets.tsx)). Which of an account's summary, the edit form, an entry's detail and the new-account form is open is a small store the sheets subscribe to, as Activity does for its groups. Opening or closing one redraws the sheets and nothing else.
2. **Two redraws for nothing removed.** The opening fade is read from the animation module's own flag (set by a timer, no state). Only the count of things that need you is held, so a refresh that found the same number changes nothing.
3. **A reload keeps what it did not change** ([useHomeData](../src/features/home/useHomeData.ts), the shared [stableData](../src/lib/stableData.ts) helpers that Activity uses too). Lists that came back identical stay the same objects.
4. **The page's sections compare their props** (the header, the month card, accounts and Coming up are `memo`ed where the page uses them; Recent activity is [its own memoized section](../src/features/home/HomeRecentActivity.tsx)), and every prop they are given keeps its identity until what is in it changes: handlers are stable, the card's trend, recaps, today and pace are memoized, accounts are reduced to the names and currencies the sections say (a balance that moves with every entry no longer redraws Coming up), and the entrance animations are shared objects instead of new ones per render.

Tests: [HomeScreen.test.tsx](../src/screens/HomeScreen.test.tsx) renders Home on a real database and counts the sections: a sheet opening, the opening fade ending, a reload that found nothing new, a saved entry (the card and accounts redraw, Coming up does not) and a month step (the accounts and Coming up do not) all fail on the old screen; it also covers what Home shows, opening an entry and a summary, the error and Try again, and archived accounts. `homeSheetsStore.test.ts`, `useOpenRefund.test.tsx` and `stableData.test.tsx` cover the new pieces.

## Code structure

`app/(tabs)/index.tsx` went from 886 to about 500 lines, `ThisMonthHero.tsx` from 605 to about 420.

| Piece                                                                        | Owns                                                                                                  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [useHomeData](../src/features/home/useHomeData.ts)                           | Everything the page reads, its loading (newest wins), the reload on a save, a new day and returning to Home |
| [useOpenRefund](../src/features/home/useOpenRefund.ts)                       | Opening the purchase behind a pending refund: one at a time, dropped on leaving                       |
| [homeSheetsStore](../src/features/home/homeSheetsStore.ts), [HomeSheets](../src/features/home/HomeSheets.tsx) | Which sheets are open, and the sheets themselves                                  |
| [HomeRecentActivity](../src/features/home/HomeRecentActivity.tsx)            | The Recent activity card                                                                              |
| [useHeroTurn](../src/features/home/useHeroTurn.ts)                           | The month card's turning of its page (old figures out, new in) and its sideways drag                  |

The change was checked against the version before it: 15 Home states (the sum open and closed, a slice picked and cleared, each Coming up filter, the period picker, October and back, an account's summary, an entry, after closing, after a reload) are identical pixel for pixel; the click-everything run passes on normal and stress data.

## Not changed, and why

- **A month step still redraws 4 to 5 times.** The month card keeps a copy of what it shows so the old figures can slide out before the new ones slide in; that is by design and each of its redraws is the card's own. Cheaper steps would mean changing how the card turns its page.
- **The first open of the tab** (about 1 s of JavaScript at 6 times slower) is the skeleton and then the full page; unchanged.
- **Home's layout transitions** (each section and each recent row slides when something above changes height) act on discrete changes, not on a height that moves every frame, so the trailing seen in Activity's groups does not apply. Not measured on a device.
