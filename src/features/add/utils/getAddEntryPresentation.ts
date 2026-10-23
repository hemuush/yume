import { formatMoney } from '@/lib/money';
import { TYPE_WASH, typeWash } from '@/features/add/addEntry';
import { hasOperator } from '@/lib/padMath';
import { splitProblem } from '@/features/add/splitDraft';
import { formatTyped, saveButtonTitle } from '@/features/add/saveEntry';
import type { createAddEntryStagingActions } from '@/features/add/api/createAddEntryStagingActions';
import type { useAddDraftWorkflow } from '@/features/add/hooks/useAddDraftWorkflow';
import type { useAddEntryDerived } from '@/features/add/hooks/useAddEntryDerived';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  environment: ReturnType<typeof useAddEntryEnvironment>;
  state: ReturnType<typeof useAddEntryState>;
  draft: ReturnType<typeof useAddDraftWorkflow>;
  derived: ReturnType<typeof useAddEntryDerived>;
  staging: ReturnType<typeof createAddEntryStagingActions>;
};
export function getAddEntryPresentation(input: Input) {
  const { editingId, accent } = input.environment;
  const {
    expr,
    splitParts,
    rows,
    saving,
    editing,
    refund,
    repeatWarning,
    padOpen,
    noteEditing,
    searchFocused,
    isLinked,
    addingRow,
    saveDone,
    type,
  } = input.state;
  const { amountValue, amountMinor, untouchedEdit } = input.draft;
  const { currency, effectiveAccountId } = input.derived;
  const { formToStaged } = input.staging;

  const title = editingId ? 'Edit entry' : 'Add';

  const sum = hasOperator(expr);

  const shownAmount = sum
    ? amountValue === null
      ? '—'
      : formatTyped(String(amountValue))
    : expr !== '' && amountValue === null
      ? '—'
      : formatTyped(expr);

  const invalidAmount = expr !== '' && amountMinor <= 0;

  const roundingNote =
    !untouchedEdit && amountValue !== null && amountValue !== amountMinor / 100
      ? `Saved in whole units: ${formatMoney(amountMinor, currency)}`
      : undefined;

  const currentValidation = formToStaged();

  const currentProblem = 'error' in currentValidation ? currentValidation.error : undefined;

  const cannotSave = splitParts
    ? !!splitProblem(amountMinor, splitParts) || !effectiveAccountId
    : (expr !== '' || rows.length === 0) && !!currentProblem;

  // The Save button names the amount it saves; the category shows on the grid and the account on its chip.
  const saveSummary = amountMinor > 0 && !invalidAmount ? formatMoney(amountMinor, currency) : undefined;

  const saveTitle = saveButtonTitle({
    saving,
    editing: !!editing,
    split: !!splitParts,
    refund,
    repeatWarning: !!repeatWarning,
    rowCount: rows.length,
    hasCurrent: expr !== '',
    summary: saveSummary,
  });

  // The pad steps aside whenever the phone keyboard is up (a note, a category search).
  const padVisible = padOpen && !noteEditing && !searchFocused && !isLinked;

  const formBusy = saving || addingRow || saveDone;

  // The pad's sum keys wear the entry's colour (green for money back), like the amount above them.
  const wash = refund ? TYPE_WASH.income : typeWash(type, accent);

  const padTone = { bg: wash.bg, ink: wash.accent };
  return {
    title,
    sum,
    shownAmount,
    invalidAmount,
    roundingNote,
    currentProblem,
    cannotSave,
    saveTitle,
    padVisible,
    formBusy,
    padTone,
  };
}
