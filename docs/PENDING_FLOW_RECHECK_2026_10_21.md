# Pending-flow recheck — 21 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Targeted follow-up to the [cleanup recheck](CLEANUP_RECHECK_2026_10_21.md). This pass examines shared confirmation actions, recurring mutations and account-creation initialization. It does not establish that every feature or native presentation state has been checked. Existing theme colours, layout and animations are retained.

## Reproduced and fixed

1. A confirmation could invoke its action twice before React rendered its dismissal. An old dialog callback could also act after a replacement was queued, dismissing that newer notice. AppDialog now consumes the current dialog synchronously before its callback, with identity checks for replacement and unmount. A callback can still open a follow-up notice normally.
2. Recurring entries protected the main submit handler, but a later confirmation called an unguarded save. A regression reproduced two simultaneous writes through the same confirmation. Saves, deletes and pause/resume now share one mutation lock; validation and the existing overdue-posting confirmation remain intact.
3. Account creation applied an asynchronous default currency even after the user selected a different currency, or after the sheet closed and reopened. Two regressions reproduced accounts being created with the wrong currency. Reads now belong to one opening and yield to an explicit selection. Initial/reset values use the existing settings cache; account creation and valuation-retry behavior remain unchanged.

The six initial regression cases failed against the previous implementation. Local evidence is in `.expo/pending-reproductions.log` (three suites; six failed and fifteen passed).

## Validation

The initial focused rerun passed all 21 tests. Expanded follow-up checks also cover cancellation, queued callbacks after unmount and save/delete/pause overlap: all 23 tests across three suites passed (`.expo/pending-focused-final.log`). The subsequent full run passed **309 suites / 11,260 tests, with zero failures**, in 484.643 seconds (`.expo/pending-full.log`). Two optional performance suites/tests were skipped by the standard run; this pass did not rerun those opt-in checks. The preceding cleanup report retains their earlier results separately.

Full-repository lint, final changed-source lint, final type checking, source/document formatting and diff whitespace checks passed (`.expo/pending-lint.log`, `.expo/pending-lint-final.log`, `.expo/pending-types-final.log`, `.expo/pending-format.log`, `.expo/pending-doc-check.log`). Android JavaScript/Hermes export passed (`.expo/pending-android-export.log`). The export is `.expo/pending-android-export`, with an 8.2MB Hermes bundle; it is not an APK build or native-device check. Earlier reports retain their own results and are not evidence for these changes.

## Outstanding acceptance

The [release device checklist](RELEASE_DEVICE_CHECKS.md) still requires native keyboard, TalkBack, reduced-motion, natural-midnight/resume and APK upgrade checks. This pass does not build or install an APK. Nothing is committed or pushed.
