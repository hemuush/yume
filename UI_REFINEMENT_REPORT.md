# UI refinements — 10 October 2026

## Scope

Implemented the approved remaining-screen refinements while retaining the current visual language, navigation, database model and native features. The private design reference is https://yume-design-review.earthystork1.chatgpt.site/remaining#add. It uses sample data and is not the native app.

Read the exact Expo v57 documentation before editing. No dependency upgrades, data migrations, APK builds or EAS builds were performed.

## Changes

- Shared buttons now have a 44dp minimum height, wrapping labels, gentler press feedback and a reduced-motion-aware completion transition. Sheets have larger close controls, wrapping titles and respect reduced motion when opening.
- Form labels are more readable and use sentence case. Settings labels/values, account names, goal names, people names, theme names, split categories and loan dates have more room to wrap.
- Failed first loads show an explicit Retry state instead of pretending that records are empty or balances are zero. A failed refresh retains previously loaded data. Existing inline error messages also have Retry actions.
- Friends keeps the known balance while fetching details, blocks settlement until usable details arrive, prevents simultaneous settlement/delete writes, and shows a Done footer on History. Settlement wording follows the direction of the debt and whether cash moved.
- Recurring groups same-day timeline marks, shows entry counts, opens the entries for a selected date, retains separate overdue occurrences, guards repeated pause requests and commits fetched labels/rules together. Schedule previews stop at the inclusive end date. Income-only schedules remain visible; monthly cost counts are explicitly expense rules.
- Garden uses larger plants and clearer tracked/untracked/over-goal/future states with symbols as well as color. Calendar taps explain the state, today is marked provisional, and Change daily goal opens Profile's Settings tab.
- Wrap has visible Previous/Pause/Next controls alongside its existing tap/hold gestures. Automatic advancement remains disabled for reduced motion and screen readers.
- Notification time controls, onboarding selection/Skip and split removal controls have larger targets. Lock content can scroll when text or error messages need more room.
- Settings distinguishes unavailable reads from genuinely unset values. A failed backup-status read no longer says Never backed up; prior successful values remain available and Retry checks them again.

## Coverage and retained features

Not every screen needed a direct edit. The following inventory includes routes, sheets and non-route surfaces; shared refinements apply wherever their components are used.

