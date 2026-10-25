# Notifications redesign (2026-10-22)

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Not yet verified on a device.

**Needs you (`app/notifications.tsx`, `NeedsYouRow`)**

- A flat summary card (count, a bar split by urgency, the same chips) replaces the glass hero.
- Items are grouped under Do first / Coming up / When you can, in flat cards.
- Each row has a button naming what it does (Pay, Open, Set up, Review, See why) and a "…" menu with Later (the
  backup reminder only) and Dismiss. Dismiss still offers Undo; dismissed rows show "Show again".
- A settings gear in the header opens Notification settings; the empty state links there too.

**Notification settings (`app/notification-settings.tsx`, `SlotCard`, `DayArc`)**

- The day arc is a flat card. Morning and Evening are two cards, each with its switch and a −/+ stepper (30
  minutes within its range); the old expand-to-set row (`SlotTimeStepper`) is gone.
- "Yume can mention" shows how many of its five are on. Delivery is a status row (dot, "Delivering",
  scheduled count) that opens the explanation, Test notification and Rebuild reminders.
- Text uses the theme type scale and `Text`, so it follows the phone's font-size setting.
