import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { useUndoToast } from '@/components/UndoToast';
import { createTransaction, deleteTransaction, getRepeatEntries, RepeatEntry } from '@/db/ledger';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { errorMessage } from '@/lib/errorMessage';

/** "Metro · ₹150" — the entry's own note if it has one, else its category. */
export function repeatEntryLabel(entry: RepeatEntry): string {
  return `${entry.note.trim() || entry.categoryName} · ${formatMoney(entry.amountMinor, entry.accountCurrency)}`;
}

/**
 * The + button's long-press: the user's most repeated hand-logged entries
 * (see getRepeatEntries), each saved for today with one tap — then an Undo
 * toast, the same one every delete in the app uses, in case it was a slip.
 * Always ends with a plain "Open Add" row, so the long-press is never a dead
 * end even before anything repeats — except when opened from the Add screen
 * itself (`fromAdd`), where that row would only open Add again; there
 * `onLogged` runs after an entry is logged, so Add can close.
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
      showUndo(`Logged ${repeatEntryLabel(entry)}`, async () => {
        try {
          await deleteTransaction(tx.id, { keep: false });
          emitTransactionsChanged();
        } catch (e) {
          Alert.alert("Couldn't undo", errorMessage(e));
        }
      });
    } catch (e) {
      Alert.alert("Couldn't log it", errorMessage(e));
    } finally {
      saving.current = false;
    }
  };

  const items: ActionSheetItem[] = [
    ...entries.map((entry) => ({
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
