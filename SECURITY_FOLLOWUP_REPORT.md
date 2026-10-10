# Security follow-up

## Preserved design decisions

Readable JSON backups, whole-unit amount entry/display, and ordinary local SQLite remain intentional. No feature was removed. No APK was built.

## Implemented

- Patched router URI decoding with upstream decode-uri-component 0.5.0, adapted only from ESM export to CommonJS for SDK 57's query-string. The MIT-licensed compatibility copy lives in vendor/decode-uri-component; a hash test verifies the upstream source. Remove it when the SDK supports the upstream module directly.
- Updated xcode's UUID dependency to 11.1.1 via a scoped override, preserving its v4 API and 24-character generated project IDs.
- Added Settings > Privacy & alerts > Hide widget details. Off by default; when enabled, financial widgets show a generic prompt to open Yume. Quick Add remains functional. Saved changes immediately request widget updates; failed writes retain the saved state, and failed privacy reads hide details. Restore preserves this phone's saved widget privacy.
- Clarified automatic backup labels: backups run when Yume is opened on/after the due date, rather than promising unattended background execution. The format, retention and cadence are unchanged.
- Added repeatable npm run test:security and npm run test:perf commands. CI executes the security checks.

## Dependency status

Production dependency audit decreased from 26 affected package entries (14 high, 12 moderate) to 14 high and zero moderate entries. Remaining entries propagate two existing advisories: node-forge <=1.4.0 and braces <=3.0.3. npm registry checks found no patched release for either. The existing audit gate permits these documented build/test-tool advisories, without weakening certificate validation or changing the Expo SDK. They are not application API endpoints. Continue checking for upstream fixes; avoid npm audit fix --force's incompatible SDK downgrades.

Advisories: https://github.com/advisories/GHSA-vcc3-ghjq-m6fr ; https://github.com/advisories/GHSA-86w9-cpqp-85rv ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

## Validation

- Four Node security/compatibility tests passed: router unicode/plus/repeated parameters, malformed input under a subprocess timeout, Xcode UUID compatibility, upstream source hash.
- Full source regression passed: 247 suites, 10,721 tests, zero failures. Two opt-in performance tests were skipped in this run and passed separately with PERF=1. The rerun used --forceExit after the initial process remained alive; this validates assertions, not the absence of dangling test-process handles. The shortcut config-plugin test now uses Node export conditions to match its build-time environment.
- Fresh isolated dependency installation passed query-string/decoder integration; npm ci dry-run validates the project lockfile.
- TypeScript, repository-wide lint, formatting, and all 21 Expo Doctor checks passed.
- Android production JavaScript/Hermes bundle export succeeded (2,301 modules); this is not an APK build or a physical-device test.
- 20,000-entry real-SQLite desktop benchmark and output parity passed. One measured cold run: Home 75 ms/52 queries, Activity month 11 ms/15, Reports month 113 ms/51, Plan 9 ms/5. These numbers do not measure Android frame time, native bridge cost, scroll smoothness, memory, or startup.

## Remaining device check

No accessible adb/device connection was found in this environment. Device frame profiling remains pending; phone model, Android version and the lagging screen/action were requested. Use representative data on a release installation, exercise Home category taps, Activity scrolling, Reports switches, Plan navigation and Add keypad, and record frame pacing/memory/startup. Do not infer phone smoothness from desktop timings or passing rendering tests.
