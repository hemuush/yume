# Neat-and-clean pass: audit report (2026-10-22)

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Goal set by the owner: make the whole app look neat and clean, with proper spacing (not too large, not too small)
and borders that are not too dark. Screens are reviewed one at a time from device screenshots. Verified here by
code review, tsc, eslint, prettier and jest only; nothing has been checked on a device by the author of this pass.

## Rules applied

- Selected tab, pill or chip: one shared half-strength theme fill (`selectedFill` in `src/theme/interactionColors.ts`)
  with normal dark text. Solid theme blocks and navy fills are not used for selection.
- Dark ink is kept for primary actions (Save, Add expense, +, Pay) and on-switches.
- Control heights match inside a row (header buttons 36 or 44, chips 40, keypad keys 46).
- Field and card borders are 1px hairlines (`borderSoft`), not 1.5-2px ink.
- Radii come from `theme.radius` (cards 22, controls 12, pills full).

## Screens and what changed

### Home and Activity (PR #47)

Spacing, borders and selected states; repeated "Today" removed from Recent rows; sheet footer band and hero spacing;
shared SegmentedControl / PeriodPicker / SheetTabs / Chip / PillTabBar; filter chip heights unified (52); Reports
budget cover fix.

### Add transaction and Split payment (PR #48)

- Header: close, Repeat and delete buttons all 44.
- Chips: detail, "Your usual" and usual-amount chips all 40 high and pill-shaped; selected = shared fill.
- Dock: padding 16 to line up with cards; top corners 22; cream background and ink-tinted shadow (was blue-white).
- Keypad: keys use theme surface (was cool grey), radius 12, gap 8.
- Amount card radius 22; "Add more" disabled opacity 0.55; hide-pad button 40 with spacing; invalid-amount message
  shown once, in red, in the card.
- Split: ring 84, calmer "The rest" pill, close button, dock as Add, softer box border, hint margins 16.

### Plan screens (PR #48)

- Debt tab loan icons come from `loanIcon` (bank/home/car) like the Loans screen (was a house for every loan).
- Goal overview and Budget overview sheets: sections flush with the hero card (14px extra indent removed).
- Loan details: "Balance forecast" no longer sits in a second tray.
- Header: Savings goals archive button 36 to match the 36 "+ Add" pill (AddButton min height 36).
- Monthly plan bar uses the theme colour instead of near-black.
- Upcoming "Money out" and date chips use the shared fill.

### Categories (PR #48 and follow-up)

- Colour and icon grids: seven per row, sized from the measured sheet width (an earlier percentage/aspect-ratio
  version collapsed the swatches and made colours unselectable; fixed by measuring).
- Selected colour/icon outline 2px / 1.5px dark grey; parent chips use the shared fill.
- Header archive button is a glass 36 circle; sub-category panel buttons are white with a hairline.
- Text fields and option cards: 1px border (was 1.5px).

### Follow-up in this audit

Found three places still using a solid theme fill for selection: Activity's All/Spent/Income/Transfers tabs, Home's
Coming up chips and the Reports range sheet presets. All now use `selectedFill`.

## Deliberately unchanged

Primary dark buttons, Recurring on-switches, calendar selected day and year/month cells, count badges, Plan tab "+ Add"
light pill (wallpaper header), equal-width 3-column Budgets/Goals grid with an empty slot, Recurring row subtitles.
Other screens still carry ink selected borders (Profile swatches, theme cards, goals follow-option, heatmap cells,
onboarding checkbox); not audited against screenshots.

## Not verified

Device rendering of every change; lighter themes (half-strength fill may read faint); Categories grid layout.
Screens not yet reviewed: Profile and Settings, Notifications, Reports (post-redesign), Accounts, People, Loans list,
Budgets list, Recurring, Wrap, Garden, What-if, Backup.

## Ten-round audit (five reviewers, read-only, then fixes)

Fixed: Infinity% weekend card; range-sheet text colour; "0.0x" day inspector; Activity empty-state on load error; one-digit
amount search chip; Needs-you backup reads isolated; "-₹0"; due dates beyond 90 days show a readable date; one
`compactMoney`; unused fonts and styles removed; far-future prompt on unchanged edits; Split keypad race; calendar
reopen; card-bill currency in Plan; goal milestone note lost when the sheet closes; "1 borrowed loans"; draft card
style; SheetFlow resets when all pages close; selected states unified in Add, Loans and Activity.

Open, reported not changed (need a decision or are larger):

- Editing a split with paise rounds parts to whole units (money correctness; needs care).
- Staged list ignores account currency; Plan debt totals sum raw paise; forecast counts one EMI per loan.
- Garden streak ignores hide-amounts; notification time clock may truncate at 360dp.
- Four theme packs derive the same grey ink; splash colour differs from app background.
- Lone tabbed sheets (Loan details, Rule) now resize on tab change; backup folder is parsed on every launch;
  data repairs run every cold start; Home loads two queries twice; reports recomputes unmemoised.
- Unlabelled switches in goal and loan sheets; Coming up uses "-" not "−"; Activity row labels omit spent/received.
- Radius and border drift (20/24/28 vs 22, 1px vs hairline) in Plan, Loans, Goals; dead Plan compact code.
