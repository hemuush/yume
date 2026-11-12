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

## Not covered

Screens other than Home and Activity have not been compared against a phone screenshot after these changes, and the sheets and the add-entry flow were checked in code only, not on a device.
