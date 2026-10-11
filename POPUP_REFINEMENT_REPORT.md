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