| Area | Work in this pass | Existing features retained |
| --- | --- | --- |
| Add transaction and Add shortcut | Shared input/button/sheet refinements; existing screen and flow tests | Expense, Income, Transfer, Friend, calculator pad, repeat, usual entries, account/date/note, refunds, batch list, split, new account/person and edit flows |
| Friends & family, person and history sheets | Direct refinements and loading/write fixes | Add person, both debt directions, cash-account versus balance-only entries, full settlement, custom date, linked loans, history, delete and undo |
| Garden | Direct readability/calendar/goal-link refinements | Daily goal setup, streak calculation, growth stages, Suu note, savings progress and privacy |
| Recurring and rule editor | Direct timeline/schedule/pause refinements | All transaction types, suggestions, cadence/interval, start/end dates, account/category/note, pause/resume, catch-up, delete and undo |
| Budgets and limit editor | Error recovery, shared labels/controls | Add/edit limits, rollover, lapsed budgets, continue one/all, category links, delete and undo |
| Savings goals and funding sheets | Wrapping names, error recovery and shared forms | Manual/account-linked goals, contributions, funding transfers, deadlines, completed/archived goals and privacy |
| Loans, setup/detail/payment sheets | Wrapping dates, larger Pay/Received target, recovery and shared forms | Existing full setup wizard, borrowed/lent directions, interest/schedules, payments, prepayments, account creation, detail/history and linked-person flows |
| What-if | Honest initial-load failure and Retry; shared labels/controls | Category/goal selection, percentage adjustments, account-linked pace calculations and reset; remains a non-writing sandbox |
| Profile, accounts and account sheets | Wrapping names, tab link, error recovery and shared controls | Identity edits, currencies, account types, balances, account history, card cycles, pay-card flows and archive/manage actions |
| Investment values and asset editors | Existing implementations inspected; shared sheet/form/button refinements | Valuation updates/history, gain and contribution calculations, estimate chip, custom dates, asset details, privacy masking, delete and undo |
| Settings | Wrapping rows, readable labels and honest read-failure states | Daily goal, currency, privacy, lock, alerts, data links, appearance and About |
| Categories and category editor | Recovery and shared form/sheet refinements | Parent/child categories, icons/colors, sensitivity, archive/manage actions and undo |
| Category detail | Initial-error recovery and Retry | Transactions, monthly data, budget/what-if links and existing privacy behavior |
| Split payment | Wrapping category/legend/typing text and larger removal control | 2–6 parts, automatic remainder, category picker, calculator, validation, Done/back handoff to Add |
| Notifications inbox | Retry and shared buttons | Action links, dismiss, snooze, optimistic rollback and undo |
| Notification settings | Larger time controls and wrapping shared rows | Permission checks, all toggles, morning/evening times, scheduling and save-error rollback |
| Backup and restore sheets | Initial-error recovery, Retry and shared controls | Export/import, CSV/spreadsheet options, local folder scheduling, preview, safety copy and restore resynchronization |
| Recently deleted | Initial-error recovery, Retry and shared controls | Restore, retention information, privacy masking and confirmed permanent removal |
| Tidy up | Initial-error recovery, Retry and shared controls | Repeat/starting-balance/fractional review, existing fixes and undo |
| Themes | Wrapping theme names and color labels | All current theme packs, live preview, selection and persistence |
| Wrap | Direct navigation-control refinement | Every beat/chart, playback, tap/hold gestures, share/export and report navigation |
| Onboarding | Larger targets and accessible name input | Existing introduction, optional name, starter accounts/opening balances, Skip and backup restore |
| Lock screen | Scrollable content and shared button refinements | Native authentication, retry, device-security checks and existing recovery path |
| Android widgets | Existing widget implementations and tests inspected; layout retained | All five widgets, real-data calculations, themes/privacy and deep links |
| Home, Activity, Plan and Reports | Prior approved layouts retained; shared refinements apply | Existing cards, charts, tabs, navigation and data behavior, including Reports' previously approved top-card removal |

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed, with no errors or warnings.
- Full default test run: 245 suites / 10,710 tests passed, with one font-consistency assertion failing because a new Garden symbol omitted its font family. Corrected that style and the error-screen body font.
- Final focused rerun with `--detectOpenHandles`: all 7 suites / 39 tests passed, including the failed font-consistency check and the changed Garden, Recurring, Friends, Settings, loading and Wrap behavior. This run exited normally. Combined with the full run, all 10,711 executed tests are verified after the correction.
- Two opt-in performance suites / two tests were skipped by their existing `PERF=1` guard. No performance benchmark was run.
- Final `npx expo export --platform android --output-dir dist/ui-refinements-check`: passed; generated an Android Hermes bundle. This is bundle validation, not an APK or installable build.
- `git diff --check`: passed.

The full Jest process reported an open-handle warning after printing its completed results and remained alive; the completed process was stopped explicitly. The focused run with handle detection exited cleanly. The full-suite shutdown issue has not been isolated, so this report does not claim one completely clean full-suite process run.

Test coverage verifies behavior and rendering structure; it does not establish frame-rate smoothness or physical-device layout quality.

## Device review still required

- At normal and 130% text size, check narrow phone layouts, long names, wrapped actions and scroll clearance above the bottom navigation.
- Check native keyboard/calculator transitions, sheet dismissal, same-date recurring drill-down/edit and pause feedback.
- Check Garden day-state symbols and provisional today status, Wrap gestures/buttons and reduced-motion behavior.
- Check onboarding, native authentication, notification permission prompts, folder/file pickers and Android widget sizes on a device.

These require a running native app. No device visual review or measured animation-performance claim is made in this report. APK builds remain on hold until requested.
