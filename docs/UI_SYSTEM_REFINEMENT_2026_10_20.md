# App UI consistency — 20 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Implemented scope

The audit resolves local imports from all 26 Expo routes (23 screens, two layouts and the Add redirect). All 25 non-redirect route closures use the refined shared controls. This is source coverage, not a claim that every screen state was visually inspected on a phone.

- One theme-owned `interactionColors` module supplies the deep selected ink, pale tint and edge. Shared buttons, capsules, tabs, focused fields, date selections, switches, header actions and chart tooltips follow the user's selected theme. Existing category colours and income/due/danger semantics remain intact.
- Bottom sheets and centred dialogs share a short pastel header wash, cream content and warm neutral pinned action tray. Their horizontal padding is 20dp. Centred framed dialogs no longer accumulate both outer and header top padding. Keyboard scrolling, safe areas, parent/child modal handling and save-time dismissal locks retain their existing ownership.
- Selected segmented controls have a readable filled fallback before measurement. Width cannot become negative in a narrow layout. Plan's enlarged-text tab layout follows the same palette as its single-row layout.
- Press feedback is limited to 3% scale reduction and 8% dimming, with 80/120ms press/release timings. Reduced motion settles immediately, and interrupted/unmounted animations still stop. No repeating animation was added.
- Reports' active-tab reselect leaves the current view settled. Category-weighted charts retain their category colours; selected tooltips and current-day markers use theme ink.

## Route coverage

| Route                           | Source coverage          |
| ------------------------------- | ------------------------ |
| `app/(tabs)/add.tsx`            | Routing-only redirect    |
| `app/(tabs)/index.tsx`          | Shared controls reviewed |
| `app/(tabs)/plan.tsx`           | Shared controls reviewed |
| `app/(tabs)/reports.tsx`        | Shared controls reviewed |
| `app/(tabs)/transactions.tsx`   | Shared controls reviewed |
| `app/(tabs)/_layout.tsx`        | Shared controls reviewed |
| `app/add-transaction.tsx`       | Shared controls reviewed |
| `app/backup.tsx`                | Shared controls reviewed |
| `app/budgets.tsx`               | Shared controls reviewed |
| `app/categories.tsx`            | Shared controls reviewed |
| `app/category/[id].tsx`         | Shared controls reviewed |
| `app/garden.tsx`                | Shared controls reviewed |
| `app/loans.tsx`                 | Shared controls reviewed |
| `app/notification-settings.tsx` | Shared controls reviewed |
| `app/notifications.tsx`         | Shared controls reviewed |
| `app/people.tsx`                | Shared controls reviewed |
| `app/profile.tsx`               | Shared controls reviewed |
| `app/recently-deleted.tsx`      | Shared controls reviewed |
| `app/recurring.tsx`             | Shared controls reviewed |
| `app/savings-goals.tsx`         | Shared controls reviewed |
| `app/split.tsx`                 | Shared controls reviewed |
| `app/themes.tsx`                | Shared controls reviewed |
| `app/tidy-up.tsx`               | Shared controls reviewed |
| `app/whatif.tsx`                | Shared controls reviewed |
| `app/wrap.tsx`                  | Shared controls reviewed |
| `app/_layout.tsx`               | Shared controls reviewed |

## Cleanup and structure

The import graph identified obsolete UI that was only exercised by its own tests: the Home carousel, Where it went panel, old Home budget/goal rows, their progress ring, the money allocation bar and its segment helper. These were removed, alongside the unused priority-card/exclusion path, an unreachable bottom-navigation layout and an unused Activity style. Tests specific to removed UI were removed; tests for current Home rows, goal cards, chart interactions, amount transitions and reduced motion remain.

Shared controls no longer import a colour utility from the Home feature. The compatibility `homeInk` file was removed after migrating every consumer to the theme layer. The two modules outside screen-route closures are intentional: `widgetTaskHandler` is registered by `index.js`, and `seedLedger` supplies performance fixtures. Neither was removed.

## Verification

Two verification passes completed against this working tree:

- Full regression rerun: **297 suites / 11,166 tests passed**. Two opt-in performance suites / two tests were skipped because `PERF=1` was not enabled; no measured speedup is claimed.
- Focused second pass: **11 suites / 60 tests passed**, covering theme updates, every built-in theme's selected-label contrast, popup structure/dismissal, bottom navigation, onboarding, Wrap, typography and reduced motion.
- The goal-contribution fixture was updated to supply the cached accent getter required by themed shared buttons. Its 12 checks passed individually and again in the full rerun.
- Final TypeScript check, full ESLint run, changed-file Prettier check and `git diff --check` passed. The final fixture change also passed its scoped lint/format checks.
- Security checks: **8 passed**.
- Final Android export succeeded: Metro/Hermes produced an **8.1 MB** bundle in `.expo/ui-consistency-final`. The earlier export also passed; this final export includes the last popup and theme refinements.
- Route import audit: 26 roots, 25 non-redirect closures using the refined controls; remaining modules outside those closures have confirmed widget/performance entry points.

These are fresh local results. Earlier audit reports remain historical evidence.

## Native acceptance still required

Automated rendering does not establish physical-device visual acceptance. Check the new sheet spacing with a keyboard and number pad, enlarged text, theme switching, and reduced motion on Android/iOS before treating the UI as device-verified. The Android export checks bundling, not a signed APK or installation.
