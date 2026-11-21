# Code audit (15 November 2026)

A whole-repository audit of `main` at `64475c1`: what was covered, how, what was found, and what was not checked. Nothing here was run on a phone. Earlier audits ([full app](FULL_APP_AUDIT_2026_10_25.md), [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md)) and the product decisions recorded in [SECURITY_PRODUCT_REVIEW.md](../../SECURITY_PRODUCT_REVIEW.md) (readable backups, whole-unit amounts, ordinary local SQLite) were taken as the starting point; those decisions are not raised again below.

## Scope and method, honestly

The repository has 1,227 tracked files: about 87,000 lines of non-test source (app 8,900; `src/db` 10,400; `src/lib` 8,000; `src/features` 49,200; `src/components` 7,300; widgets, theme, plugins, scripts and the rest about 3,500) and 453 test files. **No one pass reads all of that line by line and still catches things**, so the audit combined three kinds of work, and says which each finding came from:

1. **Whole-repository analysis, over every file**: typecheck, lint, circular imports, formatting, the full test suite with per-file coverage, `npm audit`, and scans built on the TypeScript compiler (not on text search) for the classic bug classes below.
2. **A line-by-line read of the highest-risk code**: the app lock and the root layout that enforces it, database startup and migrations, backup and restore, the recurring-rule runner that posts entries on its own, the money and date helpers, the PDF and Excel export builders, the widget manifest plugin and the CI workflow, plus everything written this week.
3. **A randomized property test on real SQLite** (new, `src/db/integrityFuzz.test.ts`): about 55,000 mixed operations over 250 seeds, then checks that must hold whatever happened.

## What was checked, and the result

