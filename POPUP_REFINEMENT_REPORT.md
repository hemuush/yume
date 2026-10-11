# Popup refinements — 11 October 2026

The supplied screenshots still showed the shared gradient SheetCard banners, blank sheet headers, raised circular close controls, and a second action sheet above the loan details. The previous dialog fix addressed confirmation spacing, not these detail sheets.

Changes:

- SheetCard now uses a compact neutral surface, a category-coloured icon and edge, title-first hierarchy, a readable amount, and wrapping context. Live form previews, masked amounts and goal progress remain supported. Gradient layers and decorative circles were removed.
- ModalSheet uses a plain surface and a quiet 44dp close control. Headers and pinned footers remain shared, with safe-area spacing outside centered dialogs.
- Named headers were added to person, transaction, budget, recurring, account, loan, category, goal and investment sheets that previously opened with only a close button.
- Person, loan and recurring navigation uses simple underline tabs. All former views remain available.
- Loan actions replace the content within the loan detail sheet, with a Back to loan action. Prepayment, rate updates and deletion still use their existing handlers and eligibility checks; opening the short menu no longer creates a second modal.
- Action menus use a plain bordered list with wrapping labels, without a decorative strip or card shadow. Transaction shortcut buttons wrap on narrow layouts.
- Budget rollover copy was shortened while preserving the switch and saving behavior.

Coverage includes the five screenshot areas and other users of these shared components: accounts, goals, recurring setup, category setup, investment value updates, loan payment confirmations and backup previews. No business queries, amount units, storage choices or save/delete semantics changed.

Validation: 142 tests passed across 19 affected component/screen suites. After the final underline-tab changes, all 22 person, loan and recurring tests passed again. Type checking, changed-file lint and diff checks passed. A fresh Android export succeeded with 2,303 modules. Physical-device visual review remains necessary, especially system font scaling, keyboard movement and nested payment/edit flows. These source changes are newer than APK build 14 and require a new APK before they appear on the installed app.

## Second pass

Reviewed all 37 ModalSheet call sites across 36 caller files, including calendar/period pickers, account/category selection, split editing, filters, reports drill-throughs, restore previews, milestones, Wrap selection, loan payment/prepayment/rate/account/asset forms, recurring setup, people, accounts and goals. The app's only native Modal remains the shared ModalSheet host.

Additional misses fixed:

- Account-summary navigation and category, goal-contribution, loan-rate, loan-setup and transaction-filter selectors now use the shared SheetTabs layout.
- Removed redundant tab wrappers and their duplicated bottom gaps from account, person, loan and recurring details.
- Restore preview and goal milestone sheets now have clear headers.
- Account pickers, action menus, calendar dialogs and Wrap menus can scroll within their available height. Split category selection and period selection already have bounded internal scrolling; their scroll ownership was retained. Framed forms keep their pinned footer and keyboard-aware scrolling.

The additional affected behavior tests passed: 80 tests in nine suites. Type checking, changed-file lint and diff checks passed; Android export succeeded with 2,303 modules. The remaining full-page SegmentedControls belong to page-level navigation or inline transaction fields rather than forgotten popup navigation. No screenshot-perfect or device-performance claim is made from this code audit; device visual QA remains open.
