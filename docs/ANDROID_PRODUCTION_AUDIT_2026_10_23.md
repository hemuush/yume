# Android production audit — 23 October 2026

Historical Phases 1–3 baseline and approval checkpoint. Branch: `audit/android-production-2026-10-23`, based on `5320285`. Existing widget changes were preserved and included in the reviewed baseline, then committed separately. Findings and source line references below describe that baseline, not the subsequently changed implementation.

The user subsequently authorized fixing all findings. See [current fix status and fresh verification](ANDROID_AUDIT_VERIFICATION_2026_10_23.md). The original scores and reproduction below remain historical evidence; they do not claim current defects or device acceptance.

## Context

- Purpose: local-first personal finance; record money, plan commitments, understand spending. [README](../README.md:1)
- Users/production scale: unknown. India-oriented CI formatting does not establish user count. [CI](../.github/workflows/ci.yml:21)
- Setup: Expo with config plugins/generated native projects; SDK ~58.0.17, RN 0.88.0, React 19.3.0. [package.json](../package.json:5)
- Android only. Portrait and light appearance are explicit configuration choices; tablet requirements are unknown. [app.json](../app.json:5)
- React state/domain contexts; SQLite repositories and freshness hooks; Expo Router; StyleSheet/shared tokens/theme packs. [architecture](ARCHITECTURE.md:5)
- Priority: correctness/stability and visual consistency. Deadline, supported devices and production ledger sizes: unknown.
- No dependency additions or implementation before approval. No iOS acceptance work.

