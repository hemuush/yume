# Spacing and alignment audit (2026-11-12)

A whole-app code pass after two phone screenshots (Home, Activity) showed edges and gaps that did not line up. It checks the shared measures every screen is meant to use; it is not a visual review of every screen on a device.

## The shared measures

- Side gutter: 16 dp (`SCREEN.gutter`). Sheets and dialogs use their own 20 dp inner padding.
- Card corners: 22 dp for summary cards (`theme.radius.xl2`), 18 dp for list cards and tiles (`theme.radius.xl`); 14 dp for buttons, 12 dp for small chips, pills fully round.
- Section rhythm: 16 dp above a section heading, 8 dp from heading to its card.
- Type sizes: 11, 12, 13, 14, 15, 16, 18, 20, 22, then the figure sizes.

## What was off, and the fix

| Where | Off | Now |
| --- | --- | --- |
| Garden (intro, streak summary, error banner, month card, bed card) | 20 dp gutter | 16 dp |
| Loans and Savings goals shared `card` / error styles | 20 dp gutter (Loans' skeleton overrode it) | 16 dp |
| Loan card, loan stat grid, goal list, Plan's Coming up card and upcoming summary, Profile link strip and account tiles, People and Categories tiles, Plan's add tile, Reports' spending explanation, completion card, Export format choices, Notification lines, Activity's loading day card | 16 or 20 dp corners | 18 dp (list card) |
| Split card | 24 dp corner | 22 dp (summary card) |
| Reports' period arrows | 20 dp corner on a 44 dp button (a squircle) | 22 dp, a circle like every other round button |
| Categories collection title, notification slot clock | 17 px (off the scale) | 18 px |
| Next-due widget title | 13.5 px | 14 px |
| Activity's back arrow and Week / Month (earlier today) | 10 dp inside the gutter | on the gutter |
| Home's account tiles (earlier today) | 4 dp extra vertical padding | removed |
| Home's ring, very small slices (earlier today) | overlapping round dots, Free hidden | thin flat bars in their own slots |

## Checked and left as is

- Every tappable control has a role or label and a 44 dp touch area (hit slop or a wrapper where it is drawn smaller).
- Wrap's story player keeps 14 dp sides and 24 dp page padding: it is a full-screen story, not a list screen.
- Chart axis labels and widget captions keep 10 px: they are dense by design.
- Small inner radii (bars, dots, cells) are not cards and keep their own sizes.

## Second pass: sheets and the add-entry flow

- 51 files render a sheet. Sheets pad their content 20 dp, so a card inside one uses `cardInSheet` (no side margin). The investment picker and Update values sheets used the screen card (16 dp side margin) on top of that padding, so their lists were 32 dp narrower than every other sheet's. Both now use `cardInSheet`.
- Every sheet footer lays out Cancel / Save (or its single action) with the shared 8 dp gap; two use `modalFooterStyles` directly and the rest the same values through `f.footerCol` or a matching local row.
- The add-entry screen and Split keep the 16 dp gutter, 18 dp corners on field cards and 22 dp on the summary card; nothing off the shared measures.

## Third pass: every screen

Each of the 26 routes was checked for its header, bottom spacing, gutter, section headings and empty states.

- Header: every pushed screen uses SkyHeader; Home has its own header, and Add, Split, Wrap and Reports draw their own by design.
- Bottom spacing: tab screens clear the floating tab bar (`tabScrollPad + insets.bottom`); pushed screens end with `screenScrollPad + insets.bottom`. Export keeps a pinned footer padded by the inset, and Category detail ends at 48 dp, as recorded before.
- Section headings: hand-made headings (Loans, Categories, Budgets, Backup, People) all use `SECTION_TITLE` with the shared 16 / 8 gaps; the two without a side gutter render inside sheets, which supply it.
- Empty states: screens use the shared EmptyState; short in-card notes ("Nothing on this day.", "No entries yet.") stay as captions. Reports' day picker showed "No matching days" as unstyled platform text with no padding; it now uses the quiet caption style, centred with room around it.

## Fourth pass: icons, padding, shadows, dividers

- Entry rows: Home's Recent activity and the shared transaction row use a 34 dp category mark; Activity's feed used 32 and Reports' category list 32. Both now use `SCREEN.iconTile` (34), and Activity's row hairline starts under the wider mark. Recently deleted keeps 38 because its mark sits inside a days-left ring.
- Card padding: Home's month card pads its sides 16 dp; Activity's Spent strip padded 14 while its own loading placeholder used 16, so it shifted when data arrived. The strip now uses 16.
- Shadows: one lifted hero card per screen shares the same soft shadow; every other card is flat. Consistent.
- Dividers: in-card row dividers use `divider` and card or section edges `borderSoft`, as intended.
- Left as is, by design: the add-entry hero card and footers (16), the Split summary (16), and wide empty cards (20).

## Fifth pass: code and flow

- Dead code (knip): five exports nothing imported (`RING_SIZE`, `UNCATEGORIZED_ID`, `DueTransfer`, `BarPoint`, the animation mock's cancel spy) are no longer exported. Knip also lists `expo-updates`, `xcode`, `@expo/image-utils` and `expo-modules-autolinking` as unlisted: they come with Expo or are used only by build scripts, so nothing to add.
- Promises: every fire-and-forget (`void load()`, `void reload()`, `void tryUnlock()`) calls a function that catches (the screen-load hook, or its own try/catch); nothing can reject unhandled.
- Timers and listeners: every `setTimeout` is cleared or is a one-off wait, and every Animated or accessibility listener is removed on cleanup (`useReduceMotion` is a module-level singleton by design).
- Activity's day layout animation was on for every day all the time; it is now on only just after a group opens or closes, so shifts while scrolling a long list are not animated.
- Bundle: the Android Hermes bundle is 8.3 MB (2,374 modules).
- Size: `app/(tabs)/transactions.tsx` is 1,213 lines and the biggest screen file; its period bar and search bar are the natural pieces to extract next. Left alone now to avoid a large refactor on a working screen.

## Sixth pass: every file, one rule per concern

Each rule was run over all non-test source files (app and src); a hit is listed only if it was a real finding.

| Rule | Result |
| --- | --- |
| Text and TextInput come from the app wrapper, never straight from react-native | clean (only the wrapper itself imports them) |
| No hardcoded "₹" in components (every amount goes through the money helpers, so privacy masking applies) | clean |
| Manual number formatting (`toFixed`, `toLocaleString`) | only rates, file sizes, chart coordinates and timestamps; no money |
| UTC date slicing (`toISOString().slice`) | only database timestamps, which are stored in UTC on purpose |
| List keys by index | only skeletons, fixed day-of-week labels and fixed-length series; no reorderable data |
| FlatList without `keyExtractor` | none |
| TextInput without an accessibility label | none |
| ScrollView with inputs without `keyboardShouldPersistTaps` | none (the custom number pad and the sheet bodies set it) |
| Icon-only buttons without a label | none |
| Loading, error and empty states on all 26 screens | **Investments showed an empty screen while loading**: it now shows the shared summary and list placeholders |
| Section titles as headings for screen readers | **not marked**: `Section` titles ("This week", "Your accounts" and every other) now have the header role, so TalkBack can jump between sections |
| Fixed heights on text-bearing boxes (clipped at large text) | **Activity's date number was a fixed 34 dp tall**: now a minimum, so it cannot clip at 200% text |

## Seventh pass: other places with a visual beside text

After the Home ring turned out to be off-centre, every other screen that pairs a ring, donut, arc or chart with text was checked.

- Hero cards on Loans, Savings goals, Profile (cash), Investments and Budgets are text-led: the figure on the left and facts on the right or below; no centred visual to drift off-centre.
- Split's donut is the leading mark of a row (donut, then text), by design, like a list row's icon. The notification day arc, Runway, Portfolio and Trend charts run the full card width. Garden's pots fill the row and wrap.
- Home's account tiles are a fixed 148 dp (192 at large text), tested. On a very wide phone the third tile nearly fits and ends a few dp past the right gutter; narrower phones show a clear peek of the next tile. Left as is: it is a scrolling row and the sizes are part of the tested design.
- Found: the Home legend's figures were cut to one line with an ellipsis; they now shrink to fit.

## Eighth pass: small details

- Faded states. Disabled controls used 0.4, 0.45, 0.5 or 0.55 opacity, arrows at the end of their range 0.25, 0.35 or 0.4, and pressed states 0.6, 0.65, 0.7 or 0.8. They now come from `theme.opacity` (disabled 0.45, limit 0.35, pressed 0.6), and `src/__tests__/opacityScale.test.ts` fails if a style named for one of those states uses its own number.
- Apostrophes. Copy mixed the straight apostrophe (don't, Suu's) with the typographic one (don’t, Suu’s): about 230 straight against 44 typographic. All user-facing copy now uses the typographic one (the PDF report, which has its own embedded font, and the home-screen widgets are left out), and `src/__tests__/typography.test.ts` keeps it that way.
- Plurals: "1 entries" (a backup with one entry) and "1 reminders scheduled" are now "1 entry" and "1 reminder scheduled"; every other count in copy is either handled or cannot be one.
- Keyboards: search boxes (Find a category, Search report labels, Find a day, Search transactions) no longer capitalise the first letter or autocorrect, and a person's name or a lender's name capitalises each word. `src/__tests__/searchInputs.test.ts` keeps search boxes that way.
- Checked and left: button and title capitalisation (sentence case throughout; "Which Wrap?" is a name), ellipsis characters (none typed as three dots), chevron and icon sizes (they vary by context: 16 in rows, 14 in links, 18 and 20 in headers).

## Ninth pass: tools instead of reading

The earlier passes each took one category and read the code for it. This one used broad tooling over all of `app/` and `src/`, to find what reading misses.

| Scan | Result |
| --- | --- |
| Type-aware lint: `no-floating-promises`, `await-thenable` | **10 floating promises** (screen loads, two searches, two deletes, a refresh after delete and after undo), all handled; none of them could crash, but a failure in them would have been silent. 0 left |
| Type-aware lint: `no-misused-promises` | 68 async handlers passed to `onPress`-style props. Not changed: each handler reports its own failure through the alert or toast, and a typed wrapper around every one of them would only move the same code |
| Refresh callbacks after loan, person and refund changes | Typed as `() => void`, though the screens pass an async refresh. Now `() => void \| Promise<void>`, so the sheet can wait for it |
| SQL | Every helper interpolates only fixed fragments (table, column and order names); every value is bound with `?`. No injection path |
| Dates and money | Month offsets, end-of-month clamping and whole-rupee rounding re-checked against their tests; no drift found |
| Unused files, exports and dependencies (knip) | None. It lists five "unlisted" packages: `@expo/image-utils` (used by the app-icon plugin; it arrives through `expo`), `xcode` and the autolinking binary (build scripts), and `expo-updates` (named by the tool's Expo plugin, not by this project) |
| Cycles | None among 527 modules |

Coverage was 89% of lines. The weakest files that move money or delete data were given tests:

- `MonthPill`: the month and year picker, including the offsets for a past and a future year (10 tests).
- `AddLoanParts`: the term stepper (step, clamp at both ends, pull back from an over-large value) and the option cards (4 tests).
- `PersonDetailModal`, the money flows: money given or received with an account goes to the Friends & Family expense or income category and the right account; "Just adjust balance" writes one signed entry and no transaction; a missing Friends & Family category refuses and says why, rather than filing it under another category; an empty or zero amount asks for a valid one and records nothing (5 tests).

Still thin: the less common branches of the transaction sheet, the delete flow on Categories, Budgets and Recurring screens, the chart scrub hook, the draggable line, and the Suu refresh badge.

No crash-class bug was found by this pass. That is a result of the scans above, not a promise that none exist: nothing here has been run on a device.

## Not covered

Screens other than Home and Activity have not been compared against a phone screenshot after these changes, and the sheets and the add-entry flow were checked in code only, not on a device.
