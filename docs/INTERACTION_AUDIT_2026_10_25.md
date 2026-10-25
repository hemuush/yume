# Shared interaction audit — 25 October 2026

Focused Ponytail review of shared controls, recovery, animation identity and avoidable reads. This is not an exhaustive app or visual-device audit. Existing uncommitted database, notification, export and investment changes were preserved.

## Findings and changes

1. **Undo could run twice or dismiss a newer toast.** Its callback previously closed over a toast without checking whether it remained active. The provider now consumes the matching key before callback execution. Expired/exiting callbacks are ignored, queued actions retain their own window, and teardown cancels the timer and clears the queue. Synchronous and asynchronous errors still use the existing failure dialog.
2. **Period totals could look current while stale or look empty after failure.** Each opening/privacy reload now clears old totals, and a failed read offers an accessible explanation and Retry while retaining navigation. Selection state and totals loading use separate effects, avoiding another all-month read when only the selected period changes. Late reads remain guarded by effect cleanup.
3. **Progress animation could borrow another record's value.** `useGrowFrom` retained its Animated.Value when its key changed. It now restores the new key's remembered value, or starts a new key at zero. Returning to an unchanged remembered key skips timing work. Existing duration and reduced-motion behavior remain.

## Fresh validation

- Full Jest regression: 361 suites and 11,740 tests passed in 466.635 seconds; 2 opt-in performance suites/tests skipped in this command and passed separately below.
- Focused interaction suite: 5 suites, 37 tests passed, including double-tap, expired-action, timer cleanup, picker retry/stale-read and animation-key regressions. The subsequent picker-only run passed all 8 tests, including the additional no-reread regression (38 distinct focused tests overall).
- Dependency-cycle check: passed across 524 modules.
- TypeScript and repository-wide ESLint: passed.
- Performance/output parity fixtures: 2 suites, 2 tests passed. These fixtures do not establish native frame-rate smoothness.
- Security script checks: 16 tests passed.

## Limits

No phone/emulator visual or gesture acceptance, TalkBack session, APK build or new design system. Actual motion smoothness, text scaling, keyboard geometry and native modal transitions still need device acceptance. No dependency, financial schema or financial calculation was changed by this review.
