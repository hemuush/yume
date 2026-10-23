import { findRecentRepeat } from '@/db/ledger';
import { AddDefaults, setAddDefaults } from '@/db/settings';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { EntryType, formToStaged as formToStagedEntry, repeatKey, Staged } from '@/features/add/addEntry';
import { applyPadKey, PadKey } from '@/lib/padMath';
import { showAlert } from '@/components/AppDialog';
import type { useAddDraftWorkflow } from '@/features/add/hooks/useAddDraftWorkflow';
import type { useAddEntryData } from '@/features/add/hooks/useAddEntryData';
import type { useAddEntryDerived } from '@/features/add/hooks/useAddEntryDerived';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
  loader: ReturnType<typeof useAddEntryData>;
  draft: ReturnType<typeof useAddDraftWorkflow>;
  derived: ReturnType<typeof useAddEntryDerived>;
};
export function createAddEntryStagingActions(input: Input) {
  const {
    committedRef,
    saveInFlightRef,
    saving,
    addingRow,
    saveDone,
    editing,
    setType,
    setCategoryId,
    setSplitParts,
    setRefund,
    accounts,
    accountPickedByHandRef,
    setAccountId,
    setError,
    setExpr,
    addDefaultsRef,
    setNote,
    setNoteEditing,
    type,
    date,
    note,
    toAccountId,
    categoryId,
    personId,
    friendSign,
    friendAccountId,
    refund,
    paymentMode,
    categories,
    people,
    repeatWarning,
    rows,
    mountedRef,
    setRepeatWarning,
    formReady,
    setAddingRow,
    setRows,
  } = input.state;
  const { applyDefaults } = input.loader;
  const { amountMinor } = input.draft;
  const { effectiveAccountId, currency } = input.derived;

  const onTypeChange = (next: EntryType) => {
    if (committedRef.current || saveInFlightRef.current || saving || addingRow || saveDone) return;
    // A saved split is one expense across categories: switching it to income or a transfer would save only
    // the tapped part, as the whole payment. It stays an expense here.
    if (editing?.splitId && next !== 'expense') {
      showAlert(
        "A split can't change type",
        'A split payment is always an expense. To record it differently, delete the split and add it again.'
      );
      return;
    }
    setType(next);
    setCategoryId(null);
    // Only expenses split, or take money back.
    if (next !== 'expense') {
      setSplitParts(null);
      setRefund(false);
    }
    // A new entry switches to what this type was last saved with; an edit
    // keeps its own values, exactly as before.
    if (!editing) applyDefaults(next, accounts);
  };

  const pickAccount = (id: string) => {
    accountPickedByHandRef.current = true;
    setAccountId(id);
  };

  const onPadKey = (key: PadKey) => {
    if (saveInFlightRef.current || committedRef.current) return;
    setError(null);
    setExpr((prev) => applyPadKey(prev, key));
  };

  /** Remembers what was just saved, per type, for the next new entry. Best-effort. */
  const rememberDefaults = (saved: Staged[]) => {
    const next: AddDefaults = { ...addDefaultsRef.current };
    for (const r of saved) {
      if (r.kind !== 'transaction') continue;
      if (r.type === 'transfer') next.transfer = { accountId: r.accountId, toAccountId: r.toAccountId };
      else next[r.type] = { accountId: r.accountId, categoryId: r.categoryId };
    }
    addDefaultsRef.current = next;
    setAddDefaults(next).catch(() => {});
  };

  const clearForm = () => {
    setExpr('');
    setNote('');
    setNoteEditing(false);
  };

  /** Validate the current form into a staged row, or return an error string. */
  const formToStaged = () =>
    formToStagedEntry(
      {
        type,
        amountMinor,
        date,
        note,
        accountId: effectiveAccountId,
        toAccountId,
        categoryId,
        personId,
        friendSign,
        friendAccountId,
        refund,
        paymentMode,
      },
      { accounts, categories, people }
    );

  /**
   * True (with a note) when `row` looks like one saved in the last 30 minutes or already listed below; the
   * first Save only warns, a second goes ahead. Friend entries and edits aren't checked.
   */
  const warnIfRepeat = async (row: Staged): Promise<boolean> => {
    if (editing || row.kind !== 'transaction') return false;
    const key = repeatKey(row);
    if (repeatWarning?.key === key) return false;
    const what = `${formatMoney(row.amountMinor, currency)} · ${row.label}`;
    let message: string | null = null;
    if (rows.some((r) => r.kind === 'transaction' && repeatKey(r) === key)) {
      message = `${what} is already on your list below. Tap again to add it anyway.`;
    } else {
      const hit = await findRecentRepeat(row).catch(() => null);
      if (hit) {
        const at = new Date(hit.savedAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        const from = accounts.find((a) => a.id === row.accountId)?.name;
        message = `You added ${what}${from ? ` from ${from}` : ''} at ${at}. Tap again to add it anyway.`;
      }
    }
    if (!mountedRef.current) return true;
    if (!message) return false;
    haptics.warn();
    setRepeatWarning({ key, message });
    return true;
  };

  const addRow = async () => {
    if (
      !mountedRef.current ||
      !formReady ||
      committedRef.current ||
      saveInFlightRef.current ||
      saving ||
      saveDone
    )
      return;
    saveInFlightRef.current = true;
    setAddingRow(true);
    try {
      setError(null);
      const res = formToStaged();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      if ((await warnIfRepeat(res.row)) || !mountedRef.current) return;
      setRows((prev) => [...prev, res.row]);
      clearForm();
    } finally {
      saveInFlightRef.current = false;
      setAddingRow(false);
    }
  };

  const removeRow = (id: string) => {
    if (saveInFlightRef.current || committedRef.current) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };
  return {
    clearAmount: () => {
      if (!saveInFlightRef.current && !committedRef.current) setExpr('');
    },
    onTypeChange,
    pickAccount,
    onPadKey,
    rememberDefaults,
    clearForm,
    formToStaged,
    warnIfRepeat,
    addRow,
    removeRow,
  };
}
