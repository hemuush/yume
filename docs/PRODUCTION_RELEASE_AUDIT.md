# Production release audit

Current source and validation: see the [release follow-up audit](RELEASE_FOLLOWUP_AUDIT.md). This document retains the preceding audit record.

Recorded 13 October 2026. Source baseline: `4dff801ff2ddc88aa5745c458e60d4b547b15154`, plus the release fixes described below. This is release-candidate evidence, not a claim that every phone has been tested.

## Decision

Automated application checks passed. Public-release sign-off remains pending a fresh native build containing the permission/provider fixes and physical-device checks. Do not ship build 9 as the final production artifact: it contains the two native findings below.

## Findings and fixes

| Priority | Finding                                                                                                                                                                                | Resolution                                                                                                                                                                                                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Build 9 exported the widget library's image provider without caller restrictions. Predictable widget image names could expose displayed financial information to other installed apps. | A prebuild plugin replaces it with `PrivateWidgetImageProvider`. File reads check Binder UID: this app, Android's system UID, or the currently selected home launcher only. Filenames are restricted to widget PNGs; superclass read-only handling remains. No launcher resolved means access is denied. Other providers and queries are preserved. |
| Medium   | The signed APK inherited `READ_MEDIA_IMAGES` for Android 13 from expo-screen-capture, although Yume only blocks screenshots and does not detect them.                                  | Explicitly blocked in app.json. Screenshot prevention requires no photo permission, per the [SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/).                                                                                                                                                                     |
| Low      | package.json allowed Node 22.0, below the SDK 57 minimum.                                                                                                                              | Root package and lockfile now require Node >=22.13.0. Current local Node is 24.15.0.                                                                                                                                                                                                                                                                |

The widget change intentionally retains native rendering via the selected launcher, rather than making all RemoteViews image reads fail. Its generated manifest/source and security contracts are checked locally; actual launcher behavior and native compilation must be verified in the fresh APK. Home-launcher changes, no default launcher, widget resize, hide-values and reboot are required checks. Work-profile/alternative widget hosts have not been validated.

## Scope and evidence

- Startup/onboarding: database initialization retries, existing-data detection, font failure fallback, locked navigator gate and notification routing.
- Data integrity: serialized SQLite access, transactional migrations, duplicate-save guards, transfer/currency scope, loan payment/undo ordering, person ledger links, reservations and refund receipt validation.
- Restore: schema/amount/date/link validation before replacement, rollback and foreign-key checks, consistent pre-restore safety copy, device-owned preferences and post-restore refresh containment.
- Backup: foreground catch-up precedes snapshot; existing folder contents are reviewed by contents/date; writes complete before replacement/retention. Plain JSON, local storage and whole-unit entry remain owner-selected product decisions.
- UI/navigation: full screen smoke tests and feature suites cover all routes, empty/populated/privacy states, forms, drill-downs, wrapping, reduced motion, completion, undo and shared modals. Native rendering, system keyboard and real screen-reader operation remain device checks.
- Security/configuration: no application fetch/axios calls or debug statements found by the source scan; no tracked signing-key, service-account or environment-secret files found by the filename scan. These scans are not a forensic secret-history audit.

## Fresh validation

| Check                                  | Result                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main regression run                    | 262 suites, 10,846 tests passed; two performance tests intentionally skipped; process exited normally                                                                         |
| Type checking, full ESLint, formatting | Passed before native hardening; changed plugin/security/config files checked separately afterward                                                                             |
| Security checks                        | Eight passed, including URI decoder and widget privacy configuration/idempotence/source guards                                                                                |
| Dependency audit gate                  | Passed with existing braces/node-forge tooling exceptions; neither allowance was broadened                                                                                    |
| Expo Doctor                            | 21/21 passed                                                                                                                                                                  |
| Android JS/Hermes export               | Passed, 2,324 modules and 40 assets; `.expo/production-audit-android`                                                                                                         |
| Performance/parity                     | Both dedicated tests passed; desktop Home 81ms / Reports 114ms / Plan 9ms / Backup 41ms, not phone frame timings                                                              |
| Production configuration introspection | Passed: photo permission removal and guarded provider replacement present                                                                                                     |
| Fresh native build                     | Build 10 requested: [EAS candidate](https://expo.dev/accounts/xyumex/projects/yume/builds/7ae72adf-66ff-479f-9a30-935d8da740a7); native success/artifact reinspection pending |

The full application suite ran against the same app logic/UI as the release candidate. Later changes are native configuration, a generated provider, tooling floor and documentation; native behavior is not established by Jest.

Two high-severity advisories remain in development/build tooling, with no patched version reported in their current [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). The passing gate is not zero vulnerabilities. Recheck before each release and remove exceptions when a compatible patch exists.

Baseline GitHub CI completed successfully: [run 38343034930](https://github.com/hemuush/yume/actions/runs/38343034930). This run belongs to `4dff801`; it does not establish CI success for the subsequent native-hardening commit.

## Inspected artifact

Build 9: version 1.0.0, package com.yume.app, min SDK 24 / target SDK 36, arm64-v8a only. EAS reported FINISHED. The binary XML manifest confirms no INTERNET, overlay or broad legacy storage permissions; allowBackup=false and no debuggable=true flag. It also revealed READ_MEDIA_IMAGES and the unrestricted widget provider, hence the fixes above.

SHA-256: `116e9990ade0e74b99fab11699731fb7ff6aa3ac00a8ac79c17ecf9be785a0b6`.

Local ignored evidence: `.expo/audit-build9.apk`, `.expo/apk-release-inspection.json`, `.expo/production-audit-config.json`. These generated artifacts are not committed. The preview APK's arm64 support does not describe a future production AAB, whose manifest, architectures and native libraries must be inspected independently.

## Release handoff gates

1. Use a successful fresh signed artifact with the native fixes; verify package/version/signing continuity, permissions and provider access. Build a production AAB for Play distribution using the production profile after device acceptance.
2. Install as an upgrade with real data and as a fresh install. Check onboarding, cold start, resume/back, PIN/biometric success/cancel, denied notifications and app shortcuts.
3. Verify all five widgets, hidden values, launcher changes, resize and reboot; an unrelated test app must be denied image reads. App lock and widget privacy are separate controls.
4. Exercise Add keyboard/calculator, edit/delete/undo, transfer/refund, EMI/prepayment, goal/reservation, settlement and recurring catch-up. Verify linked balances before/after.
5. Export/restore known data, invalid/future backups, existing newer folder data, revoked permissions and low-storage failure. Use copied test data rather than the sole personal backup.
6. Visually review narrow phone, large text, long labels/amounts and the recently changed calendar/Reports/loan sheets. Profile navigation/scrolling with realistic data and reduced motion; record device, OS and results.
7. Complete distribution-specific privacy/data-safety, financial-feature declarations, listing/contact and content-rating requirements in the release console. No store metadata or public privacy policy was verified in this audit.

No Android SDK/adb or attached phone was available here. Desktop timing, export and tests do not prove these native/device gates. Freeze feature work after acceptance, retain the signing key and backup compatibility, and handle subsequent fixes as versioned maintenance.

## Subsequent notification follow-up

This earlier validation record is superseded for current-source sign-off by [release follow-up audit](RELEASE_FOLLOWUP_AUDIT.md). Build 10 completed and its permission/provider packaging and certificate continuity were inspected, but it predates the new notification fixes. The owner reported missing reminders; handset delivery remains unconfirmed. See the [manual acceptance checklist](RELEASE_DEVICE_CHECKS.md) and keep production approval open.
