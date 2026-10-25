# Home daily remaining refresh — 20 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Reproduced issue

After Home loaded a 500-rupee daily goal with no spending, a new 70-rupee expense followed by navigating away from and back to the current month refreshed the chart and monthly spending to 70 rupees but left the daily footer at 500 rupees. A real-SQLite screen regression failed before the fix with those contradictory figures.

## Correction

Home now includes today's spending in the guarded period-load result. In current-month view, it derives that amount from the same daily data used by the chart, eliminating the separate duplicate query. Both full loads and month navigation commit daily remaining with the displayed period figures. Current-year view reads today's net spending explicitly; historical periods do not display the daily allowance. One local reference date scopes each period request.

The daily limit remains the user's configured goal. Only net expenses/refunds dated today in the default currency and current privacy scope count. Income and account transfers do not consume it. Daily net spending stays floored at zero, preserving existing refund behavior. No transactions, settings, theme colors or stored amounts are rewritten.

## Fresh verification

- Reproduced failure before the fix; the same regression passes after it.
- Real-SQLite Home checks cover save, edit, refund, deletion and current-month navigation.
- Seven suites passed: 198 tests covering screen smoke, Home hero/motion/bars and report/privacy queries.
- TypeScript, focused lint, formatting and whitespace checks passed.
- Android JavaScript/Hermes export passed: `.expo/home-today-export`.
- No APK installation or native visual check was performed. No commit or push was made.