| Check | Result |
| --- | --- |
| `tsc` (strict, no unused locals or parameters), `eslint` (no `any` in source), circular imports (593 modules), Prettier | clean, no warnings |
| Full test suite | all pass: 12,500 tests in 452 suites (23 new tests with this audit: the randomized test, the damaged-backup message, the linked-note limit, the newest-load guards and the single-balance People card) |
| Coverage over the whole suite | 90.2% of lines, 84.3% of branches, 83.9% of functions; 6 files at 0% (all under 60 lines: a seeding helper, two widget entry points, one tiny sheet) |
| Dead code | 0 orphan files; 100 exports not used by other source files, of which 89 are used by tests and 9 only inside their own file; 2 used nowhere (types I added last week, now removed) |
| Silenced errors | 35 `.catch(() => {})`, each read: haptics, best-effort alerts and nudges, recent searches, cleanup of a half-written backup, serialization chains. None hides a failed money write |
| Floating promises (type-checked) | 4 bare promises in the whole app, each with a rejection handler and a staleness guard |
| SQL built by string interpolation | 81 templates, 65 distinct interpolated expressions: all are constant fragments, `?` placeholder lists, or names checked against the real schema (the undo restore validates table and column names). No injection path found |
| Deadlock through the one-at-a-time database queue | 437 database-reaching functions; the 10 transaction callbacks that call one all pass the transaction handle. None re-enters the queue |
| Dates | every `toISOString()` is a timestamp, never a calendar date; date-only strings go through the local helpers; month-end and leap-day anchors are handled |
| `JSON.parse` of stored or imported text (29) | 26 guarded; the 3 that look unguarded are the app's own serialized key, its own in-memory draft, and one file read covered by finding F1 |
| Logging (53 calls) | only error messages and identifiers; no amounts, names or notes |
| Secrets and credentials | none in the tree; `.env*`, `*.jks`, `credentials.json` and the native projects are ignored |
| Dependencies (`npm audit --omit=dev`) | 0 high or critical; 3 moderate, one chain (`minimatch` inside Expo's build-time fingerprint tool). The suggested fix is a downgrade to Expo 52, which is not reasonable, and the code is not part of the shipped app |
| Native configuration | `allowBackup` is false, permissions are two biometric ones, overlay and storage permissions are blocked, release builds remove `INTERNET`, the widget image provider checks the caller's UID and file name, CI checks the generated manifest |
| CI | actions pinned to commits, read-only token, dependency gate, Expo doctor, Android bundle and prebuild checks |
| Accessibility scan (every screen) | 0 text inputs without a label; the 2 tappable controls without label or text are fine (a radio card with text children, and the story surface that is deliberately not an accessibility element); index keys are only on static or derived visual lists |
| Lock | fails closed (a read error shows an error screen, not content); notifications and dialogs never appear over the lock screen; re-lock handles a clock moved backwards and caps how long the app's own pickers can keep it unlocked |
| PDF and Excel export | every user string in the PDF is escaped and colours are validated as hex; Excel writes text as text cells, so a note starting with `=` is inert |
| Backup and restore | every table in the schema is covered (the two exceptions, `deleted_entries` and the settings that belong to the phone, are deliberate); validation happens before anything is deleted; one transaction; foreign keys are checked before commit |
| Recurring runner | one run at a time; each occurrence is inserted and advanced in one transaction that re-checks the rule; the post-save alert step cannot throw, so it cannot deactivate a healthy rule |

### The randomized test

Operations: expenses, income, transfers (including into a savings pot), edits, deletes with and without undo, loans with EMIs paid and undone, repeating rules posting their catch-up, budgets, money given to and received from people (and undone), manual ledger adjustments, split payments (saved, deleted, restored), refunds (expected, received, undone, closed), savings goals (created, contributed to, archived, deleted, restored), categories through every state, and accounts archived. After every 55 operations and at the end:

- every account's balance equals its opening balance plus the entries, computed again from the rows;
- every person's balance equals their ledger;
- no refund is received beyond what was expected;
- `PRAGMA integrity_check` is `ok` and `PRAGMA foreign_key_check` is empty;
- a backup restored over the same data comes back identical, table by table, and every figure above still holds;
- for each of the last three months, the comparison, category, daily and account reports and the income reports all agree with the entries (a category, an account or a day whose refunds outweigh its spending shows nothing, by design, so those sums are checked as positive-only).

250 seeds pass. The test also proves it can fail: it notices an entry on an account that does not exist and a balance that does not match. By default it runs 8 seeds in about 3 seconds; `FUZZ_SEEDS=250` runs more.

## Findings

No data-loss, security or money-correctness defect was found. All findings are low, and F1 to F5 are fixed.

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| F1 | Low | Restoring from the in-app list of folder backups showed the JSON parser's own message ("JSON Parse error: Unexpected character…") for a damaged file, where the file picker path says "This backup file is damaged or isn't a Yume backup. Nothing was changed." No data was at risk. Found by reading `readLocalBackup` | Fixed, with tests |
| F2 | Low | The 120-character note limit was enforced only by the text field, so a `note` in a link (or any other prefill) could put a longer one on the Add screen and it would be saved as typed. Found by following the deep-link parameters into the form | Fixed, with a real-database test |
| F3 | Info | `setNotificationPrefs` writes the whole preferences object without the settings lock that `updateNotificationPrefs` takes, and nothing in the app calls it (only tests). Anyone who used it later could overwrite a concurrent change | Fixed afterwards: the setter is removed, and the tests that used it call `updateNotificationPrefs`, which takes the lock |
| F4 | Info | `PeopleTile` (in `PlanTiles.tsx`) is a component nothing renders; only its own test uses it | Fixed afterwards: removed with the eight style entries only it used; its test now checks the live card (`PlanPeopleHabit`), plus a new one for a single balance |
| F5 | Info | `useLoansData` and `useRecurringData` have no explicit "newest load wins" counter (Budgets has one). The database queue is first-in-first-out and the loads have the same shape, so they finish in order; the shared `useScreenLoad` says each load function owns this guard | Fixed afterwards: both loaders keep only the newest load, and Recurring also counts a pause or a hidden suggestion made on the page as newer than a read in flight; three tests fail without it |
| F6 | Info | `newId` builds UUIDs from `Math.random`. Fine for record keys in one person's database (collisions are negligible and nothing treats an id as a secret), but not cryptographic | Not changed |
| F7 | Info | Moderate `npm audit` findings, build-time only (see above) | Not changed |

## Not checked, and why

- **Anything on a device.** Frame rates, TalkBack, the merged Android manifest of an installed build, notification delivery and timing, widget refresh, biometric prompts and the real file picker were not exercised. CI checks the generated manifest, not a built APK.
- **Upgrading a real old database.** The migrations are read and idempotent, and `client.ts` has the most untested lines of the data layer (they only run when updating from an older version). They were not run against actual old database files.
- **Most of `src/features` was not read line by line** (49,000 lines of screens and components). It is covered by the compiler-based scans above, the test suite (90% line coverage), the earlier per-screen reviews and this week's work on the eight busiest screens. A defect that is purely visual, or that needs a specific device, would not show up here.
- **No penetration test.** The review is of source and configuration.
