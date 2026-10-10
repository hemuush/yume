# Transaction improvements — 10 October 2026

Implemented the approved transaction review in the native Expo app. The existing wallpaper, frosted cards, rounded icons, four transaction types and calculator remain.

## Changes

- Added a Hide/Show pad control. Opening it dismisses category-search/note keyboards without losing the amount.
- Shows category/person/transfer account context in the amount card and footer, plus a clear unsaved queue count.
- Refined usual-entry shortcuts into compact two-line cards. Merchant and parent/category text can shorten independently while the amount remains visible. Privacy masking is preserved.
- Uses wider category columns on the Add screen, larger detail/frequent-amount touch targets and gentler keypad press feedback. Existing reduced-motion handling remains active.
- Invalid calculator results display a dash and explanation; incomplete actions are disabled. Decimal rounding is explained while preserving the app’s existing whole-unit policy and untouched-edit storage behavior.
- Manual account selection now wins over an earlier asynchronous category-account lookup.
- Queueing shares the save in-flight guard, preventing rapid taps from adding the same form twice. Busy queue actions show “Adding…”.
- Save’s entry count includes both queued entries and a populated current form.
- Usual shortcuts are keyed to transaction type and edit context, so previous-type results disappear immediately during loading or failure.

## Validation

- 104 unique focused tests passed across 11 suites, run in batches. Coverage includes transaction screen, amount validation, calculator, account transfers, detail sheets, split flow/draft, privacy masking and category-grid sizing.
- Eight new regression tests cover account lookup races, duplicate queue taps, current-form Save count, pad hide/show, invalid expressions, rounding, stale shortcuts and wider columns.
- TypeScript and ESLint passed for the modified implementation and transaction feature files.
- Android JavaScript export passed. This is bundle validation, not an APK or EAS build.
- Test output includes asynchronous vector-icon `act(...)` warnings in some existing component suites; assertions passed. Device keyboard, small-screen layout, TalkBack and animation performance remain to be verified on a phone.

The private Site remains the approved design demonstration; it does not run the native ledger. No APK was requested or built.
