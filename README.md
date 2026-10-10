# Yume (夢)

**Better money. Bigger dreams.** A warm, private, offline-first money tracker made for India: daily
spending, income, savings goals, budgets, loans with proper EMI amortization, credit cards, fully
custom categories, recurring transactions, and an informal IOU ledger for friends and family —
with fully local backups and nothing sent to any server.

## Features

- **Transactions** — expense/income/transfer entry with a calculator keypad, "Your usual" one-tap
  entries, a repeat-entry warning, bulk backfill, search (words or amounts), and filters by
  category, account and type
- **Accounts** — bank, cash, credit card and savings accounts, each with its own currency
- **Loans** — EMI amortization, prepayments, rate changes, and a linked asset's tracked equity
- **Budgets & savings goals** — monthly category limits with a spending-pace marker and 80% / over
  alerts; goals filled by hand or following a savings account's balance
- **Recurring rules** — bills and regular transfers that post themselves on schedule, with a
  monthly and yearly total and suggestions for subscriptions not set up yet
- **People** — an informal ledger for money owed to or by friends and family, net of settlements
- **Reports** — spending and income by category, a spend heatmap, month-over-month comparisons,
  any custom date range (financial years included), and a page for each category
- **Home-screen widgets** — live balances, this month's spend, next due bill, and a Suu check-in
  (they show amounts on the home screen even while App Lock is on)
- **Exclusive themes** — eleven named colour packs (see `src/theme/themes.ts`) alongside the
  default, switchable from Settings → Appearance
- **App lock & privacy** — biometric/PIN lock (via whatever the phone itself is secured with) and a
  one-tap "hide amounts" toggle
- **Needs you** — one list of what wants attention: EMIs due, budgets running hot, failed
  backups, and things to tidy
- **Tidy up** — finds likely duplicate entries and starting balances logged as income, each fix
  undoable
- **Suu** — the app's mascot, with a one-line nudge about how the month's going

## Why local-first

All data lives in an on-device SQLite database. Nothing is ever sent to any server. Backups are files you export yourself or an automatic write to a folder you choose on the device — no account, no network. See [DATA_MODEL.md](./DATA_MODEL.md) for the schema and [BACKUP.md](./BACKUP.md) for how backup/restore works.

## Stack

- **Expo SDK 57 (React Native, TypeScript)** with `expo-router` for file-based navigation
- **expo-sqlite** for the local database — no backend required
- **expo-file-system** + Storage Access Framework for local-folder backups; **expo-sharing** for file export
- **expo-local-authentication** for app lock; **expo-notifications** for reminders and due-date alerts
- **react-native-reanimated** for in-app animation; **react-native-android-widget** for the home-screen widgets
- **Jest** (with a `better-sqlite3` harness that runs the real query code) for tests; **ESLint + Prettier** for lint/format

## Project layout

```
app/                    Screens (expo-router file-based routing)
  (tabs)/               Bottom tabs: index (Home), transactions (Activity),
                        add (raised "+", opens add-transaction), plan, reports
  loans.tsx             Loans with an EMI schedule, reached from Plan
  people.tsx            Friends & Family — informal IOUs, reached from Plan
  profile.tsx           Identity, tracked balance, accounts, and Settings
                        (currency, theme, app lock, privacy) — pushed from the
                        header avatar
  categories.tsx        Category management
  budgets.tsx           Monthly category budgets
  savings-goals.tsx     Savings goals and contributions
  recurring.tsx         Recurring-transaction rules, subscriptions and bills
  category/[id].tsx     One category's page: total, budget, split, months, entries
  tidy-up.tsx           Duplicates and starting balances to fix
  backup.tsx            Backup & restore (local folder, file export & restore)
  add-transaction.tsx   Unified add screen — single entry, bulk backfill, friend IOU
  notifications.tsx / notification-settings.tsx   Needs you (the full list) + reminder prefs
src/
  db/                   All data access — schema, ledger, loans, people, recurring,
                        budgets, reports, settings (co-located *.test.ts integration tests)
  lib/                  Pure logic — money/date/EMI math, backup serialization,
                        local-folder backup, notifications, app lock, Excel export
  components/           Shared UI primitives
  features/             Per-screen sub-modules — each big screen's modals,
                        rows, styles and helpers live in features/<screen>/,
                        while app/ owns navigation and screen orchestration
  constants/            Theme tokens and default categories
  theme/                Exclusive theme packs, plus the accent + privacy React contexts
  widgets/              Home-screen widgets (react-native-android-widget) and their data sources
  test-support/         better-sqlite3 test harness
  __tests__/            Cross-cutting integration tests
```

## Running locally

Yume is **Android-only** — there is no iOS build (backups use Android's Storage Access Framework, and the
home-screen widgets are Android widgets).

```bash
npm install
npx expo run:android   # builds and installs a development build, then starts Metro
```

Expo Go can't run Yume: it depends on native modules Expo Go doesn't include
(`react-native-android-widget`, `react-native-keyboard-controller`). Once a development build is
installed on the device, `npm start` is enough for day-to-day work.

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write .
npm test             # jest
```

Type checking also rejects unused imports, local variables, and parameters. Intentional unused
parameters should start with `_`. Keep screen-specific code in `src/features/<screen>/`, reusable
UI in `src/components/`, data access in `src/db/`, and independent logic in `src/lib/`.
Tests stay next to the code they exercise; cross-screen tests belong in `src/__tests__/`.

When checking unused files, include Expo Router's file-based routes, the widget handler registered
in `index.js`, config plugins, and performance-test fixtures as entry points. Dependencies used
by Expo/native integration may have no direct application import; check their integration before
removing them.

## Building an APK

See [BUILD.md](./BUILD.md).

## Data model & calculation logic

See [DATA_MODEL.md](./DATA_MODEL.md) for the full schema and the reasoning behind it (why savings are accounts, not categories; how the friends ledger nets out; how EMI amortization is computed).
