import { router } from 'expo-router';
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
  onError,
}: {
  editing: Transaction;
  splitParts: number;
  showUndo: (message: string, onUndo: () => Promise<void>) => void;
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
            try {
              const snapshots = await deleteSplit(splitId);
              haptics.warn();
              router.back();
              showUndo('Split moved to Recently deleted', async () => {
                await restoreSplit(snapshots);
                emitTransactionsChanged();
              });
            } catch (e) {
              onError(errorMessage(e));
            }
          },
        },
      ]
    );
    return;
  }
  showAlert(
    'Delete this transaction?',
    'It moves to Recently deleted for 30 days. Account balances update right away.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const snapshot = await deleteTransaction(editing.id);
            haptics.warn();
            router.back();
            showUndo('Moved to Recently deleted', async () => {
              await restoreTransaction(snapshot);
              emitTransactionsChanged();
            });
          } catch (e) {
            onError(errorMessage(e));
          }
        },
      },
    ]
  );
}
