# UI and UX refinement review — 10 October 2026

This pass keeps the existing pastel backgrounds, glass cards, rounded shapes, Archivo/Fredoka/Space Mono typography, navigation and features. It changes presentation and accessibility rather than financial calculations, storage or transaction behavior. Expo 57 versioned documentation was read before editing.

## Improvements implemented

- Aligned Add, Reports, Recurring and Themes content to the existing 16dp header gutter. This also gives content more usable width.
- Standardized date-field labels with the other form labels; increased date chips, segmented controls, week choices and sheet text actions to a 44dp minimum height.
- Made focused form fields and the onboarding name field visibly outlined in the existing link color. The outline reserves its width, avoiding a layout jump.
- Let shared card headings and status chips use two lines. Sheet preview labels have a width limit so they cannot collide with the icon.
- Improved empty-state hierarchy and reduced excessive horizontal padding. Descriptions, sheet subtitles and list metadata have consistent line spacing.
- Preserved amounts while allowing longer backup names, deleted-entry descriptions, split categories, account descriptions and linked-loan labels to wrap.
- Stacked settled-friend names and activity metadata instead of forcing both into one crowded row.
- Made Profile shortcut labels readable on two lines, with consistent tile height.
- Exposed disabled button state to accessibility services while retaining caller-provided busy state. The unlock action also announces its busy state.
- Made notification-settings explanatory text more readable.

## Screen coverage

Coverage means source and shared-component review plus the automated checks recorded below. It does not mean every screen has been visually exercised on a physical phone.

| Area | Review and outcome |
| --- | --- |
| Home | Existing card hierarchy retained; shared chips and headings wrap. Prior scroll-animation fixes retained. |
| Activity | Existing search, filters, period controls and transactions retained; shared segmented controls and row metadata improved. |
| Add transaction | Aligned gutter; shared field, date and sheet improvements; split labels wrap. Expense, income, transfer, friend, repeat, list, refund and split features retained. |
| Plan | Existing forecast, budgets, debt timeline, goals, what-if, friends, habit and upcoming sections retained; shared headings/chips improved. |
| Reports | Aligned gutter and period-control improvements. Days, Categories and Trends retained; the previously removed duplicate summary stays removed. |
| Profile | Two-line shortcut labels; account descriptions wrap; shared controls improved. |
| Backup | Longer backup names wrap; restore and export actions retained. |
| Budgets | Existing progress cards and editor retained; shared forms and date controls improved. |
| Categories | Existing hierarchy and editor retained; shared forms and sheets improved. |
| Category detail | Existing totals, breakdowns and linked transactions retained; shared card headings/chips improved. |
| Garden | Existing calendar and growth states retained; shared descriptions and card headings improved. |
| Loans | Existing schedules, payments, assets, rates and prepayment flows retained; shared forms, date choices and sheets improved. |
| Notification settings | Explanatory text enlarged slightly with more line spacing; scheduling controls retained. |
| Notifications | Existing notification rows and actions retained; shared empty-state hierarchy improved. |
| Friends and family | Settled rows reorganized for long names; linked-loan labels wrap. Settlement, history and cash-movement choices retained. |
| Recently deleted | Entry names/descriptions wrap; restore actions retained. |
| Recurring | Aligned gutter; shared form and schedule controls improved. Running toggles and editors retained. |
| Savings goals | Existing goal cards, contributions and editing retained; shared forms and sheets improved. |
| Split | Existing allocations and calculator retained; split-category labels wrap. |
| Themes | Aligned gutter; theme choices retained. |
| Tidy up | Existing diagnostics and repair actions retained; shared controls improved. |
| What-if | Existing projections and choices retained; shared card text/chips improved. |
| Wrap | Existing summary flow retained; shared controls improved. |
| Onboarding | Clearer name-field focus and larger backup-restore link target; account setup retained. |
| App lock | More readable instructions and accessibility busy state; authentication behavior retained. |

## Verification

- TypeScript: `npm run typecheck` passed after the screen and shared-component edits.
- Lint: full repository lint and the follow-up check of files edited afterward passed.
- All-screen/control regression run: 8 suites, 170 tests passed. Includes all 23 screens in fresh-install, populated and hidden-amount states, font family/scale consistency, contrast, date/period controls, button accessibility and onboarding.
- Affected-flow regression run: 9 suites, 90 tests passed. Includes Add, Split, Recurring, Friends, Profile accounts, Themes, Recently deleted and onboarding. Onboarding appears in both runs, so these counts are test executions rather than unique tests.
- Android Hermes export passed: 2,301 modules, 7.8MB bundle, `dist/ui-refinements-check/_expo/static/js/android/index-453b3968c9560f53cee272f785602ee4.hbc`.
- `git diff --check` passed.

## Remaining device verification

Native screenshot comparison, keyboard/sheet positioning on small phones, large-font wrapping, and actual scroll/navigation frame rate require an Android device or emulator. Automated render tests do not measure these. No new APK was built in this pass, so the existing APK does not include these changes.
