# Plan review (2026-11-12)

Plan is the screen most tied to others: its four tabs draw on Budgets, Savings goals, Loans, Recurring, Upcoming, People, Investments and What-if, and they open each other's sheets. So the review went in three parts. First Plan itself (the four tabs, rendered with real data, amounts shown and hidden, and on a brand-new install). Then each linked screen the same way. Then the numbers that appear in more than one place, which have to agree. Nothing was seen on a device.

## Numbers that appear in several places, and agree

| Figure | Where it appears | |
| --- | --- | --- |
| Due in 30 days, ₹49,797 | Plan header, Runway "Going out", the sum of Upcoming's day totals (₹22,317 + ₹25,000 + ₹2,480) | agree |
| Runway end, ₹3,02,103 | "Now" ₹3,51,900 less ₹49,797 | agrees |
| Debt left, ₹2,00,000 | Plan's Debt tile, the Debt tab, the Loans screen | agree |
| Budget used, ₹5,450 of ₹6,000 | Plan, Budgets, Reports, Home's Food budget (91%) | agree |
| Saved toward goals, ₹15,000 | Plan, Goals (19% of ₹80,000) and Home's goal rows | agree |
| Rent due in 3 days | Home, Plan Upcoming, Recurring "Next due" | agree |

Every empty state on Plan and its linked screens offers the way forward (add an account, a budget, a goal, a loan), and with amounts hidden savings and goal progress are masked wherever they appear.

## Fixed

- **"1 unfinished or overdue goals have no usable monthly target"** (Money plan). The loans line beside it agreed with its count; this one did not. It now reads "1 … goal has … and is excluded" and "2 … goals have … and are excluded".
- **What-if suggested "Rent −10% saves ₹2,500 a month".** The tile took the biggest category that is not a built-in, and rent is not a choice any more than an EMI is. Reports already has a list of fixed categories (Loan EMI, Rent, Insurance, Subscriptions) for "already spoken for"; it is now one shared list ([fixedCategory](../src/lib/fixedCategory.ts)) and What-if uses it for the tile and for the category the sandbox opens on. Every category can still be picked in the sandbox, for someone who really is moving.
- **A late EMI showed only a past date on the Loans screen.** "Next EMI · Tue, 10 Mar" for an EMI 247 days late, while Home, Plan and the widget all say "Overdue by 247 days". The loan card now says it too.
- **Dates with no year where the year matters.** The loan card's next EMI, the pay sheet's "EMI #n · due …", the loan detail's next EMI, a recurring rule's "Next …" and Recurring's "Next due" read "Tue, 3 Mar" for a date next year, or last. They name the year once it is not this year ([weekdayDayMonthMaybeYear](../src/lib/dateLabels.ts), also used for an entry's date).
- **"1 → 3 purchases", "3 → 1 purchases" and "0 of 1 EMIs".** Plural by the figure the sentence ends on.
- **The tabs were missing while Plan loaded.** They appeared with the data and pushed everything down by their height on every cold open. They are on screen from the first frame, as on Reports, with the placeholder under them.
- **A test that was a time bomb.** `LoanCard.test` expected a fixed "5 Oct" next EMI, which became a past date (and so "overdue") as the calendar moved. It now uses a date relative to today.

## For you to decide

- **Home's "Free after bills" does not deduct EMIs overdue from earlier months.** `getStillToPayThisMonth` looks only at EMIs due within the month it is given (its tests say so: "only looks at the month it is given"), so an EMI missed in October stops counting against November's free money, while Plan counts every overdue EMI as due now. In the sample data Home deducts ₹27,480 (rent and this month's EMI); the eight older overdue EMIs are another ₹19,837 that Home leaves out (Plan's ₹49,797 also holds December's EMI, which is not this month's). Counting what is still owed would lower Home's free figure by that amount.
- **Two "in hand" figures.** Home says "₹3,57,500 in hand across 1 account" (accounts with a positive balance only); Plan's runway starts at "Now ₹3,51,900" (every bank, cash and wallet balance, so an overdrawn cash account of −₹5,600 is netted). Both are defensible; they read as one question.

## Looked at and left

- Upcoming's day total (₹22,317) is the exact sum of the EMIs (paise included), while each row shows its whole-rupee amount, so nine rows of ₹2,480 sit under a total of ₹22,317, not ₹22,320. A rounding of the exact figures, not an error.
- "About ₹X a day for N days" on Home and "₹31 a day · 18 days left" on Budgets both count the days after today (see the Home review).
- The Debt-free date is the end of the loan's schedule, which holds only if overdue EMIs are paid up.

## Checks

`PlanScreen.test.tsx` (the tab bar before the data lands; no rent suggestion), `WhatIfScreen.test.tsx` (opens on a choice; rent still pickable), `MonthlyPlanCheck.test.tsx`, `LoanCard.test.tsx` (overdue, year, "1 EMI"), `RuleRow.test.tsx`, `PayInstallmentSheet.test.tsx`, `SpendingExplanation.test.tsx`, `dateLabels.test.ts`, `fixedCategory.test.ts`. Each test that guards a fix fails without it.

## Rendered on a real database, and what jumped (2026-11-13)

Plan was rendered from the real screen in a browser: the app's own database layer (its `expo-sqlite` replaced by SQLite compiled to JavaScript), a dataset built with the app's own write functions (accounts including a card and a tracked fund, three months of entries, budgets, goals, repeating bills, a SIP, two borrowed loans and one lent, two friends), the real Archivo and Fredoka fonts, at 360, 390 and 412 dp, on all four tabs, with taps. Positions were measured in the page and every text that was cut off was listed by script, so each item below was read off a number. The harness lives outside the repository; it approximates Android (text and flex layout are close, gestures and shadows are not).

- **Switching tabs shifted the content.** The first block started 20, about 42, 16 and 28 dp under the tab bar on Overview, Upcoming, Money plan and Debt, because each block carries its own top margin. The gap under the tabs is now set per tab (`TAB_GAP`) and the first block starts 20 dp down on all four (measured: the same card top, 140 px, on three tabs and the Upcoming heading on the fourth).
- **Upcoming's subtitle was a separate line** about 20 dp under its heading, unlike every other heading with a total or a note. It is the section's own subtitle now, and one short line ("Next 30 days"), because beside "Manage recurring" the longer line wrapped at 360 dp and left "30 days" alone on a second line.
- **Picking an Upcoming date moved the dates beside it** by up to 3 dp (the picked pill went bold, so it widened). The pills use one weight; the fill shows the pick. (Measured: identical positions before and after.)
- **"Money plan" wrapped onto two lines when selected at 360 dp.** It fits in its quarter of the track in the regular weight and not in the heavier selected one. The tabs' side padding is 2 dp instead of 6, so the label stays on one line (the shared segmented control, so every screen that uses it benefits).
- **A tile cut its own sentence.** "Shopping −10% saves ₹745 a month" ended "saves ₹745 a…" in the Spend a little less tile at 360 and 390 dp; it has three lines now. Nothing else on any tab is cut off at 360, 390 or 412 dp.
- **Captions split a date or stranded a word:** "free by Feb / 2036", "ends Feb / 2036", "all within / limits". The last two words of those captions are joined (`keepTogether`) so they wrap together.

### Looked at and left

- The "Needs attention" block that appears with overdue payments was not in view in the cleaned-up dataset (only a lent loan is overdue there); it was seen once with 13 overdue EMIs and read fine.
- The two friends' avatars on Overview are 30 dp wide with 2 dp of extra touch on each side (46 tall): small because they overlap. 
- At large text the tabs stack two by two, as before; that layout was not rendered here.

