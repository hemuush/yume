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

## Not covered

Screens other than Home and Activity have not been compared against a phone screenshot after these changes, and the add-entry flow and the 50 sheets have not been reviewed visually.
