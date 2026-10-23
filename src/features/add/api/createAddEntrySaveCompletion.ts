import { emitTransactionsChanged } from '@/lib/dataEvents';
import { router } from 'expo-router';
import { showAlert } from '@/components/AppDialog';
import type { useAddDraftWorkflow } from '@/features/add/hooks/useAddDraftWorkflow';
import type { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import type { useAddEntryState } from '@/features/add/hooks/useAddEntryState';

type Input = {
  state: ReturnType<typeof useAddEntryState>;
  environment: ReturnType<typeof useAddEntryEnvironment>;
  draft: ReturnType<typeof useAddDraftWorkflow>;
};
const SAVE_CONFIRMATION_MS = 320;
export function createAddEntrySaveCompletion(input: Input) {
  const { committedRef, mountedRef, setSaveDone, backTimerRef } = input.state;
  const { editingId, reduceMotion } = input.environment;
  const { recovery } = input.draft;

  // A brief "done" checkmark (PrimaryButton `done`) before navigating back; the data is already saved, so
  // the delay is purely felt confirmation.
  const goBackAfterSave = () => {
    committedRef.current = true;
    emitTransactionsChanged();
    if (!editingId)
      void recovery.clear().catch(() => {
        if (mountedRef.current)
          showAlert(
            'Entry saved',
            'The entry was saved, but its recovery draft could not be removed. Discard that draft if it appears again.'
          );
      });
    if (!mountedRef.current) return;
    setSaveDone(true);
    backTimerRef.current = setTimeout(
      () => {
        if (mountedRef.current) router.back();
      },
      reduceMotion ? 0 : SAVE_CONFIRMATION_MS
    );
  };
  return { goBackAfterSave };
}
