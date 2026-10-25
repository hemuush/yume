# Home and planning screenshot refinements — 20 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

## Findings and changes

- The Home chart deliberately selected the latest nonzero day. With no recorded spending on 20 October, it therefore selected 19 October. Selection now starts on today even at zero, explicitly labels Today in the detail caption, and returns to today after refreshed daily data. Manual taps still inspect older days.
- The daily allowance now also shows the amount spent today. Home refreshes its figures when returning to the foreground while focused; navigation focus alone does not cover that lifecycle event.
- Recurring setup removes the separate full-width one-off button and the second type-selector row while editing. Type changes remain under More options. One-off management belongs to Schedule, uses a standard action row, and returns without losing the recurring draft.
- Monthly plan uses a short title, separate amount/status, a wrapping three-column Income/Spending/Savings summary and expandable calculation text. Missing-schedule and undated-goal warnings stay visible. Theme colors and financial calculations are unchanged.

## Verification and limits

- Seven affected suites passed: 206 tests, including full screen smoke, Home chart/hero, monthly plan and recurring editing.
- The additional recurring-sheet navigation regression passed in its 11-test suite, checking one visible native sheet and preservation of an unsaved recurring amount after returning.
- TypeScript, changed-source lint, formatting and whitespace checks passed; the Android JavaScript/Hermes export passed at `.expo/screenshot-refinements-export`.
- No APK was installed or visually inspected on a device. No commit or push was made.

The screenshots alone do not identify the date, currency or privacy classification stored on the user's new expense. Confirmation of its date in Activity was requested. Only today's recorded net expenses/refunds in the existing scope should reduce today's allowance; a larger monthly total does not by itself prove today's spending is nonzero.