Read the documentation index/architecture guide and exact [SDK58 documentation](https://docs.expo.dev/versions/v58.0.0/). Its React/RN table matches this project. Fresh `npx expo install --check` passed (“Dependencies are up to date”). That establishes SDK compatibility, not absence of newer third-party releases or advisories.

## Phase 1: architecture snapshot

1. `index.js` starts Router and registers the Android widget handler. [entry](../index.js:1)
2. Startup loads fonts/database/settings and gates onboarding, privacy and app lock. [root](../app/_layout.tsx:80)
3. A Stack owns Add/settings/supporting routes; tabs expose Home/Activity/Plan/Reports. [Stack](../app/_layout.tsx:281), [tabs](../app/(tabs)/_layout.tsx:30)
4. `app/` coordinates routes; `src/features/` owns feature UI; `src/components/` supplies reusable controls. [ownership](ARCHITECTURE.md:7)
5. `src/db/` owns local persistence, validation, migrations and financial queries; these journeys have no hosted API/login service. [database](../src/db/client.ts:369)
6. A serialized database queue and explicit transaction/exclusive handles define concurrency boundaries. [queue](../src/db/client.ts:77)
7. React state, freshness tracking and mutation events refresh local data. [freshness](../src/lib/useFreshness.ts:1)
8. Theme tokens, safe-area/keyboard providers and Reanimated support presentation. [tokens](../src/constants/theme.ts:6), [providers](../app/_layout.tsx:157), [dependencies](../package.json:5)
9. Five RemoteViews widgets have separate renderers/data and generated picker previews. [registry](../src/widgets/registry.tsx:1)
10. Release-profile builds remove INTERNET; local backup/export uses explicit sharing. [release config](../app.config.js:1), [sharing](../app/backup.tsx:95)

### Three core journeys: data to UI

**Record/review money.** Startup opens/migrates SQLite and determines onboarding. Home's Add action pushes `/add-transaction`. Add validates/stages entries; `persistStaged` dispatches the financial mutation. Ordinary entries call `createTransaction`, validate and insert parameterized SQL. Successful save returns to the previous screen and publishes changes; Home reads recent entries, Activity reads the selected period and renders grouped rows. Editing returns to Add. No API request occurs. Evidence: [startup](../app/_layout.tsx:80), [navigation](../app/(tabs)/_layout.tsx:19), [save dispatch](../src/features/add/saveEntry.ts:47), [mutation](../src/db/transactions.ts:198), [Home](../app/(tabs)/index.tsx:228), [Activity](../app/(tabs)/transactions.tsx:304). F01 affects exceptional save completion.

**Plan/pay commitments.** Plan aggregates recurring rules, loans, accounts and planning records. Loan/payment actions open details or `PayInstallmentSheet`. The sheet validates dates and guards repeated submission. `payInstallment` rechecks status inside a transaction, creates the ledger entry and updates installment/principal/status together. After commit, reminder refresh and mutation events reload Plan; Undo reverses the payment. A refresh failure is correctly distinguished from payment failure. Evidence: [Plan load](../app/(tabs)/plan.tsx:181), [payment UI](../app/(tabs)/plan.tsx:835), [save/undo](../src/features/loans/PayInstallmentSheet.tsx:73), [transaction](../src/db/loanPayments.ts:36).

**Understand spending.** Reports derives a period/window and requests local comparisons, trends, cash flow, daily totals and categories. Sequence guards prevent stale period loads replacing newer selections; failure sets an explicit error state. A selected heatmap day triggers a debounced query; DayInspector presents entries and opens the day sheet/detail/edit flow. Evidence: [period queries](../app/(tabs)/reports.tsx:215), [day query](../app/(tabs)/reports.tsx:314), [heatmap/inspector](../app/(tabs)/reports.tsx:694). F04 concerns selectable-day targets.

## Phase 2: scorecard

Scores assess source evidence, not device certification. The performance score reflects missing native measurements, not proven slowness.

| Area | /10 | Reason and evidence |
| --- | --- | --- |
| A. UI/design system | 7 | Shared tokens/themes exist; Add uses decorative colors as text. Light/portrait are explicit scope choices. [tokens](../src/constants/theme.ts:28), [config](../app.json:9) |
| B. UX | 7 | Core validation/retry/busy states exist, but a committed entry can be reported unsaved; theme persistence fails silently. [save catch](../app/add-transaction.tsx:782), [theme](../src/theme/AccentContext.tsx:82) |
| C. Accessibility | 4 | Roles/selected states/reduced motion exist; 200% text, contrast and some 44dp targets fail. [text](../src/components/Text.tsx:7), [heatmap](../src/features/reports/SpendHeatmap.tsx:14), [motion](../src/lib/useReduceMotion.ts:19) |
| D. Code quality | 7 | Strict types and repository ownership; oversized coordinators and one production `any` remain. [TS config](../tsconfig.json:4), [Add](../app/add-transaction.tsx:767), [cast](../src/db/maintenance.ts:167) |
| E. Modern RN | 8 | SDK58/RN0.88, Reanimated4/worklets and keyboard controller; fresh SDK compatibility passes, native integration still unverified. [dependencies](../package.json:5), [limits](WIDGET_VALIDATION_2026_10_23.md:24) |
| F. Performance | 5 | Virtualized Activity and real-SQL fixture benchmarks; no native startup/frame/memory acceptance. [list](../app/(tabs)/transactions.tsx:694), [benchmark](../src/perf/loadPerf.test.ts:1) |
| G. Security | 8 | Parameterized writes, app lock, disabled Android backup/release network access; capture errors disappear. [insert](../src/db/transactions.ts:152), [permissions](../app.json:22), [capture](../app/_layout.tsx:198) |
| H. Reliability/DX | 7 | CI checks, transactional migration/restore and error boundary; native acceptance open, performance CI report-only. [CI](../.github/workflows/ci.yml:41), [restore](../src/lib/backup.ts:283), [boundary](../src/components/ErrorBoundary.tsx:18) |

### Assessment details and limits

**UI/UX/accessibility.** Root safe-area/keyboard providers exist; Add coordinates its number pad with keyboard focus. Haptics and reduced-motion support are implemented. Loading/empty/error handling was traced for the three journeys; every screen/state was not executed on a device. Android Back, keyboard overlap, TalkBack traversal, 360dp/tablet layouts need native acceptance. Full dark mode/landscape would change the declared light/portrait product scope. Numeric layout constants are not, alone, proof of defects. [providers](../app/_layout.tsx:157), [keyboard state](../app/add-transaction.tsx:901), [haptics](../src/lib/haptics.ts:1), [motion](../src/lib/useReduceMotion.ts:19)

**Code.** Fresh AST inventory of 454 production TS/TSX files in app/src, excluding tests/test-support/perf: 67 files >300 lines; 1 `any`, 153 `as` expressions, 38 non-null assertions, 0 `ts-ignore`, 0 `ts-expect-error`, 13 `eslint-disable` occurrences. These counts do not make every assertion unsafe: `as const` can be appropriate. Add is 1,310 lines; AmountCard takes 14 props. F09 is a focused extraction proposal, not a blanket rewrite or proof of another runtime bug. Broad contexts and duplicate/dead-code candidates need usage/profiling evidence before changes. [Add](../app/add-transaction.tsx:767), [AmountCard](../src/features/add/AddSections.tsx:34), [only production any](../src/db/maintenance.ts:167)

**Modern RN.** SDK58 targets modern RN; generated release/native-module confirmation remains F07. Earlier Hermes export success does not prove a native build. React Compiler is not opted into in app config; enabling it requires profiling and checking the non-React widget renderers. Activity already uses a configured FlatList, so FlashList/LegendList replacement needs evidence. SQLite is appropriate for relational financial data; no server state establishes a need for TanStack Query, or measured settings bottleneck for MMKV. No remote-image-heavy core journey justifies expo-image. No dependency upgrade is proposed from age alone; a separate advisory/version review is needed before selecting upgrades. [config](../app.json:1), [list](../app/(tabs)/transactions.tsx:694), [widget registry](../src/widgets/registry.tsx:1), [Hermes export](WIDGET_VALIDATION_2026_10_23.md:20)

**Security/reliability.** No remote token/session flow was found; token storage and expired-session checks are inapplicable to these journeys. SQLite opens without application-level encryption; app lock gates UI rather than encrypting the ledger. JSON backup is an explicit export. Restore validates shape/version/schema and uses rollback/exclusive boundaries. Encryption changes need a threat-model/product decision. Scoped source searches found no fetch/axios, EXPO_PUBLIC secret usage or production console.log. console.warn/error remain, including raw boundary error messages; zero production diagnostic output is not met. Remote reporting/analytics are absent by explicit local-only design. Adding telemetry conflicts with current network/privacy policy and needs a decision. OTA is not configured; signed-package update/rollback remains release work. [open](../src/db/client.ts:371), [backup validation](../src/lib/backup.ts:119), [boundary diagnostics](../src/components/ErrorBoundary.tsx:25), [network policy](../app.config.js:1)

## Phase 3: top five issues

1. A saved entry can be reported unsaved; retry can create another entry (F01).
2. Shared text prevents users reaching 200% font size (F03).
3. Add uses insufficient-contrast coral/green operator labels (F02).
4. Reports' day matrix is too small for reliable touch selection (F04).
5. Native release, TalkBack and performance acceptance remain unproven (F07).

### Findings sorted by priority

Priority = Impact × (6 − Effort). Equal scores can have different risks. Effort includes regression checks. Confidence concerns evidence, not frequency. No Critical issue was established.

| ID | Title | Severity | Impact | Effort | Priority | Confidence | Location | Problem/impact | Proposed fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Save rejects after entry commits | High | 5 | 2 | 20 | High; reproduced | [transactions:198](../src/db/transactions.ts:198), [Add:773](../app/add-transaction.tsx:773), [dispatch:69](../src/features/add/saveEntry.ts:69) | INSERT commits before result SELECT. If SELECT fails, the promise rejects, Add has not incremented `saved`, reports “No entries saved” and retains the row. Direct retry inserted a second row in the fault test. | Validate/write/convert result inside one transaction on its supplied handle; reminders remain after commit. Rejected saves must leave no new row. Preserve staged partial-save semantics. |
| F02 | Add operator contrast fails | Medium | 3 | 1 | 15 | High; calculated | [type colors:25](../src/features/add/addEntry.ts:25), [keypad:89](../src/components/AmountPad.tsx:89), [tone passed:906](../app/add-transaction.tsx:906) | Expense #F0876A/#FFE3D6 = 2.054:1; income #1C9A5B/#DDF2E5 = 3.075:1. Both miss requested 4.5:1; expense also misses 3:1 large-text threshold. | Use readable semantic inks while retaining pastel fills. Verify every entry/refund tone and related amount label with contrast regression assertions. |
| F03 | Text capped at 130% | High | 4 | 3 | 12 | High | [Text:7](../src/components/Text.tsx:7) | Shared Text/TextInput default to maxFontSizeMultiplier 1.3. The 200% requirement cannot be met; comments acknowledge fixed-layout clipping beyond the cap. | Adapt wrapping/layout/heights before removing/raising cap. Product choice: support 200% responsively or relax the requirement; uncapping alone is unsafe. |
| F04 | Reports day targets below 44dp | Medium | 3 | 2 | 12 | High | [dimensions:14](../src/features/reports/SpendHeatmap.tsx:14), [targets:198](../src/features/reports/SpendHeatmap.tsx:198), [styles:295](../src/features/reports/SpendHeatmap.tsx:295) | Calendar cells are 40dp tall; matrix days 16dp. At 360dp, even before card padding, each of 31 columns has at most (360−34)/31 = 10.52dp width. No target expansion. | Provide 44dp day navigation/list or zoomed-month interaction alongside overview. Do not overlap hit areas across 31 columns. Preserve spoken summaries/selection. |
| F05 | Quick Add targets below 44dp | Medium | 3 | 2 | 12 | High | [main action:22](../src/widgets/QuickAddWidget.tsx:22), [small actions:123](../src/widgets/QuickAddWidget.tsx:123) | Main action is 38dp high; Income/Move are 28dp. Click actions attach to these native containers; refreshed visuals retain this gap. | Enlarge clickable bounds and regenerate previews. Product choice: larger minimum widget height or fewer compact actions. Verify actual launcher sizing. |
| F06 | Capture-protection failure silent | Medium | 3 | 2 | 12 | High for handling; occurrence unknown | [root:198](../app/_layout.tsx:198) | prevent/allow-screen-capture rejection is discarded. Enabled lock has no indication or retry if protection fails. This is a protection-status gap, not a proven authentication bypass. | Track/report failures, retry relevant lifecycle changes. Decide warning versus blocking financial UI when capture protection is unavailable. Test rejection/races. |
| F07 | Native acceptance incomplete | High | 4 | 3 | 12 | High | [CI:41](../.github/workflows/ci.yml:41), [SQL benchmark:1](../src/perf/loadPerf.test.ts:1), [limits:24](WIDGET_VALIDATION_2026_10_23.md:24), [device checks:24](RELEASE_DEVICE_CHECKS.md:24) | JS export and Node SQL tests do not prove an installable native release, TalkBack, RemoteViews, startup or frame rate. Device checklist remains “Not run.” | Build/install candidate; run three journeys plus backup/lock/widgets. Add approved Android E2E coverage and record accessibility/performance. No dependency without approval. |
| F08 | Theme persistence fails silently | Low | 2 | 2 | 8 | High | [context:82](../src/theme/AccentContext.tsx:82), [accent setter:206](../src/db/settings.ts:206), [theme setter:231](../src/db/settings.ts:231) | UI updates immediately; ID/accent writes are separate and both errors discarded. Next launch can revert or read inconsistent persisted fields. | Persist both atomically, guard rapid-selection ordering, surface retry/failure or rollback. Test partial write failure and rapid choices. |
| F09 | Add concentrates coordination | Medium | 3 | 4 | 6 | High for structure | [save coordinator:767](../app/add-transaction.tsx:767), [AmountCard:34](../src/features/add/AddSections.tsx:34) | 1,310-line route coordinates ordinary/linked/friend/staged saves and UI; AmountCard takes 14 props. Review/regression cost exceeds requested structure standards. No separate runtime failure proved. | After F01, extract typed save coordination and cohesive form/view data in small behavior-preserving steps. |
| F10 | Maintenance erases bind types | Low | 1 | 1 | 5 | High | [cast:167](../src/db/maintenance.ts:167), [bind contract:8](../src/db/dbTypes.ts:8) | `ids as any[]` bypasses SqlParam; only production any keyword found. No runtime corruption demonstrated. | Preserve queried ID types or narrow values before binding, without another unchecked assertion. |

### Fresh evidence versus earlier validation

An isolated ignored test in `design-preview/audit/` ran actual transaction repository logic on the existing real-SQLite adapter. Only the result SELECT was faulted: `createTransaction` rejected; row count was 1; direct retry made it 2. The demonstration passed (1 suite/1 test): passing confirms the defect, not correctness. UI consequences follow Add's counter/catch path; no UI E2E duplicate-entry test was run. No production code changed.

Fresh checks: the reproduction above, sRGB contrast calculations, AST inventory, SDK dependency compatibility. No full-suite rerun during this read-only audit.

Earlier widget-work checks are separately recorded: 326 suites/11,392 tests passed, 2 skipped; targeted widgets/types/lint/format/cycles/security/perf, isolated prebuild and Android JS export passed. These are earlier working-tree results, not a fresh audit test run or native acceptance. [validation record](WIDGET_VALIDATION_2026_10_23.md:12)

### Performance/device measurement plan

| Metric/check | Target | Evidence now | How to measure |
| --- | --- | --- | --- |
| Cold start | <2s mid-range Android | Unknown | Release APK, fixed device/API/ledger; Macrobenchmark/Perfetto cold TTID/fully-drawn measurements, median/p95. adb am start -W is supplementary. |
| Frames | Sustain refresh budget; 60fps+ requested | Unknown | Perfetto/FrameMetrics/gfxinfo during Activity scroll, Reports scrub, sheets; frame percentiles/jank. |
| Memory/leaks | Stable across repeated journeys | Unknown | dumpsys meminfo/heap before and after ten journey/background-resume loops; account for GC/native bitmap memory. |
| SQL load | Representative data sizes | Node fixture benchmark only | Same fixture on device/expo-sqlite; queued query count/slow statements. Node SQLite timing is not phone timing. [benchmark](../src/perf/loadPerf.test.ts:1) |
| JS bundle | Track same-config delta | Earlier 8.3MB Hermes, 2,314 modules, 38 assets | Repeat after approved changes; attribute module/size delta. [record](WIDGET_VALIDATION_2026_10_23.md:20) |
| App size | Establish baseline | Current APK/AAB not built here | Signed candidate, APK Analyzer/bundletool; distinguish compressed download, installed app and ledger size. |
| A11y/layout | TalkBack, 360dp, 200%, tablet | Unverified; F03 caps fonts | Handset/tablet or emulator, large font/display settings, long text/amounts, focus/labels, keyboard/Back. |
| Privacy/lifecycle | Lock/capture/widgets | Native acceptance pending | Screenshots/recents, background/resume, launcher resize/reboot, notification/deep links while locked. |

Needed: JDK/Android SDK/signing through normal build workflow, release candidate, representative mid-range device/API/launcher, ledger-size expectations and tablet requirements. `adb` and `java` were unavailable on PATH. Browser previews cannot establish these metrics. Core journeys are local: slow network/expired server sessions do not apply. Check OS dark appearance against configured light UI; full dark mode and rotation support require scope decisions.

### Quick wins: estimated under one day each

- F01: correct the transaction boundary with read-failure/rollback regression coverage; highest priority.
- F02: semantic text inks and contrast checks across Add tones.
- F08: atomic theme persistence and honest failure feedback.
- F10: correctly typed/narrowed IDs at the SQL boundary.

### Roadmap

**Now:** approve IDs; F01 first, F02 next. Decide 200% scope, widget compact actions and capture-failure policy. Each approved fix gets a failing regression where testable, required checks, its own commit and a pause for “next.”

**Next:** F03–F06/F08, then native release/E2E/accessibility/performance acceptance F07. Regenerate picker assets when widget layout changes. Actual device failures become separate evidence-backed fixes.

**Later:** staged F09 extraction; F10 if not included among quick wins. Profile before compiler/list/cache/export changes. Decide whether local diagnostic export or optional remote reporting fits the privacy product; no telemetry added here.

### What is done well

- Derived balances prevent a separately stored total drifting. [accounts](../src/db/accounts.ts:15)
- Payment status is rechecked inside its transaction; save and refresh failures are distinguished. [payment](../src/db/loanPayments.ts:39), [feedback](../src/features/loans/PayInstallmentSheet.tsx:95)
- Migrations/restore have explicit rollback and exclusivity; untrusted backups are validated. [migrations](../src/db/client.ts:377), [restore](../src/lib/backup.ts:119)
- Reports guards stale loads and clears debounce timers. [sequence](../app/(tabs)/reports.tsx:248), [cleanup](../app/(tabs)/reports.tsx:333)
- Startup privacy gating and release permission restrictions suit local-only finance. [startup](../app/_layout.tsx:102), [config](../app.config.js:1)
- Strict types, real-SQL tests, pinned CI actions and security checks are a strong regression base. [TS](../tsconfig.json:4), [CI](../.github/workflows/ci.yml:29)
- Widget previews are reproducible, with explicit native-validation limits. [widget record](WIDGET_VALIDATION_2026_10_23.md:5)

## Approval checkpoint

All findings remain **Not fixed by this audit**. Release readiness is not certified: F01 is reproduced and F07 remains open. Approve IDs to fix. No fix commits/dependencies added. Future commits must stage only approved changes while preserving the existing dirty widget baseline.
