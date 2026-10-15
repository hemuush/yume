# Morning reminder correction — 16 October 2026

## Findings and changes

The old planner created no ordinary Morning notification: enabled Morning only carried a due EMI, Monday wrap or queued spending alert. An ordinary day could therefore have zero morning requests. It now creates an amount-free daily check-in opening Plan when that slot has no due content. Existing due entries replace the generic check-in; merging, time clamps, disabled slots and evening logged-today suppression remain.

The foreground handler explicitly disabled sound. [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/#notificationbehavior) states that this also suppresses Android's drop-down notification alert. The handler now permits banner/list/sound and requests the default sound; existing channel choices, phone volume and DND remain authoritative.

Rebuilding previously cancelled all owned requests before attempting replacements. Desired identifiers now update first; only obsolete owned identifiers are removed afterward. A failed replacement does not explicitly cancel an existing matching identifier. Android SDK source was checked: `ExpoSchedulingDelegate` stores requests and alarms using their identifier. Permission denial and a blocked channel now return failure rather than a successful-but-empty rebuild. Failed scheduling/cancellation retains the alert queue. Database reads crossing midnight refresh the logged-day scope before planning.

## Limits and verification

### Optional attention reminders

The subsequent improvement adds two explicitly enabled topics under Notifications:

- **Recurring expense heads-up:** the day before each active expense rule's next scheduled run. This is a notice before automatic recording, not a claim that an actual bank payment was made. Paused rules, ended runs, archived source accounts/categories, income and transfers are excluded. Only each rule's next run is considered; later runs refresh as Yume advances that rule.
- **Refund follow-ups:** on a dated expectation and once three days later if still pending. Closed, fully received and undated expectations are excluded. The message opens Plan, where the refund card links to the purchase and receipt controls.

Both default to off when absent from older preference JSON. Restored non-boolean flags are disabled. They merge into Morning/Evening, respect disabled slots, and stay within the existing 14-day horizon. Labels carry no amounts; hidden category families and savings accounts are excluded after reading the privacy preference. No transaction is posted by planning a notification. Relevant create/edit/pause/delete/restore and refund expectation/receipt/close/undo writes refresh enabled topics after commit; refresh failure cannot roll back money.

Delivery check shows separate actual scheduled-request counts for Morning and Evening rather than only an aggregate. A queued request is still not proof of physical delivery. The 72-test result below predates these optional-topic additions. Optional-topic validation: 12 suites / 103 tests passed (227.362 seconds), covering existing recurring/refund UI and database flows, scheduling, routing, privacy and post-commit containment. A subsequent five-suite check passed 64 tests after the privacy preference read was made asynchronous. Final follow-up: four suites / 60 tests passed after adding partial-receipt and rejected-schedule coverage and skipping attention reads when both slots are off. Whole-project type checking, changed-file lint, formatting and Git diff checks passed. These are overlapping runs, not additive test counts. No new artifact or device result is claimed.

Notification wording was subsequently refined: Morning uses “Your day, at a glance” with a Plan-specific action; Evening uses “Before you call it a day” with a short logging prompt. Weekly wrap describes the spending overview. Due/overdue EMI messages preserve names, amount and due-date context and add a Loans action, with singular/plural payment wording. Budget warnings retain the financial figures; near-limit titles no longer claim an exact 80% when the threshold can be crossed above that percentage. Spending-increase wording explicitly names the previous month's total. Routes, trigger rules and financial calculations are unchanged by the copy refinement.

The planner still schedules 14 days ahead and renews on app startup/foreground maintenance. No indefinite background renewal, exact-time guarantee or battery-restriction bypass is claimed. Settings now explains this limit. Native notification delivery must be verified on a phone with a new artifact; the installed build does not change from source edits.

Regression coverage includes morning-only with no due content, after logging, missed morning time, chosen/clamped times, disabled slots, merged due content, weekly wrap, overdue EMIs, queued alerts, permission/channel failure, schedule-before-cancel order, matching-ID preservation, foreground handler and notification routing. Existing notification database, foreground-maintenance, shortcut routing and post-commit-containment suites are included. Final targeted regression: eight suites / 72 tests passed, exit 0, 77.564 seconds. Whole-project type checking, changed-file ESLint, formatting and Git diff checks passed. A formatting-only test-file issue was corrected before the final lint pass.

Device acceptance: enable Morning, select a future morning time, rebuild, and test once with Yume foreground and once backgrounded without force-stop. Check the actual tray and channel settings, then test with an EMI due and after a manual entry. Verify an ordinary morning check-in opens Plan and only one notification occupies each slot. See [release device checks](RELEASE_DEVICE_CHECKS.md). No APK build or Git push is included in this fix.
