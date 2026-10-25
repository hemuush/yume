# Notification audit — 24 October 2026

Reviewed from Settings and the bell screen through SQLite preferences, financial mutation callbacks, planning, Expo scheduling, foreground presentation and notification tap routing. The baseline was `728b6d9`. Expo APIs were checked against the [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) and the installed `expo-notifications` 58.1.6 source. Historical audit results are not fresh validation.

## Findings corrected

- **Stale private payloads:** denied permission/blocked channels returned before cleanup, and a failed same-ID replacement deliberately retained the old message. Rebuild now cancels these owned payloads and returns failure. Best-effort cleanup also runs after unexpected planning/native errors; cancellation failure remains visible as failure.
- **Lost spending alerts:** the planner treated the first intended slot as delivered even when scheduling failed. A `scheduledFor` marker is now persisted only for a successfully submitted slot. Unaccepted alerts retry at the next enabled time within their original three-day age limit. Successfully accepted slots remain distinguishable during partial failure.
- **Delayed Android requests:** a passed timestamp is checked against the OS pending-request inventory. Requests still pending are replanned at the next eligible slot instead of being consumed as if presented. Cancelled delayed requests cannot leave an elapsed topic receipt that suppresses their replacement.
- **Repeated same-day topics:** rebuilding after Morning could repeat its EMI, recurring bill, refund notice or Monday wrap at Evening. Short-lived per-topic scheduling receipts suppress that repeat while retaining subsequent overdue days and the separate refund follow-up three days later. These record scheduler acceptance, not verified presentation.
- **Repeated category spikes:** a single last-category key forgot earlier categories when the top-growing category changed. Monthly per-category history now prevents that repeat, migrates the old plain-text key and retains only the current/previous month. Queue-write failure leaves the spike retryable.
- **Settings races:** overlapping full snapshots and optimistic rollback could undo another change or persist an earlier failed change. A feature hook orders patches; SQLite merges each with live preferences atomically. Stale reads, obsolete permission results and queued choices overtaken by restore cannot overwrite newer UI state.
- **Permission retry:** native setup failure previously marked automatic permission as already requested. The marker now follows a completed native request; concurrent manual/startup calls share one prompt. Failure to persist the marker does not change the OS permission result.
- **Delivery UI:** an empty schedule could say “Delivering,” and returning from Android Settings left stale permission status. The screen refreshes on foreground, distinguishes empty/off/failed states, and says “Ready to notify” for accepted requests.
- **Recurring eligibility:** an active child of an archived parent could produce a bill reminder. Parent eligibility is checked too; missing category/parent metadata is excluded when privacy is enabled.
- **Restore ownership:** topic receipts remain phone-local; source-phone spending acceptance is stripped on export/import. Restored queue content is still rebuilt from current financial data and privacy rules.

## Current coverage and behavior

| Path                        | Behavior reviewed                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings entry and controls | Bell/Profile links, loading/retry, half-hour steps and time ranges, topic toggles, ordered writes, errors, Delivery disclosure and settings links                       |
| Morning                     | Daily Plan check-in; due content replaces it; disabled times create no request                                                                                          |
| Evening                     | Add-entry nudge suppressed after a qualifying entry for the current day; merged financial topics retain their action                                                    |
| Borrowed loans              | Next pending installment due-day notice and daily overdue notices for seven days; paid/closed/deleted/undone loans trigger rebuilds                                     |
| Spending                    | Budget threshold and spending-jump provenance, live financial copy, category-family privacy, queue reconciliation, stale expiration and retry                           |
| Recurring expenses          | Explicit opt-in; next active expense's day-before notice; account/category/archive/end-date eligibility and mutation refresh                                            |
| Refunds                     | Explicit opt-in; expected-day and three-days-later notices while outstanding; closed/fully received/undated expectations excluded; receipt/undo refresh                 |
| Weekly wrap                 | Monday at the first remaining enabled time; no repeat at Evening after an accepted Morning slot                                                                         |
| Bell / Needs you            | Shared Home/bell loader, urgency ordering, dismiss/undo/restore/snooze, separate Suu check-ins and valid destination actions                                            |
| Startup and resume          | Channel setup, one automatic permission request after onboarding/unlock/capture readiness, legacy cleanup, foreground renewal after recurring catch-up                  |
| Taps and presentation       | Foreground banner/list/sound, fixed route allowlist, cold-start response consumption, live listener cleanup, navigation deferred behind app lock and capture protection |
| Android configuration       | Existing reminder channel, private lock-screen visibility, notification icon/plugin, no new permissions or remote service                                               |
| Backup/restore              | Committed restores resync services; phone-specific receipt/permission state cannot be imported from another device                                                      |

