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

/** "Metro · ₹150" — the entry's own note if it has one, else its category. */
export function repeatEntryLabel(entry: RepeatEntry): string {
  return `${entry.note.trim() || entry.categoryName} · ${formatMoney(entry.amountMinor, entry.accountCurrency)}`;
}

/**
 * The + button's long-press: the user's most repeated hand-logged entries
 * (see getRepeatEntries), each saved for today with one tap — then an Undo
 * toast, the same one every delete in the app uses, in case it was a slip.
 * Always ends with a plain "Open Add" row, so the long-press is never a dead
 * end even before anything repeats.
 */
export function RepeatEntrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
      showUndo(`Logged ${repeatEntryLabel(entry)}`, async () => {
        try {
          await deleteTransaction(tx.id);
          emitTransactionsChanged();
        } catch (e: any) {
          Alert.alert('Could not undo', String(e?.message ?? e));
        }
      });
    } catch (e: any) {
      Alert.alert('Could not log it', String(e?.message ?? e));
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
    {
      key: 'open-add',
      label: 'Open Add screen',
      icon: 'plus',
      onPress: () => router.push('/add-transaction'),
    },
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
