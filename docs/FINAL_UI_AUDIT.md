# App-wide UI and logic audit — 13 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

This record covers the current working tree based on commit `3013654`, including the recent UI and quiet-motion refinements. It records automated checks and focused source review; it does not establish native behaviour or frame-rate performance on a physical phone.

## Issues addressed

- Aligned Expo SDK 57 patch dependencies and the lockfile: Expo 57.0.28, Router 57.0.26, Sharing 57.0.23, Splash Screen 57.0.10 and jest-expo 57.0.6. Expo Doctor now accepts all 21 checks.
- Made screen freshness reject negative cache ages. Moving the phone clock backwards now forces a focus reload instead of extending the five-minute cache lifetime. Regression tests also cover the expiry boundary.
- Added automatic test-renderer teardown, preserved across Jest mock resets. Mounted component trees release their effects after each test. Reports fixtures also clean up before their frozen clock is restored, preventing unfinished animation timers from outliving the fixture.

These fixes preserve stored data, financial calculations, the app identifier and the current feature set.

## Coverage reviewed

| Area                                          | Checks                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding, Home, Activity, Add and Split     | Empty/populated/awkward data, navigation, period changes, save guards, search, grouping, privacy and linked edits                                 |
| Plan, Reports and insights                    | Scoped currency/privacy, forecasts, period comparisons, category/account drill-downs, reservations, purchase checks and expected refunds          |
| Loans, recurring, goals, budgets and people   | Schedule anchors, payment/ledger integrity, contribution and settlement actions, completion/privacy, limits, rollover and undo                    |
| Profile, categories, notifications and backup | Settings persistence, parent editing, protected categories, notification routes/times, restore validation, safety copies and restored preferences |
| Lock, widgets, Garden and Wrap                | Authentication failures, relock timing, widget privacy, lifecycle cleanup, reduced motion and story controls                                      |
| Shared presentation                           | Wrapping labels, large-font rules, minimum touch targets, pinned actions, keyboard/amount-pad integration and animation-driver separation         |

## Validation

| Check                                | Result                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Main regression suite                | 262 suites and 10,846 tests passed; final rerun exited normally with no lingering-operation warning |
| Performance and output parity        | Both gated tests passed separately on the updated SDK dependencies                                  |
| Type checking, ESLint and formatting | Passed; changed test/setup files also checked directly                                              |
| URI-decoding security checks         | Four checks passed                                                                                  |
| Dependency audit gate                | Passed with the two existing documented tooling exceptions in `scripts/auditGate.js`                |
| Expo Doctor                          | 21/21 passed                                                                                        |
| Android export                       | Passed with 2,324 modules; generated bundle is under ignored `.expo/audit-android`                  |
| Diff whitespace check                | Passed                                                                                              |

The main suite intentionally skips the two performance/parity tests unless `PERF=1`; the separate performance command runs them. Desktop database timings do not measure phone scrolling or native rendering.

## Remaining release validation

- Build a fresh APK containing this working tree and the SDK patch updates. Earlier APKs are not validation of these changes.
- On a compatible Android phone, verify cold launch, resume, native unlock/cancellation, system back, notifications, folder permission changes and restore/export pickers.
- Check keyboard/amount-pad switching, pinned buttons, narrow layouts, long names/amounts and enlarged system text visually.
- Profile scrolling and navigation with realistic data, including reduced motion. No local Android device tooling was available for this audit.

The audit gate's existing exceptions concern `braces` and `node-forge` in build/test tooling; a passing gate is not a claim of zero dependency advisories. Historical validation counts must not be presented as fresh checks after later changes.
