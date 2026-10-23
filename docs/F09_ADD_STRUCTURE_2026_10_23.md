# F09 — separate Add workflows and presentation

## Root cause / result

The Add route held form state, hydration, draft recovery, validation, list staging, three save modes, deletion, navigation and the complete view in one 1,310-line component file. AmountCard took fourteen flat props. Reviewing save invariants required reading across this whole scope.

The route now composes a feature model and view. Feature-local hooks own state/resources, hydration, draft handling, suggestions and derived state. Typed command factories own staging, save decisions, deletion/navigation and post-commit completion. Views have no runtime repository imports. Save-mode choice, retry loading, repeat-sheet guards and amount-clear guards live behind controller actions. AmountCard takes five grouped inputs.

## Ownership and files

- [route](../app/add-transaction.tsx): eight lines including its trailing line, versus 1,310 with the same counting method.
- [model composition](../src/features/add/hooks/useAddEntryModel.ts) and [public model type](../src/features/add/types/addEntryModel.ts).
- [state/resource owner](../src/features/add/hooks/useAddEntryState.ts), [hydration](../src/features/add/hooks/useAddEntryData.ts), [draft workflow](../src/features/add/hooks/useAddDraftWorkflow.ts), [suggestions](../src/features/add/hooks/useAddEntrySuggestions.ts), [derived values](../src/features/add/hooks/useAddEntryDerived.ts), [environment](../src/features/add/hooks/useAddEntryEnvironment.ts).
- [save coordinator](../src/features/add/api/createAddEntrySaveActions.ts), [post-commit completion](../src/features/add/api/createAddEntrySaveCompletion.ts), [staging](../src/features/add/api/createAddEntryStagingActions.ts), [navigation/deletion](../src/features/add/api/createAddEntryActions.ts).
- [view composition](../src/features/add/components/AddEntryView.tsx), [body](../src/features/add/components/AddEntryBody.tsx), [header](../src/features/add/components/AddEntryHeader.tsx), [footer](../src/features/add/components/AddEntryFooter.tsx), [fields](../src/features/add/components/AddEntryFields.tsx), [sheets](../src/features/add/components/AddEntrySheets.tsx), amount/load/draft view sections and the former AddSections pieces under the same components folder.
- [AmountCard](../src/features/add/components/AmountCard.tsx) groups amount data, pad behavior and suggestions. [AddSections](../src/features/add/AddSections.tsx) remains a compatibility barrel.
- Identity/presentation helpers under `features/add/utils`, architecture and this record.

All new modules are below 300 lines; the largest is the 260-line hydration hook. All new view-component files are below 200 lines. Existing layout values, labels, validation and persistence behavior are retained; no dependency or schema change.

## Validation / self-review

This is a structural finding, not a newly demonstrated runtime defect: existing behavior tests serve as the characterization contract. Before extraction the full suite passed. After extraction the focused Add, transfer, privacy, detail-row and draft-recovery run passed **5 suites / 79 tests**. No journey assertion was weakened.

Strict TypeScript, whole-repository lint, formatting and cycle checks pass. Extraction exposed dependency/ref lint warnings; refs now have explicit Ref names, stable callback dependencies are included, and timer cancellation stays with the lifetime owner. No rule suppression or unsafe cast was added. Relocated relative imports were replaced with feature aliases and verified by type-check/tests. Fresh full regression: **331 suites / 11,434 tests passed; 2 suites/tests skipped**, 379.6 seconds.

The submission guard and committed flag remain shared refs. Staged partial-save handling, recurring/repeat warnings, linked-entry restrictions, exact untouched edit amounts, split signatures, draft preparation/cleanup and delayed navigation retain their original contracts. The view calls a single submit action rather than selecting save modes. Timer cleanup reads the latest owned timer and clears it on unmount.

## Risk / Android acceptance

The risk is changing hook lifetime or callback dependencies during extraction. Dependencies use stable setters/refs rather than newly created owner objects; existing load sequences and mounted guards remain. New dependency groups pass their owners directly, avoiding repeated spreading of the complete form into every helper.

Device checks remain pending: create expense/income/transfer/friend entries; stage several rows and retry a partial failure; edit linked/ordinary/split entries; leave/resume drafts; confirm future-date prompts; leave during delayed completion; exercise keyboard/Back, 200% text and TalkBack. Check OS dark appearance against configured light UI. iOS is outside scope. No native performance improvement is claimed.

Rollback: revert this fix's commit; compatibility imports and route behavior return to the previous implementation. No migration is required.
