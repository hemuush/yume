# Android audit fixes and verification — 23 October 2026

Release-ready: **No**. Seven code findings are implemented; two product-dependent fixes and native acceptance remain open. Android only. Branch: `audit/android-production-2026-10-23`, original revision `5320285`. No dependency additions, schema migrations, remote telemetry or changes to the declared light/portrait scope.

## Finding status

“Fixed” below means the source correction and automated regression pass; it does not imply completed Android visual or accessibility acceptance.

| ID | Status | Current evidence / record |
| --- | --- | --- |
| F01 | Fixed | [Result read/conversion inside transaction](../src/db/transactions.ts:198); faulted read leaves no inserted row and retry creates one. [Fix and tests](F01_TRANSACTION_SAVE_2026_10_23.md). Commit `5551896`. |
| F02 | Fixed | [Semantic entry inks](../src/features/add/addEntry.ts:19); all entry/refund/theme contrast assertions pass. [Fix](F02_ADD_CONTRAST_2026_10_23.md). Commit `9b5b2d1`. |
| F03 | Fixed in code; native acceptance open | [200% policy](../src/constants/theme.ts:125), [responsive text/input](../src/components/Text.tsx:19), [shared OS subscription](../src/lib/useFontScale.ts:7). Wrapping, growing keys/inputs and active-tab label tests pass. [Fix](F03_LARGE_TEXT_2026_10_23.md). Commit `4b3eebc`. |
| F04 | Fixed in code; native acceptance open | [Searchable day/month sheet](../src/features/reports/HeatmapDayPicker.tsx:17) supplies full-width controls alongside the dense overview. Calendar controls are at least 44dp. [Fix](F04_HEATMAP_TARGETS_2026_10_23.md). Commit `208d694`. |
| F05 | Not fixed; product choice pending | [Quick Add](../src/widgets/QuickAddWidget.tsx:22) retains 38dp primary/28dp secondary actions. Keeping four category actions at 44dp also needs at least 176dp inner width, plus padding. Choose a larger minimum widget or fewer actions in the compact widget before changing its launcher footprint. |
| F06 | Not fixed; product choice pending | [Capture effect](../app/_layout.tsx:200) still discards native rejection. Choose a visible warning with retry while allowing use, or a blocking protection-error screen. No authentication bypass was demonstrated. |
| F07 | Partial: automated verification completed; native acceptance not run | [Device checklist](RELEASE_DEVICE_CHECKS.md). No JDK/adb/SDK or connected Android acceptance environment was available. No fresh APK/AAB, native E2E, TalkBack, frame/startup/memory certification. |
| F08 | Fixed | [Atomic settings write](../src/db/settings.ts:242), [ordered provider/rollback](../src/theme/AccentContext.tsx:96) and unlocked failure feedback. Real-SQLite partial-statement abort and rapid-selection tests pass. [Fix](F08_THEME_PERSISTENCE_2026_10_23.md). Commit `09bb1d6`. |
| F09 | Fixed | [Thin route](../app/add-transaction.tsx:1), [feature model](../src/features/add/hooks/useAddEntryModel.ts:14), [AmountCard](../src/features/add/components/AmountCard.tsx:22) with five grouped props. New view files <200 lines and modules <300. [Fix](F09_ADD_STRUCTURE_2026_10_23.md). Commit `876c105`. |
| F10 | Fixed | [Honest SQL row type](../src/db/maintenance.ts:104), [production lint guard](../eslint.config.js:26). Real-SQLite rounding/undo regression: 32 tests pass; the new lint guard failed before correction. Full suite and coverage pass. [Fix](F10_TYPED_MAINTENANCE_2026_10_23.md). Commit `446b0ca`. |

The requested widget visual work is separately committed as `3a1a4db`: five current-app renderers/picker previews, reproducible preview generator, theme fonts/inks and card surfaces. [Widget validation](WIDGET_VALIDATION_2026_10_23.md) records that work's earlier checks. It does not close F05 or native launcher acceptance.

## Fresh validation

- Strict type-check, whole-repository lint, formatting, circular-import check: pass after F10 source change. No lint warnings. Cycle check covers 487 modules.
- Security tests: 7 pass (URI dependency removal, release permission/plugin registration, guarded widget provider and repeat-prebuild behavior).
- F10 targeted real-SQLite regression: 2 suites / 32 tests pass.
- Last completed normal full suite after F09: 331 suites / 11,434 tests pass, 2 suites/tests skipped (performance suites run separately); 379.6 seconds.
- Fresh full coverage against original `5320285`: 326 suites / 11,395 tests pass, 2 skipped; 802.9 seconds.
- Fresh final full coverage after all seven implemented findings: **331 suites / 11,434 tests pass**, 2 skipped; **567.3 seconds**. No failures.
- Separate performance/output-snapshot fixture run: **2 suites / 2 tests pass**, 14.86 seconds, default 20,000-entry fixture. This runs the normally skipped suites; it is not phone performance acceptance or a before/after numerical parity comparison.

The coverage runs use the same explicit production app/src scope, exclude tests/test support/performance harnesses/declarations, and use existing dependencies. Coverage instrumentation uses a 60-second test timeout on this memory-constrained host; normal regression runs retain the project's 20-second timeout. No test assertion is relaxed.

