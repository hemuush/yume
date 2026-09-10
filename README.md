# Yume

**Better money, bigger dreams.** A warm, private, offline-first money tracker made for India: daily
spending, income, savings pots, loans with proper EMI amortization, credit cards, fully custom
categories, and an informal IOU ledger for friends and family — with fully local backups.

## Why local-first

All data lives in an on-device SQLite database. Nothing is ever sent to any server. Backups are files you export yourself or an automatic write to a folder you choose on the device — no account, no network. See [DATA_MODEL.md](./DATA_MODEL.md) for the schema and [BACKUP.md](./BACKUP.md) for how backup/restore works.

## Stack

- **Expo SDK 57 (React Native, TypeScript)** with `expo-router` for file-based navigation
- **expo-sqlite** for the local database — no backend required
- **expo-file-system** + Storage Access Framework for local-folder backups; **expo-sharing** for file export
- **Jest** (with a `better-sqlite3` harness that runs the real query code) for tests; **ESLint + Prettier** for lint/format

## Project layout

```
app/                    Screens (expo-router file-based routing)
  (tabs)/               Bottom tabs: index (Home), transactions (Activity),
                        add (raised "+", opens add-transaction), loans, reports
  profile.tsx           Identity + accounts (pushed from the header avatar)
  categories.tsx        Category management
  settings.tsx          Currency, accent, app lock, privacy
  backup.tsx            Backup & restore (local folder, file export & restore)
  recurring.tsx         Recurring-transaction rules
  add-transaction.tsx   Unified add screen — single entry, bulk backfill, friend IOU
  notifications.tsx / notification-settings.tsx   In-app feed + reminder prefs
src/
  db/                   All data access — schema, ledger, loans, people, recurring,
                        reports, settings (co-located *.test.ts integration tests)
  lib/                  Pure logic — money/date/EMI math, backup serialization,
                        local-folder backup, notifications, app lock, Excel export
  components/           Shared UI primitives
  features/             Per-screen sub-modules — each big screen's modals,
                        rows, styles and helpers live in features/<screen>/,
                        so the app/ route file stays a thin orchestrator
  constants/            Theme tokens and default categories
  theme/                Accent + privacy React contexts
  test-support/         better-sqlite3 test harness
  __tests__/            Cross-cutting integration tests
scripts/                Dev-only scripts (not shipped)
```

## Running locally

```bash
npm install
npm run android      # or: npx expo start, then open in Expo Go / a dev client
```

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write .
npm test             # jest
```

## Building an APK

See [BUILD.md](./BUILD.md).

## Data model & calculation logic

See [DATA_MODEL.md](./DATA_MODEL.md) for the full schema and the reasoning behind it (why savings are accounts, not categories; how the friends ledger nets out; how EMI amortization is computed).
