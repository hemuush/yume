# People, Investments, Categories, Profile, Notification settings, What-if and Goals smoothness (15 November 2026)

The same method as [Activity](ACTIVITY_SMOOTHNESS_2026_11_14.md), [Home](HOME_SMOOTHNESS_2026_11_14.md), [Reports](REPORTS_SMOOTHNESS_2026_11_15.md), [Plan](PLAN_SMOOTHNESS_2026_11_15.md) and [Loans, Recurring, Budgets and Add](LOANS_RECURRING_BUDGETS_ADD_SMOOTHNESS_2026_11_15.md): measure each interaction, find where the time goes, change that, and check nothing visible moved. Nothing here was run on a phone: the browser render (react-native-web, a real SQLite database, React in production mode, the CPU slowed 6 times) shows the JavaScript cost of each tap, not native frames.

## What was measured, and what was left

Every interaction of the remaining screens was run once on the version before this pass to find which cost something. At 6 times slower CPU, in the order of what React spent drawing (the commits over 4 ms):

| Screen | Cost found                                                                                                                  | Done |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| People | Opening a person 244 ms, closing it 64 ms, a digit typed in the person's sheet 39 to 75 ms                                   | yes  |
| Investments | Adding an investment 207 ms, closing a sheet 33 to 83 ms, switching the trend's stretch 28 to 59 ms                     | yes  |
| Categories | Opening a parent 140 ms, closing a sheet 55 to 100 ms, the new-category form 121 ms                                      | yes  |
| Profile (You and Settings) | Each in-place control on Settings 25 to 90 ms (the whole 600-line page redrew), an account's sheet 135 ms   | yes  |
| Notification settings | One switch: two or three redraws, 44 to 238 ms                                                                   | yes  |
| What-if | A chip 28 to 66 ms (the purchase check below it redrew each time), "N more" 56 to 116 ms                                 | yes  |
| Goals | Closing a sheet 16 to 96 ms, a reload redrew every goal                                                                    | yes  |
| Export, Recently deleted | A format radio 27 to 65 ms, "Restore" 77 ms in three redraws                                                        | not changed |
| Backup, Garden, Tidy up | **Not measured.** Backup never finished loading in the browser harness; the Garden's day taps showed no change there; Tidy up has too little on the seeded data | not measured |
| Themes, Wrap, Category detail, Split | **Not measured** (no interaction matrix was written for them)                                                | not measured |

Export and Recently deleted were below the other screens' costs and were left alone.

## Results

Three runs of a matrix, or (marked A/B) eight repeats alternating the old and the new build and taking medians, because single runs vary by about a quarter. The figures are how long React spent drawing.

**People**

| Interaction                         | Before             | After                |
| ----------------------------------- | ------------------ | -------------------- |
| Close a person's sheet              | 64 ms              | no redraw            |
| A digit in the person's amount      | 39 to 75 ms        | 19 to 56 ms          |
| Pick an account or "Settle" chip    | 25 to 50 ms        | mostly 10 to 25 ms   |
| Open a person                       | 155 + 89 ms        | within the spread (the sheet mounting) |

**Investments** (A/B)

| Interaction                 | Before          | After          |
| --------------------------- | --------------- | -------------- |
| Open "Add an investment"    | median 128 / 129 ms | median 93 / 71 ms |
| Close it                    | median 76 / 59 ms   | median 36 / 38 ms |
| Open "Update values"        | median 80 / 66 ms   | median 54 / 47 ms |
| Close it                    | median 52 / 46 ms   | median 25 / 31 ms |
| Switch the trend's stretch  | 28 to 59 ms     | 5 to 19 ms     |
| Close a holding's summary   | 33 to 83 ms     | no redraw      |

**Categories**

| Interaction                  | Before            | After              |
| ---------------------------- | ----------------- | ------------------ |
| Close the new-category form (A/B) | median 95 / 62 ms | median 25 / 50 ms |
| Open it (A/B)                | median 104 / 81 ms | median 53 / 86 ms (the same) |
| Open a parent's panel        | 86 + 11 + 72 ms   | 41 + 11 + 41 ms    |

**Profile, the Settings tab**

| Interaction                       | Before        | After             |
| --------------------------------- | ------------- | ----------------- |
| Open the currency list            | 34 to 39 ms   | 5 to 51 ms        |
| Close it                          | 24 to 26 ms   | 0 to 6 ms         |
| Open the daily goal               | 46 to 78 ms   | 37 to 48 ms       |
| Close it                          | 23 to 25 ms   | no redraw         |
| The widget switch                 | 56 to 160 ms, two redraws | 25 to 45 ms |
| Open About                        | 59 to 90 ms   | 6 to 12 ms        |
| Close About                       | 73 ms         | 0 to 6 ms         |
| Close an account's sheet (You)    | 7 ms          | no redraw         |

