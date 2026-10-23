# F06 — block financial UI until capture protection succeeds

## Approved behavior / root cause

The user chose blocking financial screens when Android cannot enable screenshot protection. The old root effect discarded prevent/release rejections and mounted unlocked financial screens before the native request completed.

The [guard hook](../src/lib/useScreenCaptureProtection.ts:48) now tracks checking/ready/failed results for the current lock preference and attempt. With app lock enabled, financial content stays unmounted until success. The [public recovery screen](../src/components/CaptureProtectionScreen.tsx:10) has progress, an accessible error, safe-area/scroll support and a 44dp-or-larger retry action. Raw native errors stay out of its message. Public authentication remains stable while protection recovers; it does not reveal financial content. Required protection also gates onboarding/restore presentation.

The [root](../app/_layout.tsx) also retains pending notification destinations while capture protection blocks the navigator. Unlock and protection are separate conditions; satisfying either alone does not expose financial screens.

## Native ordering and failure handling

The installed Expo SDK58 implementation caches protection keys in JavaScript; calling prevent with an already active key can resolve without reaching Android. The guard uses a new owned key for each request, then retires previous owned keys after success. This handoff does not temporarily release protection. A module-level queue serializes native prevent/release operations across toggles and remounts. Canceled queued work is skipped, and obsolete completions cannot replace the current result.

A failed native release remains retryable even though Expo has removed its cached key. With app lock disabled, protection is not required; a release failure produces an unlocked [notice with retry](../src/components/CaptureReleaseFeedback.tsx:6), rather than claiming screenshots were enabled. No dialog is shown above authentication or the protection block. Native failures use the existing local error-diagnostic policy, with no financial values or remote telemetry added.

Failed operations retry on an active lifecycle event. A normal foreground event after confirmed protection does not remount a form or discard unsaved input. The Activity's existing FLAG_SECURE remains in effect; this is not a new OS attestation API. The guard deliberately does not clear protection when it unmounts: the next applied lock preference owns that change. Its lifecycle listener is removed, queued obsolete work skipped and late UI updates ignored.

Reference: exact [SDK58 ScreenCapture API](https://docs.expo.dev/versions/v58.0.0/sdk/screen-capture/) and the installed `expo-screen-capture` 58.0.6 wrapper/native module. Blocking capture requires no new screenshot-detection permission. No dependency or native-plugin change.

## Files / regression evidence

- useScreenCaptureProtection.ts: typed state, ordering, ownership and lifecycle recovery.
- CaptureProtectionScreen.tsx and CaptureReleaseFeedback.tsx: public blocking UI and unlocked release feedback.
- app/_layout.tsx: replaces the discarded-promise effect, gates mounting and defers notification routing.
- startupPrivacy.test.tsx: existing saved-privacy assertions retained; adds pending protection, native rejection and deferred notification destination tests.
- useScreenCaptureProtection.test.tsx: eight behavior tests using Expo's actual JavaScript wrapper, with only its native capture module mocked. The native sheet/window is mocked for dialog interaction.
- Architecture and this record.

Before: two new root tests failed because financial screens were already mounted while prevent was pending or rejected. After: the focused root/native-wrapper run passes **2 suites / 13 tests**. It covers progress, failure/retry, hidden raw error details, foreground recovery, rapid off/on with a late release, superseded success, skipped obsolete release, real native calls on remount despite Expo's cache, owned-key handoff, listener cleanup, retained unsaved form and release-error retry. The root notification test verifies the route is not consumed until protection succeeds.

Test setup initially used the suite-wide mocked SDK/dialog; the native-wrapper suite explicitly restores their real JS implementations and supplies safe-area context. Its role query also caught a missing `accessible` flag on the progress indicator, which was corrected. No assertion or production rule was suppressed. Strict type-check and focused lint pass. Full-suite/static verification is recorded in the final report.

Whole-repository lint, formatting and cycle checks pass (490 modules); a final type-check and scoped lint cover the last metadata/test correction too. Fresh combined full regression with coverage after F05/F06: **333 suites / 11,446 tests pass; 2 suites/tests skipped**, 386.2 seconds. Line coverage increases from **88.18% to 88.41%** against the original revision under the same production scope. The normally skipped SQL performance/output fixture suites run separately; native measurements remain open. Security tests pass (7).

## Integration follow-up: retain lock-save feedback across the guard

Final integration review reproduced a new interaction: enabling app lock optimistically closes the navigator while capture is pending; if the setting write then fails, `showAlert` ran while its host was unmounted. The preference correctly rolled back, but the user saw no failure notice. The full-root `captureLockPreference.test.tsx` failed with the actual dialog host, including the diagnostic “no AppDialogHost mounted.”

[AppLockContext](../src/lib/AppLockContext.tsx) now retains a typed failure notice and rolls back as before. [AppLockSaveFeedback](../src/components/AppLockSaveFeedback.tsx), mounted beside the unlocked host, delivers and acknowledges that exact attempt once. A newer choice or settings restore clears obsolete notices; stale write completions cannot create a current notice. Technical causes use local diagnostics; the user sees a friendly retry message rather than the raw storage error. The provider no longer calls UI directly.

The root regression now passes, checks that technical storage details are absent from the dialog, and the provider regression verifies clearing an undelivered notice on restore. Focused lock/root/native-wrapper coverage: **4 suites / 17 tests pass**, 5.2 seconds. Strict type-check, whole-repository lint, formatting and cycle checks pass (491 modules). Fresh full regression after this follow-up: **334 suites / 11,448 tests pass; 2 suites/tests skipped**, 476.3 seconds. Line coverage is **88.43%**, versus 88.18% at the original revision. The performance suites run separately. This follow-up is included in the successful [final APK build 9843159a](https://expo.dev/accounts/hemant.shrma.3004/projects/yume/builds/9843159a-24a7-4526-af7a-a008c7bb9213) for `1b81870`; the earlier `f7654da` candidate precedes it. Final packaged permission, backup/debug/test flags, widget dimensions, preview and font assertions pass; device acceptance remains with the owner.

## Risk / manual Android acceptance / rollback

This intentionally changes availability: a required native protection failure closes financial screens until successful retry. A native request that never settles remains blocked; no timer guesses that protection succeeded. The public recovery screen has no bypass. No ledger mutation, migration or new lock-preference write is added; the existing setting failure gains durable feedback. App lock disabled means capture protection is not required; release-error feedback does not turn lock back on.

On a rebuilt Android candidate, test locked cold launch and notification/widget links, authentication success/cancel, capture failure and retry in an instrumented test build, background/resume after failure, rapid lock toggles and repeated launches. Check screenshots, screen recording and recents with the lock on; disable the lock and verify successful release. Check 360dp/200% text, keyboard/Back, safe areas, OS dark appearance under configured light UI and TalkBack progress/error/retry announcements. Native window/biometric/launcher behavior cannot be certified by these JS tests. iOS is outside scope.

Rollback: revert this finding's commit, restoring the prior root effect and mounting behavior. No data rollback is required. No startup/frame/memory improvement is claimed; enabling app lock now waits for the native protection acknowledgment by design.
