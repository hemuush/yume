import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUndoToast } from '@/components/UndoToast';
import { useAccent } from '@/theme/AccentContext';
import { useReduceMotion } from '@/lib/useReduceMotion';

export function useAddEntryEnvironment() {
  const insets = useSafeAreaInsets();

  const { show: showUndo } = useUndoToast();

  const { accent, secondary } = useAccent();

  const reduceMotion = useReduceMotion();

  // `accountId` pre-selects the account (the "from" side of a transfer) —
  // Home's account summary sheet opens Add this way.
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    accountId?: string;
    toAccountId?: string;
    /** Prefills the amount, in minor units — a card's "Pay bill". */
    amount?: string;
    /** "Got money back" on an entry: opens as a refund for its category, with its note. */
    refund?: string;
    categoryId?: string;
    note?: string;
  }>();

  const editingId = params.id;

  const initialType = params.type;

  const initialAccountId = params.accountId;

  // A transfer's destination, e.g. "Move money here" on a goal that follows an account.
  const initialToAccountId = params.toAccountId;

  // "Got money back" on an entry: a refund for its category, with its note.
  const refundParam = params.refund;

  const categoryParam = params.categoryId;

  const noteParam = params.note;
  return {
    insets,
    showUndo,
    accent,
    secondary,
    reduceMotion,
    params,
    editingId,
    initialType,
    initialAccountId,
    initialToAccountId,
    refundParam,
    categoryParam,
    noteParam,
  };
}
