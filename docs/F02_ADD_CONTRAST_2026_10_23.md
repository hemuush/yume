# F02 — readable Add labels

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

The Add tone supplied the same decorative color to keypad operators, amount labels and currency text. Expense and income missed 4.5:1, and deriving a transfer label at fixed 45% HSL lightness also failed in several theme packs.

The tone now uses the existing `expenseText` / `incomeText` semantic inks and the shared deep theme ink for transfer/friend labels. Pastel backgrounds are unchanged. No amount, validation, persistence or navigation behavior changed.

## Files

- [addEntry.ts](../src/features/add/addEntry.ts:18): readable per-type inks and theme-derived transfer ink.
- [contrast.test.ts](../src/__tests__/contrast.test.ts:59): verify every entry type and every theme on keypad/card backgrounds.
- This record.

Before the change, the expanded contrast suite had 10 failures / 31 passes. Afterward, all 41 contrast tests passed; the focused contrast/form/save run passed 3 suites / 57 tests.

Expense contrast improved from **2.054:1 to 4.572:1** on its keypad background; income from **3.075:1 to 4.758:1**. Both now meet 4.5:1. Fresh full regression: **327 suites / 11,414 tests passed; 2 suites/tests skipped**, 317.1 seconds. TypeScript, whole-repository lint, formatting and cycle checks also passed.

Risk is limited to darker semantic foreground colors; the same tone also colors the small amount marker/caret. Android visual acceptance remains pending: check expense/income/refund/transfer/friend labels, all themes, long amounts, 200% font after F03, and OS dark appearance against configured light UI. iOS is outside scope. No native acceptance is claimed.

Rollback: revert this fix's commit; no migration or dependency rollback is needed.
