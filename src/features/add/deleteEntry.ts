import { deleteTransaction, restoreTransaction } from '@/db/ledger';
import { deleteSplit, restoreSplit } from '@/db/splits';
import { Transaction } from '@/types';
import { showAlert } from '@/components/AppDialog';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';

/**
 * Asks before deleting the entry being edited, then deletes it (a whole split payment, if it is one), goes
 * back and offers Undo. `splitParts` is how many parts the split has, for the message.
 */
export function confirmDeleteEntry({
  editing,
  splitParts,
  showUndo,
  onStart,
  onDeleted,
  onError,
}: {
  editing: Transaction;
  splitParts: number;
  showUndo: (message: string, onUndo: () => Promise<void>) => void;
  /** Acquires the same lock as Save; a stale confirmation must not mutate. */
  onStart: () => boolean;
  /** Returns false when the owning screen has already closed. */
  onDeleted: () => boolean;
  onError: (message: string) => void;
}) {
  const splitId = editing.splitId;
  if (splitId) {
    showAlert(
      'Delete this split payment?',
      `All ${splitParts} parts move to Recently deleted for 30 days. Account balances update right away.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!onStart()) return;
            let snapshots;
            try {
              snapshots = await deleteSplit(splitId);
            } catch (e) {
              onError(errorMessage(e));
              return;
            }
            emitTransactionsChanged();
            if (!onDeleted()) return;
            haptics.warn();
            showUndo('Split moved to Recently deleted', async () => {
              await restoreSplit(snapshots);
              emitTransactionsChanged();
            });
          },
        },
      ]
    );
    return;
  }
  showAlert(
    'Delete this entry?',
    'It moves to Recently deleted for 30 days. Account balances update right away.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!onStart()) return;
          let snapshot;
          try {
            snapshot = await deleteTransaction(editing.id);
          } catch (e) {
            onError(errorMessage(e));
            return;
          }
          emitTransactionsChanged();
          if (!onDeleted()) return;
          haptics.warn();
          showUndo('Moved to Recently deleted', async () => {
            await restoreTransaction(snapshot);
            emitTransactionsChanged();
          });
        },
      },
    ]
  );
}
