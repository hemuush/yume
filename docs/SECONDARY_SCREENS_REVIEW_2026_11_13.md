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

