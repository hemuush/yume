import { useCallback, useRef } from 'react';
import { useUndoToast } from '@/components/UndoToast';
import { showAlert } from '@/components/AppDialog';
import { createTransaction, deleteTransaction, type RepeatEntry } from '@/db/ledger';
import { categoryPath, categorySentence } from '@/lib/categoryLabel';
import { toLocalIsoDate } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

/**
 * Label like "Metro · ₹150": the note if present, else the category; a subcategory names its parent
 * ("Food & Dining › Zomato · ₹150", or "Dinner (Food & Dining) · ₹150" with a note).
 */
export function repeatEntryLabel(entry: RepeatEntry, hideAmounts = false): string {
  const note = entry.note.trim();
  const what = note
    ? categorySentence(note, entry.parentName)
    : categoryPath(entry.categoryName, entry.parentName);
  return `${what} · ${formatMaskableMoney(entry.amountMinor, { currency: entry.accountCurrency, masked: hideAmounts && entry.isSensitive })}`;
}

/**
 * Saves a repeated entry again for today, then offers Undo. Shared by the "Log again" sheet and Home's chips, so
 * both save the same way. A second tap while one is saving is ignored, so nothing is logged twice.
 */
export function useLogAgain(onLogged?: () => void) {
  const { show: showUndo } = useUndoToast();
  const { hideAmounts } = usePrivacy();
  const saving = useRef(false);
  return useCallback(
    async (entry: RepeatEntry) => {
      if (saving.current) return;
      saving.current = true;
      try {
        const tx = await createTransaction({
          type: entry.type,
          accountId: entry.accountId,
          categoryId: entry.categoryId,
          amountMinor: entry.amountMinor,
          date: toLocalIsoDate(new Date()),
          note: entry.note,
        });
        haptics.confirm();
        emitTransactionsChanged();
        onLogged?.();
        showUndo(`Logged ${repeatEntryLabel(entry, hideAmounts)}`, async () => {
          try {
            await deleteTransaction(tx.id, { keep: false });
            emitTransactionsChanged();
          } catch (e) {
            showAlert('Couldn’t undo', errorMessage(e));
          }
        });
      } catch (e) {
        showAlert('Couldn’t log it', errorMessage(e));
      } finally {
        saving.current = false;
      }
    },
    [showUndo, hideAmounts, onLogged]
  );
}
