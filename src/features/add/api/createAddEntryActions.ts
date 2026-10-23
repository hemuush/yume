import { router } from 'expo-router';
import { listPeople } from '@/db/people';
import { dateChipLabel } from '@/features/add/addEntry';
import { errorMessage } from '@/lib/errorMessage';
import { seedParts } from '@/features/add/splitDraft';
import { openSplitSession } from '@/features/add/splitSession';
import { confirmDeleteEntry } from '@/features/add/deleteEntry';
import { showAlert } from '@/components/AppDialog';
import type { useAddDraftWorkflow } from '@/features/add/hooks/useAddDraftWorkflow';
import type { useAddEntryDerived } from '@/features/add/hooks/useAddEntryDerived';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
  draft: ReturnType<typeof useAddDraftWorkflow>;
  derived: ReturnType<typeof useAddEntryDerived>;
  environment: ReturnType<typeof useAddEntryEnvironment>;
};
const SPLIT_EDITOR_ROUTE = '/split';
export function createAddEntryActions(input: Input) {
  const {
    formReady,
    saveInFlightRef,
    committedRef,
    setError,
    setPadOpen,
    date,
    note,
    splitParts,
    categoryId,
    editing,
    saving,
    addingRow,
    saveDone,
    mountedRef,
    setSaving,
    setAddPersonVisible,
    people,
    setPeople,
    setPersonId,
    setRepeatSheetVisible,
  } = input.state;
  const { amountMinor, leave } = input.draft;
  const { today, yesterday, currency, effectiveAccount, filteredCategories } = input.derived;
  const { showUndo } = input.environment;

  /** Opens the split page with this payment: its parts so far, or its category holding all of it. */
  const openSplit = () => {
    if (!formReady || saveInFlightRef.current || committedRef.current) return;
    setError(null);
    if (amountMinor <= 0) {
      setError('Enter the amount first');
      setPadOpen(true);
      return;
    }
    const dateLabel = date === today ? 'Today' : date === yesterday ? 'Yesterday' : dateChipLabel(date);
    openSplitSession({
      totalMinor: amountMinor,
      currency,
      meta: [effectiveAccount?.name, dateLabel, note.trim()].filter(Boolean).join(' · '),
      categories: filteredCategories,
      parts: splitParts ?? seedParts(categoryId),
    });
    router.push(SPLIT_EDITOR_ROUTE);
  };

  const onDelete = () => {
    if (!editing || saveInFlightRef.current || saving || addingRow || saveDone) return;
    confirmDeleteEntry({
      editing,
      splitParts: splitParts?.length ?? 2,
      showUndo,
      onStart: () => {
        if (!mountedRef.current || committedRef.current || saveInFlightRef.current) return false;
        saveInFlightRef.current = true;
        setSaving(true);
        setError(null);
        return true;
      },
      onDeleted: () => {
        committedRef.current = true;
        if (!mountedRef.current) return false;
        leave(() => router.back());
        return true;
      },
      onError: (message) => {
        saveInFlightRef.current = false;
        if (!mountedRef.current) return;
        setSaving(false);
        setError(message);
      },
    });
  };

  /** Picks the person just added in the new-person sheet. */
  const onPersonAdded = async () => {
    setAddPersonVisible(false);
    const before = new Set(people.map((p) => p.id));
    try {
      const ppl = await listPeople();
      setPeople(ppl);
      const added = ppl.find((p) => !before.has(p.id));
      if (added) setPersonId(added.id);
    } catch (e) {
      showAlert("Couldn't load people", errorMessage(e));
    }
  };
  const openRepeatSheet = (): void => {
    if (formReady && !committedRef.current && !saveInFlightRef.current && !saving && !addingRow && !saveDone)
      setRepeatSheetVisible(true);
  };
  return { openSplit, onDelete, onPersonAdded, openRepeatSheet };
}
