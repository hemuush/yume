# Release follow-up audit

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Recorded 13 October 2026. Baseline `bc5c1f8`, with notification diagnostics and the fixes below. This follow-up corrects the earlier audit's emphasis on automated pass counts: native permission, scheduling, launcher and keyboard behavior remain unverified until device acceptance. The owner can test manually; no connected-device tests were performed.

## Findings fixed

| User journey / failure                                  | Confirmed gap                                                                                                   | Fix and regression evidence                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enabling notifications on Android 13+                   | The reminder channel was not ensured before permission requests                                                 | Channel creation precedes permission check/request; bridge-order test                                                                                  |
| Opening an app whose process stayed alive for many days | Reminders were planned for 14 days, renewed on cold start/writes but not every foreground-maintenance run       | Renewal after catch-up, before backup, including zero due recurring entries; overlapping maintenance still shares one promise                          |
| Paying only an EMI today                                | Manual-log detection checked transaction columns, but actual EMI links can live on loan_payments.transaction_id | Query excludes both link directions; real SQLite regression with actual payment backlink                                                               |
| Editing/deleting/undoing today's last manual entry      | These ordinary-entry and split deletion/restore paths did not rebuild reminders                                 | Rebuild after successful commit, including Recently deleted restore; real SQLite test observes true → false → true after edit/delete/undo              |
| Failed cancellation during schedule replacement         | Errors were swallowed and the replacement reported success                                                      | Cancellation failures return false while other reminders still get scheduled; failure-injection regression                                             |
| Restoring malformed notification settings               | Non-numeric clock fields could create NaN dates; non-boolean flags could enable unexpected alerts               | Validate clock/boolean fields before clamping; real SQLite malformed-settings regression                                                               |
| Diagnosing missing reminders                            | Times looked like unconditional alarms; no app/channel/schedule diagnostics                                     | Clear conditional copy, actual scheduled-request count, app permission/channel-blocking check, amount-free immediate test and explicit rebuild actions |

These fixes do not establish the original handset failure's cause. The existing rules remain: Morning only carries due EMI/wrap/spending alerts; Evening suppresses the log-only nudge after a manual entry. Android native alarm/battery/channel behavior must be tested separately. The test notification validates immediate presentation; it does not prove timed background delivery.

## Broader review

| Area                                | Source and automated evidence                                                                                                                                 | Device-only gap                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Startup, onboarding, lock           | Startup retry/fallback, existing-data onboarding, gated navigation, auth cancellation/native-error guards, relock timing                                      | Real PIN/biometric prompt, app switcher, interruption and upgrade                               |
| Ledger, transfers, currencies       | Bound SQL, amount/date constraints, cross-currency rejection, edit/link/delete/undo and account balance invariants; real SQLite journey tests                 | Repeated taps/navigation/native keyboard with real data                                         |
| Loans, people, goals/reservations   | Atomic linked writes, EMI ordering/undo, settlement cash versus balance-only, independent earmarks and insufficient-available-money checks                    | Native sheet/action accessibility and confirmation flows                                        |
| Budgets, reports, planning insights | Parent rollups, rollover/refund parity, elapsed-period comparisons, privacy/currency scopes, purchase coverage warnings                                       | Large labels/text and readability on actual screens                                             |
| Recurring                           | Catch-up anchors, duplicate/currency validation, failure containment before backup                                                                            | Reopening after missed dates and user-visible error handling                                    |
| Backup/restore/deletion             | Snapshot consistency, validate-before-delete, foreign-key rollback, exact safety-copy scope, newer-folder review, retention and invalid/revoked-file failures | SAF permissions/provider behavior, storage exhaustion and system picker return                  |
| Notification lifecycle              | New regressions above plus existing slot, queue, merge, routing and permission tests                                                                          | Immediate and timed delivery, channel/battery/DND, reboot and force-stop behavior               |
| Widgets / native packaging          | Build 10 compile success, actual APK manifest and guarded-provider DEX markers, certificate continuity, widget-privacy tests                                  | Default launcher rendering/change, resize/reboot and cross-app access harness                   |
| UI/motion/navigation                | Screen smoke and feature interaction tests, minimum targets, wrapping styles, reduced-motion and animation cleanup tests                                      | Measured phone frames, visual clipping, screen reader, calendar centering and keyboard overlays |
| Release tooling/security            | Strict unused/type checks, ESLint/formatting, SDK Doctor, dependency gate, URI decoder checks, GitHub CI                                                      | Final production AAB and store metadata/privacy declarations                                    |

The large test count includes mathematical/date matrices; it is not a substitute for the boundary tests or device evidence in this table. No unperformed native check is marked passed. Existing local/plain JSON storage and whole-unit money decisions are preserved.

## Signed build 10 inspection

EAS build 10 finished and the native-hardening commit's [GitHub CI passed](https://github.com/hemuush/yume/actions/runs/38345406510).

- APK SHA-256: `58b99bad6131bbba1af090813a23c34aecad3bd4fa93cfe513f96e1173152096`.
- INTERNET and READ_MEDIA_IMAGES are absent from the packaged manifest.
- The unguarded library provider is absent; PrivateWidgetImageProvider is registered. Compiled DEX contains its guard/error markers. This is packaging evidence, not a runtime exploit test.
- APK signing certificates for builds 9 and 10 match: SHA-256 `7270b588b59d23b934dee27d1b45d256c7faca70cda070abeab81995f8acbf2e`. Certificate comparison does not constitute cryptographic signature verification or installation testing.
- Preview is arm64-v8a. Production AAB still requires independent validation.
- Local ignored evidence: `.expo/apk-build10-inspection.json`, `.expo/signing-continuity.json`.

Build 10 predates the notification changes. A new candidate is required for the device checklist.

## Final-source validation

The final corrected run exited normally. A test-fixture import error in the first attempt was corrected; the interrupted/failed attempt is not release evidence.

| Check                                  | Fresh result                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full regression                        | 263 suites, 10,857 tests passed; two performance tests intentionally skipped                                                                                                   |
| Dedicated performance/parity           | Both tests passed; desktop timings, not phone rendering                                                                                                                        |
| Type checking / full lint / formatting | Passed                                                                                                                                                                         |
| Security tests                         | Eight passed                                                                                                                                                                   |
| Dependency audit                       | Passed with existing two documented tooling exceptions                                                                                                                         |
| Expo Doctor                            | 21/21 passed                                                                                                                                                                   |
| Android export                         | Passed, 2,324 modules / 40 assets, `.expo/followup-audit-android`                                                                                                              |
| Whitespace                             | git diff --check passed                                                                                                                                                        |
| Native build 11                        | [New candidate](https://expo.dev/accounts/xyumex/projects/yume/builds/d4bf3d3e-ece0-4656-a4e2-07205059ca5b) requested from the final runtime source; status checked at handoff |

The source changes after the final run are documentation and the EAS version-code increment to 11. Build 10's runtime/native inspections do not prove notification delivery in build 11. The phone's original failure remains unconfirmed until its actual delivery test.

## Acceptance

Use [release device checks](RELEASE_DEVICE_CHECKS.md), recording actual results on the new candidate. Notifications and widgets are release gates, not optional polish. Production approval remains open until the native/manual checks and production-distribution requirements are accepted. No Play submission was performed.
