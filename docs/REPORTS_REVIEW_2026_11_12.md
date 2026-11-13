# Reports review (2026-11-12)

The same check as [Home's second pass](HOME_REVIEW_2026_11_12.md): Reports was rendered with real data in nine states (Overview now and for last month, Breakdown for spending, income and by account, Trends for spending, cash flow and net worth, a year, an empty month, amounts hidden), the figures were cross-checked, and the wording was read for claims that are only true of the current, finished or whole period. Nothing was seen on a device.

## What checked out

- **The figures.** ₹2,788 a day is the spend over the 12 days so far; Kept is income less spending (₹46,550, 58%); the budget line (₹5,450 of ₹6,000) agrees with Food's spending net of its refund; the category rows add up to the total (₹25,000 + ₹5,450 + ₹3,000 = ₹33,450) and so do the account rows; the year's ₹568 a day is its spend over 316 elapsed days; amounts hidden take sensitive spending out of every total, share and chart together.
- **Partial comparisons are mostly honest already.** Breakdown says "So far vs the whole month before" with an explanation sheet; Trends says "so far versus full recorded months"; the cash-flow and category-track lines say "so far". The rest of this review is the places that did not.

## Fixed

- **The net-worth chart called a past month "Now".** Browsing October (or last year), its last point read "Now: ₹X net worth · up ₹Y on Sep". The last point is "Now" only when the window ends in the month in progress ([getNetWorthTrend](../src/db/reports.ts)); otherwise it is that month, like the others.
- **"What moved" said "this month" about a past month.** "It took ₹5,450 this month" on October. It now says "that month" ("that year", or "in the period" for a custom range), and "this month" only for the one in progress.
- **"Front-loaded" could be claimed on the 3rd.** With three days of spending, all of it is in "the first eight days", so "100% in 8 days: most of the month went out in its first eight days" was true of any month's first week, and of any trip shorter than eight days. It now needs a day after the first eight to compare them with.
- **"74% of the month in one day" while the month was still going.** It is 74% of what has been spent so far. In progress it now says "of the month so far".
- **The summary's income change was not marked partial.** "↓ 40% vs the month before" mid-month, before a salary has arrived, set income so far against all of last month. In progress it reads "↓ 40% so far vs the month before".
- **A category with nothing in a past month said "yet".** "Nothing in October yet." now says "yet" only while the period is still going.
- **The loading placeholder did not match the page.** Two blocks of 290 and 150 dp, 8 dp narrower than the cards and without the 12 dp top gap, for an Overview whose summary card is about 124 dp and whose calendar card is about 440. They are now those sizes, the cards' width and the same gap. The heights are estimates from the layout constants, not measured.

## Looked at and left

- **The percentage on each category or account row is rounded on its own**, so a breakdown can read 82% + 13% + 4% = 99%. The amounts are made to add up; the shares are not. Left as is: nothing on screen adds them.
- **"Your usual day"** is the average over the days so far, rent and EMI days included, so on a month with one big bill most ordinary days are well under it, and a day at "1.2× your usual day" can be an ordinary one. It is the definition used by the heatmap, the inspector and the "big day" mark; changing it to a median is a product decision.
- **Net worth moved ₹1,000 more than the month's kept money** in the sample data. Net worth also counts loans and what people owe, so a difference is expected; the sample's source was not traced.

## Checks

`reportsInsights.test.ts` (the share's wording, front-loaded on the 3rd, the 8th and 9th day and a short trip, "that month"), `ReportHero.test.tsx` (so far), `networth.scenarios.test.ts` (the last point's label), `CategoryScreen.test.tsx` ("yet"), `ReportsSkeleton.test.tsx`. Each new test fails without its fix.

## Rendered on a real database (2026-11-13)

Reports was rendered from the real screen in a browser on a real database (the app's own db layer on SQLite compiled to JavaScript, built with the app's own write functions: nine months of entries, daily spending for 75 days, budgets, income, a refund), with the real fonts, at 360, 390 and 412 dp: Overview, Breakdown (spending, income, expanded), Trends (spending, cash flow, net worth), a past month, a custom range and an empty month. Positions were measured and every cut-off text was listed by script. The harness lives outside the repository and approximates Android; the sheets (period picker, day sheet) need native pieces it lacks and were not rendered.

- **The Income caption took three lines at 360 dp** ("↑ 8% so far vs / the month / before") and made the card taller. The three columns are no longer equal: Income has the most room, and the caption takes two lines while "48% of income" stays on one at 360, 390 and 412 dp (measured).
- **Cash flow's third figure sat lower than the other two.** Its label, "Left after spending", took two lines and pushed the figure down. It is "Kept", as on Overview (the same figure had two names), and the three share a baseline.
- **Two phrases stranded words:** "Kept ₹41,530, 48% / of it." and, in the Trends rows, "₹18,000 so far · usual / ₹18,000". The last words of each stay together.
- **Date ranges split in the middle:** "Your longest run was 33 days, Jan 1 – / Feb 2." and the comparison line "1 Oct – 12 Oct vs 1 Sept – 12 Sept". Each range is one unbreakable piece now (`noBreak`).
- **The comparison note** ("So far vs the whole month before ⓘ") was 36 dp tall to touch; it is 44.

### Looked at and left

- **A future-dated entry is counted in "Spent so far" and left out of the Trends chart.** With two entries dated later this month the Overview read ₹44,870 and the Trends caption ₹40,870 (the gap was exactly those two); with them dated today the two agree. Future-dated entries are rare (Add asks first), and which total is right, "so far" or "this month", is a decision.
- Breakdown puts its Spending | Income switch inside the card, and Trends puts its three-way switch above its card as a band. The same kind of control, placed two ways.
- Net worth uses Western digit grouping in the harness only because the browser's locale was en-US; the app groups by the phone's locale.

