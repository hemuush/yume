import { emitTransactionsChanged } from '@/lib/dataEvents';
import { updateTransaction } from '@/db/ledger';
import { formatMoney } from '@/lib/money';
import { addDaysToIsoDate } from '@/lib/date';
import { markJustAdded } from '@/lib/justAdded';
import { dateChipLabel } from '@/features/add/addEntry';
import { errorMessage } from '@/lib/errorMessage';
import { getSplitParts, saveSplit } from '@/db/splits';
import { splitProblem, splitProblemText, toSplitParts } from '@/features/add/splitDraft';
import { persistStaged } from '@/features/add/saveEntry';
import { showAlert } from '@/components/AppDialog';
import type { createAddEntrySaveCompletion } from '@/features/add/api/createAddEntrySaveCompletion';
import type { createAddEntryStagingActions } from '@/features/add/api/createAddEntryStagingActions';
import type { useAddDraftWorkflow } from '@/features/add/hooks/useAddDraftWorkflow';
import type { useAddEntryDerived } from '@/features/add/hooks/useAddEntryDerived';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

const FUTURE_DATE_CHECK_DAYS = 7;
type Input = {
  state: ReturnType<typeof useAddEntryState>;
  draft: ReturnType<typeof useAddDraftWorkflow>;
  derived: ReturnType<typeof useAddEntryDerived>;
  environment: ReturnType<typeof useAddEntryEnvironment>;
  completion: ReturnType<typeof createAddEntrySaveCompletion>;
  staging: ReturnType<typeof createAddEntryStagingActions>;
};
export function createAddEntrySaveActions(input: Input) {
  const {
    splitParts,
    setError,
    categories,
    setSaving,
    editing,
    date,
    note,
    paymentMode,
    rows,
    expr,
    mountedRef,
    setRows,
    formReady,
    isLinked,
    committedRef,
    saveInFlightRef,
    editBaseline,
  } = input.state;
  const { amountMinor, recovery } = input.draft;
  const { currency, effectiveAccountId, today } = input.derived;
  const { editingId } = input.environment;
  const { goBackAfterSave } = input.completion;
  const { formToStaged, warnIfRepeat, rememberDefaults, clearForm } = input.staging;

  const onSaveSplit = async () => {
    if (!splitParts) return;
    setError(null);
    const problem = splitProblem(amountMinor, splitParts);
    if (problem) {
      const nameOf = (key: string) =>
        categories.find((c) => c.id === splitParts.find((p) => p.key === key)?.categoryId)?.name ??
        'this part';
      setError(splitProblemText(problem, splitParts, nameOf, (m) => formatMoney(m, currency)));
      return;
    }
    if (!effectiveAccountId) {
      setError('Pick an account');
      return;
    }
    setSaving(true);
    try {
      if (!editingId) await recovery.prepareSave();
      const splitId = await saveSplit({
        splitId: editing?.splitId ?? null,
        // Splitting an ordinary entry being edited: the parts take its place.
        replacesEntryId: editing && !editing.splitId ? editing.id : null,
        accountId: effectiveAccountId,
        date,
        note: note.trim(),
        parts: toSplitParts(amountMinor, splitParts),
        paymentMode,
      });
      // The lists you land back on glow the new parts, like any saved entry.
      try {
        markJustAdded((await getSplitParts(splitId)).map((p) => p.id));
      } catch {
        /* The split is saved; highlight lookup failure must never invite a second save. */
      }
      goBackAfterSave();
    } catch (e) {
      if (!editingId) recovery.resumeAfterFailedSave();
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const onSaveSingleEdit = async () => {
    setError(null);
    const res = formToStaged();
    if ('error' in res) {
      setError(res.error);
      return;
    }
    const r = res.row;
    if (r.kind !== 'transaction' || !editing) return;
    setSaving(true);
    try {
      await updateTransaction(editing.id, {
        type: r.type,
        accountId: r.accountId,
        toAccountId: r.toAccountId,
        categoryId: r.categoryId,
        amountMinor: r.amountMinor,
        date: r.date,
        note: r.note,
        // Turning Money back off makes it an expense again, and on makes it a refund.
        isRefund: !!r.isRefund,
        paymentMode: r.paymentMode,
      });
      markJustAdded([editing.id]);
      goBackAfterSave();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const onSaveAll = async () => {
    setError(null);
    const pending = [...rows];
    if (expr !== '') {
      const res = formToStaged();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      if ((await warnIfRepeat(res.row)) || !mountedRef.current) return;
      pending.push(res.row);
    }
    if (pending.length === 0) {
      setError('Enter an amount');
      return;
    }

    setSaving(true);
    let saved = 0;
    const savedIds: string[] = [];
    let prepared = false;
    try {
      await recovery.prepareSave();
      prepared = true;
      for (const r of pending) {
        const id = await persistStaged(r, categories);
        if (id) savedIds.push(id);
        saved += 1;
      }
      // The lists you land back on glow these rows once (lib/justAdded).
      markJustAdded(savedIds);
      rememberDefaults(pending);
      goBackAfterSave();
    } catch (e) {
      recovery.resumeAfterFailedSave();
      if (!prepared) {
        setError(`Couldn’t prepare this save: ${errorMessage(e)}`);
        setSaving(false);
        return;
      }
      if (saved > 0) emitTransactionsChanged();
      // Keep only what didn't make it in, so a retry doesn't double up.
      setRows(pending.slice(saved));
      clearForm();
      setSaving(false);
      showAlert(
        saved > 0 ? 'Only some entries saved' : 'No entries saved',
        `${saved} of ${pending.length} saved before this went wrong: ${errorMessage(e)}`
      );
    }
  };

  const runSave = async (save: () => Promise<void>, dateChecked = false) => {
    if (!mountedRef.current || !formReady || isLinked || committedRef.current || saveInFlightRef.current)
      return;
    // A date well ahead is usually a typo (the wrong year), and it moves today's balances straight away.
    const pendingDates = !editing && !splitParts ? rows.map((row) => row.date) : [];
    // An unchanged date on an entry being edited was already accepted when it was saved.
    const dateUnchanged = !!editing && editBaseline !== null && editBaseline.date === date;
    if ((editing || splitParts || expr !== '') && !dateUnchanged) pendingDates.push(date);
    const futureDate = pendingDates.find((d) => d > addDaysToIsoDate(today, FUTURE_DATE_CHECK_DAYS));
    if (!dateChecked && futureDate) {
      showAlert(`Save it for ${dateChipLabel(futureDate)}?`, "That's more than a week from today.", [
        { text: 'Change date', style: 'cancel' },
        { text: 'Save', onPress: () => void runSave(save, true) },
      ]);
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      await save();
    } finally {
      saveInFlightRef.current = false;
      if (mountedRef.current && !committedRef.current) setSaving(false);
    }
  };
  const submit = (): void => {
    void runSave(splitParts ? onSaveSplit : editing ? onSaveSingleEdit : onSaveAll);
  };
  return { submit };
}
