# Release readiness — 14 October 2026

Follow-up: preview build 15 was submitted with these fixes using the existing signing key: [build page](https://expo.dev/accounts/xyumex/projects/yume/builds/f4528fb4-decc-4a47-a217-9a0a481192c5). No device acceptance or final artifact inspection is claimed by that submission.

This review applies to the local working tree after preview build 14. It is not device acceptance or a claim that every possible state has been proven correct. Build 14 does not include the subsequent Add/Reports label keyboard fixes or this final filter refinement.

## Review scope

The route inventory contains 26 TSX files. The source inventory contains 654 TS/TSX files, including test/support files. Whole-project type checking, lint, formatting, regression and Android export cover the project mechanically; that does not mean every file received a line-by-line human or rendered-screen review.

Source inspection focused on startup/onboarding/lock, freshness and duplicate-save guards, SQLite serialization/migration/restore boundaries, notification lifecycle, widget configuration, label currency/privacy/refund scope, Reports and Activity flows, shared sheets and financial presentation. The full screen smoke and feature suites exercise navigation and major screens. Current ownership remains routes in `app`, presentation in `src/features`, shared controls in `src/components`, persistence in `src/db`, and independent/platform logic in `src/lib`. Broad structural renames and speculative deletion were avoided during the release pass.

## Changes from this pass

- Activity label suggestions load once per opening/type/privacy scope, then filter locally instead of clearing and requerying on every keystroke.
- Applying, clearing or closing Activity filters dismisses the keyboard; the label field's Done key dismisses it too.
- Activity search wording includes labels and notes.
- The full regression found four label text styles without explicit Yume font tokens; they now use the body font. The focused font-consistency rerun passed after correction.
- The build guide points to the actual latest submitted preview, and distinguishes that artifact from newer source.

Earlier local fixes retained: cold-start profile initials; one expense Label field with backward-compatible storage; compact label picker/report, explicit load failures and retry, keyboard dismissal, guarded late responses; corrected trend touch mapping with unavailable months; scrolling custom-range calendar. Financial calculations and database schema were not changed in this pass.

## Fresh validation

Historical reports are not substituted for these runs.

- Full regression: 268 suites passed, one font-consistency suite failed, two opt-in performance suites skipped; 10,895 tests passed and one failed (10,898 total including two skips), 1,097.584 seconds. That font failure identified the four styles corrected above. The focused font-consistency rerun then passed its one test, exit 0. This is combined evidence, not a claim that the original full command exited successfully. Performance suites ran separately and passed as recorded below.

- Security regression: 8/8 checks passed.
- Expo Doctor: 21/21 checks passed.
- Whole-project type checking, ESLint and Prettier check passed. Changed Activity filter files received a separate post-change check.
- Android export passed with two Metro workers: 2,327 modules, 40 assets and an approximately 8 MB Hermes bundle. The earlier default-worker export was stopped due to resource contention, then rerun successfully. This is not a signed native build.
- Opt-in performance/output-parity: both suites and both tests passed. Sample harness timings: Home 81 ms, Activity month 13 ms, Reports month 118 ms, Plan 10 ms, backup snapshot 43 ms. These are local test-harness timings, not Android frame-rate or cold-start measurements.
- Activity filter focused regression after refinement: 14 tests passed.
- Final post-font-fix checks: font consistency plus Add/Reports label components, three suites / 10 tests passed. Changed files passed lint and whole-project type checking. Final Android export after the font correction passed (bundle `index-0634682f5b515653e82196872326f0fc.hbc`).
- Filename scan found no tracked `.jks`, `.keystore`, `.p12`, `.env*` or service-account files. This is not a secret-history audit.
- Source scan found no application fetch/axios calls, `console.log`, TODO/FIXME/HACK or `@ts-ignore` markers in non-test application TS/TSX. Documented hook lint suppressions remain for specific lifecycle/gesture contracts.

## Dependency findings remain open

`npm audit --omit=dev` returned 14 high findings, zero critical findings. They include transitive build-tool dependencies; the production dependency classification includes Expo/Metro CLI tooling. This does not establish that these packages execute in the installed app, nor does it justify calling the audit clean.

The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects versions through 3.0.3 and lists no patched version. The [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) affects versions through 1.4.0. The registry's latest versions checked were 3.0.3 and 1.4.0 respectively. No incompatible Expo/React Native downgrade or unverified vendored crypto/parser patch was applied. Recheck fixes before release; use trusted source/build inputs and keep development tooling off public networks. These remain unresolved toolchain risks requiring release review.

## Device and artifact gates

Use [device acceptance](RELEASE_DEVICE_CHECKS.md) on a fresh candidate. In particular verify:

1. Upgrade preserves data; fresh install completes onboarding.
2. Add labels and Reports label search with keyboard open, long labels, enlarged text and navigation/back dismissal.
3. Lock automatic prompt, cancel/retry, resume and app-switcher privacy.
4. Real notification tray delivery and conditional morning/evening behaviour with battery restrictions.
5. Widgets, hidden amounts, resize/reboot and launcher compatibility.
6. Expense/edit/delete/undo, refund, transfer, EMI, people settlement and goal reservation correctness.
7. Backup folder discovery/latest-file review, restore rollback and recovery on copied test data.
8. Narrow-screen scroll/action reachability, screen reader and reduced motion across financial/settings screens.

The final signed APK/AAB still requires manifest/permissions/provider/signing checks and native installation. Android JavaScript export is not an APK or Play Store submission. No new APK, commit, push or production publication is part of this audit request. Public-release readiness remains pending device/artifact acceptance and dependency-risk review.
