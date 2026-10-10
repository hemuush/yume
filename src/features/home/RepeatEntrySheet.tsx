import { useEffect, useRef, useState } from 'react';

import { router } from 'expo-router';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { useUndoToast } from '@/components/UndoToast';
import { createTransaction, deleteTransaction, getRepeatEntries, RepeatEntry } from '@/db/ledger';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { categoryPath, categorySentence } from '@/lib/categoryLabel';
import { toLocalIsoDate } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

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
 * + long-press: most repeated hand-logged entries (getRepeatEntries); one tap saves for today, then Undo.
 * Ends with "Open Add" unless opened from Add (`fromAdd`); there `onLogged` fires so Add can close.
 */
export function RepeatEntrySheet({
  visible,
  onClose,
  fromAdd,
  onLogged,
}: {
  visible: boolean;
  onClose: () => void;
  fromAdd?: boolean;
  onLogged?: () => void;
}) {
  const { show: showUndo } = useUndoToast();
  const { hideAmounts } = usePrivacy();
  const [entries, setEntries] = useState<RepeatEntry[]>([]);
  // A second tap before the sheet finishes closing must not log it twice.
  const saving = useRef(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getRepeatEntries()
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const logAgain = async (entry: RepeatEntry) => {
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
          showAlert("Couldn't undo", errorMessage(e));
        }
      });
    } catch (e) {
      showAlert("Couldn't log it", errorMessage(e));
    } finally {
      saving.current = false;
    }
  };

  const items: ActionSheetItem[] = [
    ...entries
      .filter((entry) => !hideAmounts || !entry.isSensitive)
      .map((entry) => ({
        key: `${entry.type}:${entry.accountId}:${entry.categoryId}:${entry.amountMinor}`,
        label: repeatEntryLabel(entry),
        icon: (entry.type === 'income' ? 'arrow-down-right' : 'arrow-up-right') as ActionSheetItem['icon'],
        onPress: () => void logAgain(entry),
      })),
    ...(fromAdd
      ? []
      : [
          {
            key: 'open-add',
            label: 'Open Add screen',
            icon: 'plus' as const,
            onPress: () => router.push('/add-transaction'),
          },
        ]),
  ];

  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title="Log again"
      subtitle={
        entries.length > 0
          ? 'Saved for today with one tap. You can undo it straight after.'
          : 'Entries you log often will show up here.'
      }
      items={items}
    />
  );
}
