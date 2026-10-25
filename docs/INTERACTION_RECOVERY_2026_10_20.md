# Interaction and recovery refinement

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Implemented

- Home shows the real amount immediately; shorter section entrances retain reduced-motion support.
- Home chart heights interpolate when spending changes. Current-day and completed-month chart modes remain.
- Daily allowance expands to explain the saved limit and outgoing spending. Refunds do not refill it.
- Shared loading/success states announce busy/disabled status and prevent repeated presses. Saving feedback is applied across financial forms. Modal dismissal dismisses the keyboard.
- Focused date-sensitive screens refresh at local midnight and after a background day change. Historical Activity periods are preserved.
- New-entry draft recovery keeps expressions, dates, payment methods, accounts, categories, people, staged entries and split parts. Resume is explicit and checks references. Nothing posts until normal Save succeeds. Existing duplicate warnings, undo feedback and saved-row highlights are retained rather than duplicated.
- Drafts autosave after 650ms and flush on background/unmount. Keep draft waits for storage before leaving. Save/Discard clear the draft, and ordered storage prevents older writes resurrecting it. Unsaved edits keep their existing discard protection; this does not replay edits after restart.
- Backup exports exclude drafts; imports ignore draft payloads and restores invalidate queued recovery.

## Validation

Focused checks passed for daily explanations, midnight/year rollover, foreground/background cleanup, loading accessibility, real SQLite draft persistence, malformed data rejection and backup exclusion. A recovery race was reproduced and corrected; its focused recheck passed. Final verification:

- Full regression: 308 suites passed; 11,232 tests passed. Two opt-in performance checks were skipped.
- Final recovery/Home motion/date/SQLite recheck: 5 suites, 55 tests passed after the last recovery/visual adjustments.
- Final Activity navigation recheck: 1 suite, 9 tests passed. Account/entry deep links clear an unrelated payment-method filter.
- Native privacy/URI script checks: 8 passed.
- TypeScript, scoped ESLint and Android Hermes export passed; these checks were repeated after final edits.

The full run preceded the last narrow Activity-link adjustment; its affected screen suite was rerun separately. Historical validation records are not counted as fresh checks.

Native phone acceptance remains open: keyboard transitions, small-screen/large-text layout, background/force-stop recovery and visual animation smoothness need the updated APK on a device. No APK is built by the JavaScript export. Nothing committed or pushed.