**Not improved on Profile: switching to the Settings tab.** Six runs alternating the old and the new build gave a median of 137 ms before and 152 ms after, with samples that overlap (100 to 216 before, 115 to 259 after). The cost is the 400-line page mounting, and it is no better. A first attempt at finding where a possible 10 to 20 ms increase came from (building variants with the old pieces put back) was inconclusive at this noise. Opening an account's sheet from You is also unchanged (the sheet mounting).

**Notification settings**

| Interaction     | Before                           | After           |
| --------------- | -------------------------------- | --------------- |
| One switch      | two or three redraws, 44 to 238 ms | one redraw, 15 to 39 ms |
| A time step     | three redraws, 65 to 198 ms      | one redraw, 16 to 17 ms |

**What-if**

| Interaction                | Before          | After          |
| -------------------------- | --------------- | -------------- |
| Pick a cut or a category   | 28 to 66 ms     | 19 to 45 ms    |
| "N more"                   | 56 to 116 ms    | 23 to 26 ms    |

**Goals**

| Interaction                       | Before         | After        |
| --------------------------------- | -------------- | ------------ |
| Close a goal, add-money or form sheet | 16 to 96 ms | 10 to 30 ms  |
| Open any of them                  | 70 to 134 ms   | 69 to 155 ms, the same (the sheet mounting) |

## Where the time went

The same causes as the earlier passes, one per screen:

