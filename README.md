# Flynse

A complete personal finance tracker: daily expenses, income, savings pots, loans with proper EMI amortization, credit cards, fully custom categories, and an informal IOU ledger for friends and family — built as a local-first mobile app with optional Google Drive backup.

## Why local-first

All data lives in an on-device SQLite database. Nothing is sent to any server except a backup you explicitly export, or an automatic sync to your own Google Drive once you choose to link it — both scoped to a single folder Flynse creates, using no client-side encryption of its own beyond Google's normal HTTPS transport and Drive-side storage. See [DATA_MODEL.md](./DATA_MODEL.md) for the schema and [BACKUP.md](./BACKUP.md) for how backup/restore works and how to set up your own Google OAuth credentials.

## Stack

- **Expo SDK 57 (React Native, TypeScript)** with `expo-router` for file-based navigation
- **expo-sqlite** for the local database — no backend required
- **expo-auth-session** + Google Drive REST API for backup (no native Google Sign-In SDK, keeps builds light)
- **Jest** (with a `better-sqlite3` harness that runs the real query code) for tests; **ESLint + Prettier** for lint/format

## Project layout

```
app/                    Screens (expo-router file-based routing)
  (tabs)/               Bottom tabs: index (Home), transactions (Activity),
                        add (raised "+", opens quick-add), loans, reports
  profile.tsx           Identity + accounts (pushed from the header avatar)
  categories.tsx        Category management
  settings.tsx          Currency, accent, app lock, privacy
  backup.tsx            Backup & restore (Google Drive + local folder)
  recurring.tsx         Recurring-transaction rules
  add-historical.tsx    Bulk backfill of past months
  notifications.tsx / notification-settings.tsx   In-app feed + reminder prefs
  quick-add.tsx         Transparent-modal add sheet
src/
  db/                   All data access — schema, ledger, loans, people, recurring,
                        reports, settings (co-located *.test.ts integration tests)
  lib/                  Pure logic — money/date/EMI math, backup serialization,
                        Drive API, notifications, app lock, Excel export
  components/           Shared UI primitives
  features/             Per-screen sub-modules — each big screen's modals,
                        rows, styles and helpers live in features/<screen>/,
                        so the app/ route file stays a thin orchestrator
  constants/            Theme tokens and default categories
  theme/                Accent + privacy React contexts
  test-support/         better-sqlite3 test harness (realDataTestDb)
  __tests__/            Cross-cutting integration tests
scripts/                Dev-only scripts + test fixtures (not shipped)
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
