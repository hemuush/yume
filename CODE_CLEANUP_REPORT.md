# Code cleanup: implementation record

## Current reading guide

Reviewed against the repository on **11 October 2026**. Unused-local type checks do not prove that every export is unused or reachable. Routes, widgets, config plugins and test/performance entry points must be considered before removing code.

Implementation: [app](app) and [index.js](index.js). Tests generally live beside these modules; use the [architecture and logic guide](docs/ARCHITECTURE.md) to find related flows.

This document preserves earlier findings and validation. Statements inside the historical record describe that revision, including old layouts, build status and test counts. They are not new verification results. See the [documentation index](docs/INDEX.md), [data model](DATA_MODEL.md), [backup guide](BACKUP.md) and [build guide](BUILD.md) for current contracts.

<details>
<summary>Historical findings, implementation and validation</summary>

Scope: application source, file references, unused locals/parameters, dependencies, and project organization. This cleanup preserves the current UI and features.

## Removed verified dead code

- `NeoTile`: unused legacy card component.
- `MonthRing`: unused Home ring component; the Android widget's separate ring renderer remains active.
- `categoryDial`: obsolete geometry after Home changed to category rows.
- `ReportsHero`: the duplicated Reports summary card previously removed from the screen.
- `useSlideIn`: unused animation hook; active period and list animations remain.
- The two tests dedicated exclusively to the removed dial and Reports summary.
- Fifteen unused styles in the shared Plan stylesheet, including the old loan timeline.

Reference checks used TypeScript module resolution and repository searches. After removal, the only source modules without TypeScript importers are the widget task handler (registered by `index.js`) and the ledger fixture (used by performance tests). The scan is a reference check, not a proof about every runtime path or unused export.

## Preventing regression

`tsconfig.json` now enables `noUnusedLocals` and `noUnusedParameters`. The existing `npm run typecheck` therefore catches unused imports, variables, and parameters as well as type errors. Intentional unused parameters use an underscore prefix.

The existing structure stays in place: routes in `app/`, screen modules in `src/features/`, shared UI in `src/components/`, database operations in `src/db/`, and independent logic in `src/lib/`. README now explains these boundaries and the special entry points that an unused-file audit must retain. Larger route modules can still be split when a feature change warrants it; this cleanup does not rewrite them solely to reduce their line count.

All production dependencies have either direct references or verified framework integration. `@expo/metro-runtime`, `expo-constants`, `expo-linking`, and `react-native-screens` are required by Expo/Router; `react-native-worklets` is a Reanimated peer dependency. None was removed based only on an absent app import.

## Validation

- TypeScript passed with both unused-code checks enabled.
- Full-project ESLint passed with zero warnings.
- Android Hermes export passed: 2,301 modules, 7.8 MB bundle, written to `dist/cleanup-check`.
- Dependency audit passed its existing allowlist gate; no blocking high/critical advisories.
- Whitespace/diff checks passed.
- Full regression suite passed and exited successfully: 247 suites, 10,719 tests. The two existing opt-in performance tests remain skipped. Seven tests were removed because they covered only the two deleted obsolete modules.

## Limits

Removing unreachable source improves maintenance; it is not evidence of faster device rendering. Physical-device scrolling, navigation frame times, keyboard behavior, native authentication, widgets, and notification delivery still require device validation. No APK is built by this cleanup.

</details>