At most one planned message occupies each enabled slot; due items merge by priority. Notifications are local. No push server or network delivery is involved. A test request being accepted does not establish that Android displayed it.

## Fresh verification

- Final targeted regression: **21 suites / 193 tests passed**, covering planner, scheduling, permissions, Settings UI, clock slots/arc, real-SQLite notification and spending data, privacy cleanup, financial post-commit containment, recurring/refund flows, foreground maintenance, startup privacy, bell/Profile navigation and backup/restore. This run took 24.019 seconds. Earlier overlapping runs are not additional test counts.
- Security/native-configuration script tests: **16 passed**, including manifest configuration checks and widget-provider privacy. Cycle detection passed across **524 modules**.
- Android JavaScript export passed: **2,388 modules**, including the notification UI and scheduler. This is a JavaScript/Hermes export, not an APK build or a phone result.
- Full-repository Jest regression: **360 suites / 11,702 tests passed**, with **2 suites / 2 tests skipped** by the existing test configuration. The run took 840.485 seconds. The final targeted run above also verifies the completed notification changes; its count overlaps the full run.
- Whole-project TypeScript, changed-source/test ESLint, changed-source/test Prettier and Git whitespace checks passed. The lint cleanup warning and a test-file formatting issue seen during intermediate runs were corrected before the final clean checks.
- Expo Android prebuild passed. The generated manifest passed the repository's native checks; notification icon/color metadata and the `yume://` scheme are present. Autolinking resolves `expo-notifications` **58.1.6** and the local app-icon module. The notification module manifest declares notification/boot permissions and its non-exported delivery components. Prebuild's generated Android script change was restored; no package manifest or lockfile change remains. This validates generated configuration, not Kotlin/Gradle compilation or a device install.

Local dependencies were synchronized with the existing lockfile after the initial check found the recently added `expo-print` missing. No package manifest/lockfile dependency change was required by this audit.

## Ponytail follow-up

The requested [Ponytail core skill](https://github.com/DietrichGebert/ponytail/blob/09c434ab73ca43761c5d8b0c5d341926c2fba710/skills/ponytail/SKILL.md) was installed at upstream revision `09c434ab73ca43761c5d8b0c5d341926c2fba710` and applied in its default mode. This review traced the notification changes and their callers before making one small UI correction.

A regression test reproduced a hidden error after an already-loaded Settings screen failed to refresh. The screen now reuses the existing `ScreenLoadError` component for both initial and subsequent failures, removing its custom error markup and retry style. Loaded controls stay visible after a refresh failure, and Retry clears the error after a successful read. No dependency, scheduler or financial-write behavior changed in this follow-up.

Fresh follow-up verification: **6 suites / 110 tests passed**, including both error/retry cases and notification scheduling, permissions, real-SQLite data and privacy cleanup. TypeScript, affected-file ESLint/Prettier and Git whitespace checks passed. The 360-suite result above predates this small UI follow-up; the full suite and Android export/prebuild were not repeated for it. Device delivery remains unverified.

## Device acceptance still required

No Android device session was available for this audit. Check a new build on a phone for first permission grant/denial, channel blocking, foreground/background test delivery, DND and battery restrictions, same-day topic deduplication, privacy cleanup, restore, and locked cold-start notification taps. Keep [release device checks](RELEASE_DEVICE_CHECKS.md) open until those steps are actually performed.

The rolling daily plan lasts 14 days and renews when Yume starts/resumes; no indefinite background renewal is implemented. Android can delay best-effort alarms, and force-stop can prevent delivery until the app reopens. Source tests and JavaScript export cannot prove physical notification delivery, native layout/TalkBack behavior or exact timing.