- **Which sheet is open was React state of the page** (People, Investments, Categories, Profile's You), so each open or close redrew the cards, rows and tiles behind it.
- **A reload set fresh arrays** (all of them), so every row and tile redrew even when nothing had changed.
- **The page held controls that only change themselves**: the currency list, the daily goal field, About and the widget switch on Settings; the trend's stretch on Investments; the archived row on You; the amount, note, date and account on a person's sheet; a notification switch's three answers.
- **Pieces that take nothing from the page were redrawn with it**: What-if's purchase check, Profile's two sections.

## What changed

1. **Sheets in a store outside React state** ([peopleSheetsStore](../src/features/people/peopleSheetsStore.ts), [investmentsSheetsStore](../src/features/investments/investmentsSheetsStore.ts), [categoriesSheetsStore](../src/features/categories/categoriesSheetsStore.ts), [youSheetsStore](../src/features/profile/youSheetsStore.ts), on [valueStore](../src/lib/valueStore.ts)), each rendered by its own memoized component (`PeopleSheets`, `InvestmentsSheets`, `CategoriesSheets`, `YouSheets`).
2. **Data hooks that keep what a reload did not change** ([usePeopleData](../src/features/people/usePeopleData.ts), [useInvestmentsData](../src/features/investments/useInvestmentsData.ts), [useCategoriesData](../src/features/categories/useCategoriesData.ts), [useYouData](../src/features/profile/useYouData.ts); Goals inside its page): one update, every unchanged row the same object, no state set when nothing is new, only the newest load lands.
3. **Memoized rows with one handler each**: `PersonTile`, `PersonQuietRow`, `HoldingRow`, `SipRow`, the Categories tiles (`MemoCategoryTile`, with its panel's handler fixed by the new [useStableCallback](../src/lib/useStableCallback.ts)), `GoalListRow`, `AlertRow`, and the totals cards. The first ones take `onOpen(item)` instead of a closure per row.
4. **Controls that own their own state**: [SettleForm](../src/features/people/SettleForm.tsx) (its fields in [settleFormStore](../src/features/people/settleFormStore.ts); the footer's buttons read them when tapped) and [PersonHistory](../src/features/people/PersonHistory.tsx) (the ⋯ menu), [PortfolioCard](../src/features/investments/PortfolioCard.tsx) (the stretch), [ArchivedAccounts](../src/features/profile/ArchivedAccounts.tsx), [CurrencySetting](../src/features/profile/CurrencySetting.tsx), [DailyGoalSetting](../src/features/profile/DailyGoalSetting.tsx), [WidgetPrivacyRow](../src/features/profile/WidgetPrivacyRow.tsx), [AboutYume](../src/features/profile/AboutYume.tsx).
5. **What a category does** moved to [useCategoryActions](../src/features/categories/useCategoryActions.ts) (archive, restore, delete with undo, the built-in notice), with one fixed function per action and a plain ref instead of a "busy" state.
6. **A save that comes back as the choice already shown draws nothing** ([useNotificationPreferences](../src/features/notifications/useNotificationPreferences.ts) keeps the same preferences object, and the delivery status keeps its object when it is the same): a switch is one redraw.
7. **Memo at the call site** for pieces that take nothing from the page: What-if's purchase check, Profile's You and Settings sections, Goals' totals.

## Code structure

| File                          | Before | After |
| ----------------------------- | ------ | ----- |
| `app/people.tsx`              | 200    | 179   |
| `app/investments.tsx`         | 397    | 226   |
| `app/categories.tsx`          | 413    | 218   |
| `PersonDetailModal`           | 528    | 397   |
| `YouSection`                  | 274    | 202   |
| `SettingsSection`             | 606    | 404   |
| `app/notification-settings.tsx` | 511  | 467   |
| `app/whatif.tsx`, `app/savings-goals.tsx`, `app/profile.tsx` | 334, 327, 157 | 337, 340, 161 |

## Tests

New tests count what is drawn, and each fails on the code before this pass (checked by running it on the old files): [PeopleScreen](../src/screens/PeopleScreen.test.tsx) (real database: a sheet opening drew every tile, a reload that found the same people drew them all, one changed balance drew all), [PersonDetailRenderCounts](../src/features/people/PersonDetailRenderCounts.test.tsx) (a digit, a note or an account redrew the balance card; opening a ⋯ menu redrew every entry), [InvestmentsRenderCounts](../src/features/investments/InvestmentsRenderCounts.test.tsx), [CategoriesRenderCounts](../src/features/categories/CategoriesRenderCounts.test.tsx), [YouRenderCounts](../src/features/profile/YouRenderCounts.test.tsx) and [SettingsRenderCounts](../src/features/profile/SettingsRenderCounts.test.tsx), [NotificationRenderCounts](../src/features/notifications/NotificationRenderCounts.test.tsx) (answers arrive separately, as from the database: the old code drew the page twice for one switch and every row eleven times), [GoalsScreen](../src/screens/GoalsScreen.test.tsx) (real database) and one test in [WhatIfScreen](../src/features/whatif/WhatIfScreen.test.tsx). Where the same behaviour is easy to lose, a test keeps it: typed text and a picked account survive a visit to History and back, a person's "Settle" chip still fills the balance, a chosen currency, goal and switch still land. A found problem along the way: two of these tests first passed on the old code because their answers were awaited inside one `act` (which batches them); they now let each answer arrive on its own.

The existing tests of all these screens pass unchanged.

## Checked against the version before

States of each screen at normal speed, old build against new, pixel by pixel: People (9 states, the list, a person, typing, an account, History, the menu, the form), Investments (9), Categories (15, with a panel, an editor, the form and archived), Profile (10, You, an account, Add, the name, Settings, currency, goal typed, About), Notification settings (9, each switch, dimmed rows, the delivery check), What-if (7) and Goals (6). They are identical except: People's avatar colours, which are random on each page load (the old build differs from itself the same way); a few dozen anti-aliased pixels at card corners (at most 2 to 7 out of 255, also present between two runs of the old build); and a thin strip of the category editor's icon column that also differs between two runs of the old build. The click-everything run over these screens on normal and empty data raises only the browser's warning that a `<button>` is nested in a `<button>` on Goals (a pressable inside a pressable in `GoalCard`, unchanged, and not a problem on Android).

## Not changed, and why

- **Opening a sheet costs what the sheet costs.** What is left on a person's sheet, an investment's, an account's, a goal's and the forms is the sheet mounting (`ModalSheet` measures after layout), the same finding as the earlier passes.
- **Switching to Profile's Settings tab** is not better (see above): it mounts a 400-line page.
- **A digit in a person's amount** still costs 19 to 56 ms: the amount, the "Settle" chip (it names the amount), the note, the date and the account chips are one page. They could be split further.
- **Switching Categories' tab** draws the other type's tiles (they change).
- **Goals' sheet states** (the new-goal form, a goal, add money, the sealed letter) are still the page's own state: the sealed-letter effect depends on which of them is open, so moving them risked its timing. Opening or closing one now redraws the page but not its rows or totals.
- **Not measured:** Backup, Garden, Tidy up, Themes, Wrap, Category detail, Split and the Export and Recently deleted costs listed above. Nothing was run on a phone.
