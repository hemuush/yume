# Goals, Budgets, Loans and Recurring, and Activity's filter row (2026-11-13)

Raised from device screenshots of Savings goals, Budgets, Loans and Recurring ("looks odd and not matching with the current app") and of Activity's filter row. The four screens were rendered in a browser from the real screens on a real database, with a dataset shaped like the owner's (an over-saved goal, three HDFC loans, seven recurring rules with long subtitles), at 360, 390 and 412 dp, and compared with Home, Plan and Activity by measurement (card and heading edges, the font of each row title, amount and caption). The harness approximates Android and lives outside the repository; nothing here was seen on a phone.

## What made them look like a different app

- **Recurring's cards sat at twice the gutter.** The scroll area padded the page 16 dp a side while the shared cards carry their own 16 dp margin, so the summary and the lists were at 32 dp under headings ("Running", "Biggest first") and a footnote at 16 and 20. Every other screen puts the cards at 16 with the headings on the same edge. The page no longer pads; the heading, the notes and the error banner bring the gutter themselves. On a 360 dp phone the extra 32 dp also squeezed each rule's text into a column about 100 dp wide (four and five line subtitles). `screenGutter.test.ts` reads every screen that uses the shared cards and fails if one pads its scroll content sideways again.
- **Row titles and amounts were in a different weight from the rest of the app.** Home, Activity and Plan write a row's title and amount in `bodyMedium` (Archivo 600). Goals and Loans wrote the name in the rounded display face (Fredoka), and Budgets, Recurring and Goals wrote titles and amounts a weight heavier (Archivo 700). All four now use the shared one (`listRowFonts.test.ts`). Figures that are a card's headline (a loan's principal, the summary figure) and status words ("Ahead of pace", "Pay") keep their own weight.
- **A rule's subtitle broke anywhere.** "Every month · Next Tue, Dec 1 · Home · From SBI" was one paragraph, so a date split ("Next Tue," / "Dec 1"), a separator ended a line, and "Play" stood alone. It is two lines now, when it runs and then where it comes from, and each wraps between its pieces, never inside one (a short piece is kept whole, a long account name keeps its last two words together).
- **Savings goals' title was cut to "Savings goa…" on a 360 dp phone.** The header keeps room for a summary that only shows once the page scrolls, and that invisible summary took a fraction of a point from the title, which is enough for an ellipsis. The title no longer shrinks for it; the summary gives way. This is shared by every screen with that header (Recurring, Budgets, Loans, People and others), so a long title with a long figure is safe on all of them.

## Activity's filter row

The filter chips were in front of the type pills (Filters, then every picked category and account, then All, Spent, Income, Transfers). With eight picked, the pills were pushed off the screen. Everything picked now follows the types: Filters, All, Spent, Income, Transfers, then a removable chip per pick, and Clear all last. Picking anything, in any number, only adds to the end of the row, so the types never move or leave the screen. The earlier change that moved Clear all behind the types left the chips where they were; that was incomplete, as the screenshot showed.

## Seen and left

- **Goals' round button** shows "+" (add money) on a goal you fill by hand and two arrows (a transfer into the followed account) on a goal that follows an account. It is unlabelled and the arrows read as "repeat"; it is correct, but it is the one control on these screens whose meaning has to be guessed.
- **An over-saved goal** shows "₹2,35,000 / ₹2,30,000", while the summary above counts it at its target, so the rows add to more than the summary's "Saved toward goals" and the percentage reads 98% with a goal "Reached". Both are right for what they count; nothing says why they differ.
- **"Ahead · ₹2,181/mo"** says a goal is ahead of pace and also what it still needs a month; the figure is what staying on pace takes, not a shortfall.
- **At 360 dp** a rule's schedule can wrap at its separator ("Every month ·" over "Next Tue, Dec 1"), leaving a dot at the end of a line; the pieces themselves are never split.
- Loans' separate cards (each with a 44 dp Pay button) are taller than every other list on these screens; they are the one place this group is not a single flat list card.

## Checks

`screenGutter.test.ts`, `listRowFonts.test.ts`, `SectionHead.test.tsx`, `RuleRow.test.tsx` (the two lines, the pieces), `SkyHeaderMotion.test.tsx` (the title does not shrink for the summary), `ActivityFilterChips.test.tsx` (what is picked follows the types, however many) and `DimmedControls`-style checks from the Add review. Each new test that guards a fix fails without it (checked by removing the fix). The suite needs `LANG=en_IN.UTF-8`, as CI sets.

## The other screens (People, Investments, Backup, Export, Recently deleted, What-if, Category detail, Garden)

The same method (the real screens in a browser on a real database, at 360, 390 and 412 dp, positions and cut-off text listed by script) over the screens not yet compared. Backup, Category detail and Garden needed nothing. Themes cannot be rendered in the browser (it needs the phone's app-icon module), and Split is a sheet, which the browser does not render; both were read in code only.

### Fixed

- **People: "Owes you" and "You owe" sat at the far right of the screen, away from their colour dot.** The heading row was built for a title with a note on the right (`space-between`), so with a dot and a title the dot went to the left edge and the title to the right. They sit together now.
- **Investments and Recurring started 8 dp lower than every other screen.** Both padded the page by the top gap and their first card carries the top gap too (the same double count as Recurring's side gutter). The first card is at the same height on Budgets, Goals, Loans, People, Backup, Tidy up, Notification settings, Investments and Recurring (66 dp in the browser).
- **A monthly SIP's caption broke its date** ("next Sun, Nov" over "22"). The caption is glued by piece (`gluePiece`, which Recurring's rows now share) so it wraps between pieces only.
- **Recently deleted hid the date and the time left behind a long note.** The caption was one line of text cut at two lines: "Headphones from the sale th…", with the date and "30 days left" gone, and "30 days" splitting from "left" even when they showed. It is two lines now: what it was (cut at one line if it is long), then when and how long it stays, each piece whole.
- **What-if had "Can I afford it?" twice** (a section heading, then the card's own title directly under it). The section reads "Before you buy".
- **Export had a second title and a heading in a different place on each step.** An icon tile and "Export your entries" in the content repeated the header's "Export" (no other screen has such a block); the hint now sits under the header as on What-if and Suu's garden. "1. Choose a period" was inside its card and "2. Choose a file type" above its cards, and both were in the rounded display face; both are above their blocks, in the type every other section heading uses.

### Seen and left

- Garden's day cells are 39 dp wide at 360 dp (seven to a row); a calendar grid cannot be wider on that phone, and the screen is a decorative flow.
- What-if's chips are 32 dp tall with the shared Chip's touch slop (48 dp to touch).
- Themes and Split were not rendered, only read.

Tests: `people.styles.test.ts`, `captionPieces.test.ts`, `keepTogether.test.ts` (`gluePiece`), `RecentlyDeletedScreen.test.tsx` (two lines, a long note), `RuleRow.test.tsx`. Each new test fails without its fix.

## Whole-repo audit follow-up

A read-only audit of the whole repository (data layer, backup and restore, reminders, CI, then a browser render of every screen at 320, 360 and 412 dp and 1, 1.3 and 2 times text on extreme data) found five things. All five are fixed, each with a test that fails without it.

- **A test I added in the previous commit broke 126 others.** It restored its `AppState` spy, which also cleared React Native's own mocked `addEventListener`, and it ran before the groups that need it. It now sits at the end of `screens.smoke.test.tsx` with a comment; the file passes (144 of 144).
- **Reports' three tabs shared the track in thirds**, so at 2 times text "Breakdown" was wider than its third. Past 130% the switch now stacks two to a row, the way Plan's four tabs already did; that stacked layout moved into `SegmentedControl` (`stacked`), and `PlanNavigation` is a thin wrapper over it. Other switches (Add's type, Export, Backup, Investments, Trends) can opt in the same way; none was seen to break.
- **Plan's runway dates printed over each other** on a 320 to 360 dp phone at 2 times text (the weeks sit 56 to 67 dp apart, a date needs about 77). The Overview's ribbon and Forecast details' chart now share `runwayTicks` ([runway.ts](../src/features/plan/runway.ts)), which leaves out a date closer than six characters to the last one shown. At 1 and 1.3 times text all four stay. In the same card, Now / Going out / Coming in / On (date) broke "Coming in" inside the word at 2 times text; on a narrow phone or at large text they go two to a row.
- **The "narrow phone or large text" rule was copied 15 times** (`width < 360 || fontScale > 1.2`). It is `useStacked` now, and `stackRule.test.ts` fails if a component writes it out again. Left as they were, because they differ on purpose or I could not tell: Add's amount card and Activity's period row (380 dp, 1.15), Plan's status tiles (340 dp, 1.3), the Home legend and the Reports summary strip (own font-scale constants), and the dialog buttons.
- **Recently deleted drew every row at once.** A big tidy-up can leave thousands. It draws a hundred and offers "Show 100 more"; the count, "Oldest leaves in" and Delete all still cover every entry (the list is not cut in the database, so nothing becomes unreachable).

Seen in the browser and not a fault: Recurring's rows at large text overlapped there only because the browser reads `flex: 0` as a zero starting size; Android reads it as "size by content". Not checked on a phone.

### Second pass: the sheets, at 2 times text

Every sheet and dialog (filter, entry details, budget, goal, loan, recurring, person, category, account, investment) was opened in the browser at 360 and 412 dp, at 1, 1.3 and 2 times text. It found five more faults at large text, all fixed with a test that fails without the fix, and one mistake of mine on the way (a hook placed after an early return, which crashed Entry details when it opened; `TransactionDetailModal.test.tsx` now opens it from nothing).

- **Switches of three or more choices squeezed each label into its share of one row.** Activity's filter Type row (five choices) ran together from 130% text on a 360 dp phone; "Expense / Income / Transfer" and Reports' tabs from 200%. `SegmentedControl` and `SheetTabs` now work out whether the longest word fits (`tooTight` in [tooTight.ts](../src/lib/tooTight.ts): letters at about 6.8 dp, the text scale, the window width less 48 dp) and, if not, lay the choices two to a row. Two choices never stack. It is an estimate from the window, not a measurement of the track (marked `shortcut:` in the code).
- **Entry details' three actions ("Log today", "Recurring", "Refund") clipped "Recurring"** at 200%. Past 130% each gets its own row.
- **The budget sheet's category tiles split names mid-word** ("Entertainm" over "ent") at 200%, because the grid kept four columns. Past 130% text, where the names stop shrinking to fit, the grid uses fewer, wider columns (`CategoryPicker`; this also covers Add, Split and the recurring form).
- **Account details' "Out" and "Net" split into "O / ut" and "N / et"** at 200%: the label column was a fixed 30 dp. It grows with the text.
- **Loan setup's "I borrowed / I lent" cards** broke "borrowed" at 200%. Past 130% they sit one above the other.

At 1.3 times text the category tiles looked split in the browser too, but they shrink their names to fit on a phone (the browser cannot show that), so only the sizes above 130% were treated as faults.

### Third pass: what the first two had missed

- **CI does not run on a feature branch** (only on pushes to main and on pull requests), so the branch's commits had not been through its CI-only steps. Run here: `expo export --platform android` bundles; `expo prebuild` plus `check:native` ("Native configuration looks right"); the audit gate finds no high or critical advisory; `expo-doctor@1.21.6` passes 18 of 20 checks, and the other two (the config schema and the React Native Directory) need `exp.host`, which this sandbox cannot reach. `expo prebuild` rewrites the `android` script in `package.json`; that edit was reverted.
- **Dates split across two lines.** A script now opens every screen and sheet at 1.3 and 2 times text and finds a month followed by a day or year that wraps ("Nov" over "16"). It found Recurring's preview card ("next Mon, Nov / 16"), the Pay EMI sheet ("due Wed, Nov / 25"), Plan's runway line ("on Sun, Nov / 22"), Reports' tapped-day heading, the budget overview ("Nov / 2026") and the goal card ("by Mar 13, / 2027"). Each date is glued with non-breaking spaces (`noBreak`, `gluePiece`). Export's large "November / 2026" title is left: two words of a display heading may break between them.
- **Wide screens.** The app is portrait-only, but Android 16 ignores that on tablets and unfolded foldables. At 600 and 840 dp every main screen renders without a fault, stretched to the full width. A maximum content width is a design decision and has not been made here.
- **The browser harness** read `flex: 0` as a zero basis, which drew Recurring's rows over each other; it now reads it as Android does. With that, Recurring and its rule sheets were rendered at large text for the first time: no fault beyond the dates above.

### Fourth pass: sheets standing above the bottom of the screen

A device screenshot (Reports' day sheet on a Samsung phone with three-button navigation) showed the sheet ending about 99 dp above the bottom, with the dimmed page, the tab bar and the navigation buttons under it. An earlier screenshot of the Activity filter sheet showed the same, so it is every sheet.

What the screenshot says: the screen is 2424 px tall (about 2.63 px per dp); the sheet's bottom edge is at 2165 px, so 259 px (98.6 dp) above the bottom. That is the status bar plus the navigation bar, to within a pixel or two: the sheet is laid out in an area of the screen's height less the two bars. The backdrop does cover the whole screen, so the window itself is full height.

What is established and what is not. The two sheet layouts are `ModalSheet`'s framed one (a header, a scrolling body; the default, which Reports' day sheet uses) and the plain one. The keyboard-avoiding wrapper is only in the framed one and was already off unless the keyboard is up (previous pass), so it cannot explain a lift with the keyboard down. Nothing here was reproduced on a phone: the cause is not confirmed. Three measures cover the three suspects, and a phone has to say whether they are enough:

- **Keyboard padding** (the earlier fix): the library's wrapper only pads while the keyboard is really up.
- **A Reanimated entering animation on the sheet surface** (added in the 11 November motion pass, the time the screenshots started): a Modal is its own window whose content is laid out twice, and a layout animation can keep the first frame. The surface is a plain View again; `sheetSurface.test.ts` keeps a layout animation off it. The sheets no longer rise; the Modal's own fade brings the backdrop and sheet in together.
- **A short content area**, whatever made it short ([Reanimated #6659](https://github.com/software-mansion/react-native-reanimated/issues/6659) describes one way a Modal ends up the wrong height under the New Architecture): `ModalSafeArea` compares its first layout with the screen and, only when it is short by exactly the status and navigation bars, gives the content the screen's height. A smaller window (split screen) does not match and is left alone. Remove it once a phone shows sheets reaching the bottom without it.

If the sheet still stands above the bottom after this, the numbers above (and which sheet, whether the keyboard was used before it, the build) say which of the three is left.

