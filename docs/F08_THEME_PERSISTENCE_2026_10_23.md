# F08 — atomic theme persistence and honest failure feedback

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Root cause / expected outcome

The picker immediately updated UI, then wrote theme ID and accent separately with discarded errors. A partial failure could leave mismatched settings; any failure could silently revert on relaunch.

Both settings now use one parameterized multi-row SQLite upsert, which is atomic. Caches update only after success. The immediate preview remains, but ordered writes and a committed snapshot let the provider restore the last successful choice on failure. Superseded queued choices are skipped; restore invalidates obsolete choices and their snapshots.

The failure is reported locally under the existing offline diagnostic policy, displayed accessibly in both pickers, and shown once through the unlocked app dialog host. Retrying the same failed choice can show a new notice. Background widget refresh waits for pending theme writes rather than reading an intermediate accent.

## Files / tests

- [settings.ts](../src/db/settings.ts): compound atomic write and post-success caches.
- [AccentContext.tsx](../src/theme/AccentContext.tsx): ordered persistence, rollback, restore protection and pending-write boundary.
- [ThemeSaveFeedback.tsx](../src/theme/ThemeSaveFeedback.tsx): one unlocked failure notice, including off-screen selections.
- [root layout](../app/_layout.tsx), [Themes](../app/themes.tsx), [Settings](../src/features/profile/SettingsSection.tsx): feedback and background refresh integration.
- [ThemePersistence.test.tsx](../src/theme/ThemePersistence.test.tsx), [themeSelection.test.ts](../src/db/themeSelection.test.ts), [existing provider tests](../src/theme/AccentContext.test.tsx).
- Architecture and this record.

Three new behavior tests failed before the fix, demonstrating silent failure and absent ordered persistence. The final focused provider/SQLite run passed **3 suites / 11 tests**. It covers failure/rollback/retry, repeated failure notices, rapid selection, failure after an earlier success, restore invalidation, waiting before widget reads, a real SQLite trigger abort during the accent write, overlapping writes and invalid accent rejection. The earlier broader provider/picker/settings run also passed.

Fresh full regression: **331 suites / 11,434 tests passed; 2 suites/tests skipped**, 321.8 seconds. TypeScript, whole-repository lint, formatting and cycle checks passed. The first full run found a startup-privacy test mock missing the provider's expanded interface. Its mock contract was updated without weakening either privacy assertion; the targeted privacy/provider tests and the complete suite then passed.

## Self-review / risk / acceptance

No dependencies, schema changes, financial writes or new remote reporting. SQL parameters remain bound. Invalid accents are rejected before writing; caches do not move on failure. The dialog feedback is mounted only with financial screens, never above app lock. Pending-write failures are handled and reported; technical causes are not shown as raw user-facing messages.

Before: two independent writes, immediate UI, no failure feedback.

After: one atomic statement, immediate preview, ordered persistence, rollback plus visible retry guidance on failure.

Android checks remain pending: change theme from Settings and the full picker, background immediately, inspect widgets, relaunch, restore a different theme and repeat with 200% text/TalkBack. Simulate storage failure on a test install and verify rollback/notice/retry. OS dark appearance follows the configured light app; iOS is outside scope. No native startup/frame/memory claim is made.

Risk: the widget refresh can wait for slow storage; this is intentional so it reads the committed choice. A restore cancels queued obsolete selections. Existing standalone setters remain available for compatibility paths.

Rollback: revert this fix's commit; there is no migration.