Prior negative-path tests can emit expected diagnostics; some legacy Router fixtures emit partial-module warnings with the verbose reporter. These were not hidden with code changes, and a passing suite is not a claim of zero existing console diagnostics.

## Metrics

| Metric | Original | Updated | Meaning / limit |
| --- | --- | --- | --- |
| Expense entry text contrast | 2.054:1 | 4.572:1 | Same pastel fill; semantic ink, above 4.5:1. |
| Income entry text contrast | 3.075:1 | 4.758:1 | Same pastel fill; semantic ink, above 4.5:1. |
| Shared maximum font scale | 1.3 | 2 | Responsive source/component coverage; Android visual acceptance pending. |
| Add route lines | 1,310 | 8 including final newline | Cohesive feature owners replace the monolithic route; no speed claim. |
| AmountCard inputs | 14 | 5 grouped | Behavior-preserving presentation contract. |
| Production explicit `any` | 1 | 0 | TypeScript AST count, excluding tests/support/perf. |
| Production files >300 lines | 67 / 454 | 65 / 486 | Scope is production TS/TSX; not a claim every legacy module meets new-file standards. |
| `as` / non-null assertions | 153 / 38 | 152 / 38 | Includes legitimate const assertions. No blanket unsafe-cast conclusion. |
| TypeScript suppression directives | 0 | 0 | `ts-ignore` and `ts-expect-error`. |
| Existing ESLint suppression occurrences | 13 | 13 | None added as fixes. |
| Statement coverage | 86.84% (14,975 / 17,243) | 86.98% (15,145 / 17,412) | +0.14 percentage points. Same scope/config; extraction alters denominator. |
| Branch coverage | 81.92% (12,948 / 15,805) | 81.95% (13,018 / 15,884) | +0.03 percentage points. |
| Function coverage | 81.35% (3,887 / 4,778) | 81.54% (3,928 / 4,817) | +0.19 percentage points. |
| Line coverage | 88.18% (13,332 / 15,118) | 88.32% (13,499 / 15,283) | +0.14 percentage points. |
| Cold start / frames / memory / APK size | Unknown | Not measured | Needs a release candidate and representative Android device. No <2s or 60fps claim. |

No performance finding was fixed through speculative memoization or dependency replacement. Node SQL fixture timings are not Android measurements. Earlier Hermes export sizes are historical and are not a comparable fresh before/after native metric.

## Review, risks and rollback

Each implemented finding has its own commit and linked root cause, evidence, changed files, manual steps and rollback. The widget baseline has its own commit. Revert the relevant commit for rollback; no schema rollback is required. All newly introduced financial writes retain bound SQL parameters and transaction handles. Theme persistence reports failure without exposing raw technical messages in user UI.

F09 has the largest structural risk: hook lifetimes, hydration dependencies, committed/submission refs, draft recovery and delayed navigation. Existing Add behavior tests were retained, stable dependencies verified, timers cleaned up and the complete suite rerun. F03 changes shared layout policy and needs visual checks across legacy fixed-height containers. F04 adds a virtualized, searchable selector rather than overlapping touch bounds in the matrix.

Issues encountered during verification: the startup-privacy fixture needed the expanded provider mock; it was corrected without weakening privacy assertions. Extraction exposed missing moved imports and hook dependency warnings; aliases and stable dependencies were fixed, with no suppressions. No unresolved failing regression is accepted.

The temporary baseline is an ignored source archive under `design-preview/audit/`, sharing the existing dependency directory through a junction. Automatic approval review blocked removal of that junction with no specific reason beyond policy; the copy is retained. It contains repository source, not a copied user ledger. Coverage reports are local ignored artifacts, not committed app assets.

## Remaining acceptance and decisions

1. F05: recommended direction is all existing actions with a larger minimum widget. A compact alternative removes category actions. Update native minimum dimensions and generated picker preview together, then inspect actual launcher bounds/resize behavior.
2. F06: recommended direction is visible warning/retry with existing access retained. A blocking screen changes availability and needs explicit approval. Either implementation needs rejection, overlapping-toggle, background/resume and retry tests.
3. F07: provide the approved Android SDK/JDK/device build workflow and whether Maestro tooling/flows may be added. Do not install dependencies/tooling implicitly. Build/install the candidate and run record money, pay a commitment and inspect spending, plus restore, lock and widgets on disposable data.
4. Record 360dp/200% text/long labels/tablet checks; keyboard/Back; TalkBack roles/order/actions; OS dark appearance under configured light UI; background/resume; launcher refresh/resize/reboot; reminder/deep-link privacy while locked. Rotation support and a full dark theme change current product scope.
5. Measure cold start median/p95, frame budget/jank and stable memory over ten repeated journeys using the same device/API/fixture and release configuration. Record APK/AAB/download size separately. Inspect release diagnostics/debug/test keys using the built candidate.

Offline is the normal local-SQLite architecture. Hosted-network failure/expired server sessions are not applicable to the three core journeys. Native permission failure, storage failure, empty data and lifecycle recovery still require device acceptance. No iOS work or certification is claimed.
