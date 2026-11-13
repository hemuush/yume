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
