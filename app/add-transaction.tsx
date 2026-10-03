import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  listAccounts,
  listCategories,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactionById,
  getTransactionLink,
  getFrequentAmountsForCategory,
  getRepeatEntries,
  RepeatEntry,
  getLastAccountForCategory,
  findRecentRepeat,
} from '@/db/ledger';
import { getAddDefaults, setAddDefaults, AddDefaults } from '@/db/settings';
import { listPeople, PersonWithBalance } from '@/db/people';
import { Account, Category, Transaction } from '@/types';
import { theme } from '@/constants/theme';
import { toMinor, formatMoney } from '@/lib/money';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { markJustAdded } from '@/lib/justAdded';
import { haptics } from '@/lib/haptics';
import { AppHeader } from '@/components/AppHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { ModalSheet } from '@/components/ModalSheet';
import { SoftCard } from '@/components/SoftCard';
import { CalendarSheet } from '@/components/CalendarSheet';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { styles } from '@/features/add/add.styles';
import {
  EntryType,
  Staged,
  isTxType,
  dateChipLabel,
  repeatKey,
  formToStaged as formToStagedEntry,
} from '@/features/add/addEntry';
import { applyPadKey, evaluateAmount, exprFromMinor, hasOperator, PadKey } from '@/lib/padMath';
import { AmountPad } from '@/components/AmountPad';
import { AccountTile, Totals, FriendFields, DetailBar, DetailChip } from '@/features/add/AddFields';
import { AmountCard, TransferAccounts, UsualChips, StagedList } from '@/features/add/AddSections';
import { errorMessage } from '@/lib/errorMessage';
import { useOnKeyboardHide } from '@/lib/useOnKeyboardHide';
import { withPressed } from '@/lib/pressed';
import { getSplitParts, saveSplit, deleteSplit, restoreSplit } from '@/db/splits';
import {
  DraftPart,
  seedParts,
  draftFromSaved,
  splitProblem,
  splitProblemText,
  toSplitParts,
} from '@/features/add/splitDraft';
import { openSplitSession, takeSplitResult } from '@/features/add/splitSession';
import { SplitCard } from '@/features/add/SplitCard';
import { formatTyped, persistStaged, stagedTotals } from '@/features/add/saveEntry';
import { showAlert } from '@/components/AppDialog';
import { useUndoToast } from '@/components/UndoToast';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { spendableAccountsOf } from '@/lib/account';

/** How many "Your usual" chips Add shows. */
const USUAL_COUNT = 4;

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const { show: showUndo } = useUndoToast();
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

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const [type, setType] = useState<EntryType>(isTxType(params.type) ? params.type : 'expense');
  // What's been typed on the number pad — a number, or a sum like "120+45".
  const [expr, setExpr] = useState(() => {
    const minor = Number(params.amount);
    return Number.isInteger(minor) && minor > 0 ? exprFromMinor(minor) : '';
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => toLocalIsoDate(new Date()));

  // Friend mode
  const [personId, setPersonId] = useState<string | null>(null);
  const [friendSign, setFriendSign] = useState<1 | -1>(1);
  const [friendAccountId, setFriendAccountId] = useState<string | null>(null);

  const [rows, setRows] = useState<Staged[]>([]);
  // "Money back" on the Expense tab: this entry is a refund.
  const [refund, setRefund] = useState(params.refund === '1');
  // Split mode: this payment spread across categories (null when it isn't split).
  // The parts are made on the split page (app/split.tsx) and come back here on Done.
  const [splitParts, setSplitParts] = useState<DraftPart[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frequentAmounts, setFrequentAmounts] = useState<number[]>([]);
  const [usual, setUsual] = useState<RepeatEntry[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // The pad is up straight away for a new entry (amount comes first); an edit opens without it since often
  // only the category/date changes — tapping the amount raises it.
  const [padOpen, setPadOpen] = useState(!editingId);
  const [noteEditing, setNoteEditing] = useState(false);
  // Closing the keyboard (back gesture or down key) ends typing in category search/note, so the pad
  // returns; Android leaves the field focused otherwise and the pad stayed hidden.
  useOnKeyboardHide(() => {
    setSearchFocused(false);
    setNoteEditing(false);
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [addPersonVisible, setAddPersonVisible] = useState(false);
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  // A repeat warning names the entry it's about; tapping Save again with
  // that same entry saves it anyway. Any change to the entry clears it.
  const [repeatWarning, setRepeatWarning] = useState<{ key: string; message: string } | null>(null);

  // What each entry type was last saved with (see AddDefaults) — loaded once
  // for a new entry, never for an edit, which always shows the entry's own values.
  const addDefaults = useRef<AddDefaults>({});
  // Once you pick an account yourself, picking a category stops choosing one for you.
  const accountPickedByHand = useRef(false);

  const listFade = useFadeIn();

  const amountValue = evaluateAmount(expr);
  const amountMinor = amountValue === null ? 0 : toMinor(amountValue);

  // Only expense/income have a "usual amount for this category"; transfers and friend entries (keyed to a
  // person) don't. Re-fetches on every categoryId change, which is exactly when it differs.
  useEffect(() => {
    if ((type !== 'expense' && type !== 'income') || !categoryId) {
      setFrequentAmounts([]);
      return;
    }
    let cancelled = false;
    getFrequentAmountsForCategory(categoryId).then((amounts) => {
      if (!cancelled) setFrequentAmounts(amounts);
    });
    return () => {
      cancelled = true;
    };
  }, [type, categoryId]);

  // "Your usual": the entries of this type logged most in the last 90 days
  // (category, amount and account together), one tap each. New entries only.
  useEffect(() => {
    if (editingId || (type !== 'expense' && type !== 'income')) {
      setUsual([]);
      return;
    }
    let cancelled = false;
    getRepeatEntries(USUAL_COUNT, toLocalIsoDate(new Date()), type)
      .then((entries) => {
        if (!cancelled) setUsual(entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, editingId]);

  // A new entry's account follows its category (the account that category was last used with) until you
  // pick an account yourself.
  useEffect(() => {
    if (editingId || accountPickedByHand.current || !categoryId) return;
    if (type !== 'expense' && type !== 'income') return;
    let cancelled = false;
    getLastAccountForCategory(categoryId)
      .then((id) => {
        if (cancelled || !id) return;
        if (accounts.some((a) => a.id === id && a.type !== 'savings')) setAccountId(id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [categoryId, type, accounts, editingId]);

  /**
   * Pre-selects the account this entry type was last saved with, skipping one that no longer fits (gone, or
   * savings for expense/income) for the first spendable one. The category always starts empty.
   */
  const applyDefaults = useCallback((t: EntryType, accs: Account[]) => {
    if (t === 'friend') return;
    const d = addDefaults.current;
    if (t === 'transfer') {
      const td = d.transfer;
      if (td && accs.some((a) => a.id === td.accountId)) setAccountId(td.accountId);
      if (td?.toAccountId && accs.some((a) => a.id === td.toAccountId)) setToAccountId(td.toAccountId);
      return;
    }
    const td = d[t];
    if (td && accs.some((a) => a.id === td.accountId && a.type !== 'savings')) setAccountId(td.accountId);
    setCategoryId(null);
  }, []);

  const load = useCallback(async () => {
    const [accs, cats, ppl] = await Promise.all([listAccounts(), listCategories(), listPeople()]);
    setAccounts(accs);
    setCategories(cats);
    setPeople(ppl);

    if (editingId && !seeded) {
      const [tx, link] = await Promise.all([getTransactionById(editingId), getTransactionLink(editingId)]);
      if (tx) {
        setEditing(tx);
        setIsLinked(link !== null);
        // A refund is stored as money in, but it's edited where it was made: the Expense tab.
        setType(tx.isRefund ? 'expense' : tx.type);
        setRefund(tx.isRefund);
        setExpr(exprFromMinor(tx.amountMinor));
        setAccountId(tx.accountId);
        setToAccountId(tx.toAccountId);
        setCategoryId(tx.categoryId);
        setNote(tx.note);
        setDate(tx.date);
        // Editing any part of a split edits the whole payment.
        if (tx.splitId) {
          const parts = await getSplitParts(tx.splitId);
          setSplitParts(
            draftFromSaved(parts.map((p) => ({ categoryId: p.categoryId!, amountMinor: p.amountMinor })))
          );
          setExpr(exprFromMinor(parts.reduce((sum, p) => sum + p.amountMinor, 0)));
        }
      }
    } else if (!editingId && !seeded) {
      addDefaults.current = await getAddDefaults().catch(() => ({}));
      const startType = isTxType(initialType) ? initialType : 'expense';
      applyDefaults(startType, accs);
      // Wins over the remembered default — but only if it can actually take
      // this entry (a savings account can only be a transfer's "from").
      if (refundParam === '1') {
        if (categoryParam && cats.some((c) => c.id === categoryParam && c.kind === 'expense')) {
          setCategoryId(categoryParam);
        }
      }
      // A refund's note, or one typed into the daily reminder's "Type it in".
      if (noteParam) setNote(noteParam);
      // A Quick Add widget shortcut opens with its category already picked.
      if (
        refundParam !== '1' &&
        categoryParam &&
        cats.some((c) => c.id === categoryParam && c.kind === startType && !c.archived)
      ) {
        setCategoryId(categoryParam);
      }
      const asked = initialAccountId ? accs.find((a) => a.id === initialAccountId) : undefined;
      if (asked && (startType === 'transfer' || asked.type !== 'savings')) {
        setAccountId(asked.id);
        accountPickedByHand.current = true;
      }
      const askedTo = initialToAccountId ? accs.find((a) => a.id === initialToAccountId) : undefined;
      if (askedTo && startType === 'transfer') {
        setToAccountId(askedTo.id);
        // Moving money into an account can't come from that same account.
        setAccountId((from) =>
          from && from !== askedTo.id
            ? from
            : (accs.find((a) => a.id !== askedTo.id && !a.archived && a.type !== 'savings')?.id ?? from)
        );
      }
    }
    setSeeded(true);
  }, [
    editingId,
    seeded,
    initialType,
    initialAccountId,
    initialToAccountId,
    refundParam,
    categoryParam,
    noteParam,
    applyDefaults,
  ]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Back from the split page with Done: the entry is split that way now.
      const split = takeSplitResult();
      if (split) {
        setSplitParts(split);
        setError(null);
        // The total is set; the split card is what's worth seeing now.
        setPadOpen(false);
      }
    }, [load])
  );

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  // Savings accounts aren't directly spendable: expense/income/friend entries offer only non-savings
  // accounts, transfers all. createTransaction (src/db/ledger.ts) enforces it too.
  const spendableAccounts = useMemo(() => spendableAccountsOf(accounts), [accounts]);
  const pickableAccounts = type === 'transfer' ? accounts : spendableAccounts;
  const effectiveAccountId =
    accountId && pickableAccounts.some((a) => a.id === accountId)
      ? accountId
      : (pickableAccounts[0]?.id ?? null);
  const effectiveAccount = accounts.find((a) => a.id === effectiveAccountId);
  const today = toLocalIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);
  // The amount's currency: the account it's going on (a friend entry's, if cash moved).
  const currency =
    (type === 'friend'
      ? accounts.find((a) => a.id === friendAccountId)?.currency
      : effectiveAccount?.currency) ?? undefined;

  // Any change to what's being entered clears a repeat warning about the old entry.
  useEffect(() => {
    setRepeatWarning(null);
  }, [expr, type, effectiveAccountId, toAccountId, categoryId, date]);

  const onTypeChange = (next: EntryType) => {
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
    accountPickedByHand.current = true;
    setAccountId(id);
  };

  const onPadKey = (key: PadKey) => {
    setError(null);
    setExpr((prev) => applyPadKey(prev, key));
  };

  /** Remembers what was just saved, per type, for the next new entry. Best-effort. */
  const rememberDefaults = (saved: Staged[]) => {
    const next: AddDefaults = { ...addDefaults.current };
    for (const r of saved) {
      if (r.kind !== 'transaction') continue;
      if (r.type === 'transfer') next.transfer = { accountId: r.accountId, toAccountId: r.toAccountId };
      else next[r.type] = { accountId: r.accountId, categoryId: r.categoryId };
    }
    addDefaults.current = next;
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
    if (!message) return false;
    haptics.warn();
    setRepeatWarning({ key, message });
    return true;
  };

  const addRow = async () => {
    setError(null);
    const res = formToStaged();
    if ('error' in res) {
      setError(res.error);
      return;
    }
    if (await warnIfRepeat(res.row)) return;
    setRows((prev) => [...prev, res.row]);
    clearForm();
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const totals = stagedTotals(rows);

  // A brief "done" checkmark (PrimaryButton `done`) before navigating back; the data is already saved, so
  // the delay is purely felt confirmation.
  const goBackAfterSave = () => {
    setSaveDone(true);
    setTimeout(() => router.back(), 320);
  };

  const onSaveSplit = async () => {
    if (!splitParts) return;
    setError(null);
    const problem = splitProblem(amountMinor, splitParts);
    if (problem) {
      const nameOf = (key: string) =>
        categories.find((c) => c.id === splitParts.find((p) => p.key === key)?.categoryId)?.name ??
        'this part';
      setError(splitProblemText(problem, splitParts, nameOf, (m) => formatMoney(m, currency)));
      return;
    }
    if (!effectiveAccountId) {
      setError('Pick an account');
      return;
    }
    setSaving(true);
    try {
      const splitId = await saveSplit({
        splitId: editing?.splitId ?? null,
        // Splitting an ordinary entry being edited: the parts take its place.
        replacesEntryId: editing && !editing.splitId ? editing.id : null,
        accountId: effectiveAccountId,
        date,
        note: note.trim(),
        parts: toSplitParts(amountMinor, splitParts),
      });
      // The lists you land back on glow the new parts, like any saved entry.
      markJustAdded((await getSplitParts(splitId)).map((p) => p.id));
      goBackAfterSave();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  /** Opens the split page with this payment: its parts so far, or its category holding all of it. */
  const openSplit = () => {
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
    router.push('/split');
  };

  const onSaveSingleEdit = async () => {
    setError(null);
    const res = formToStaged();
    if ('error' in res) {
      setError(res.error);
      return;
    }
    const r = res.row;
    if (r.kind !== 'transaction' || !editing) return;
    setSaving(true);
    try {
      await updateTransaction(editing.id, {
        type: r.type,
        accountId: r.accountId,
        toAccountId: r.toAccountId,
        categoryId: r.categoryId,
        amountMinor: r.amountMinor,
        date: r.date,
        note: r.note,
        // Turning Money back off makes it an expense again, and on makes it a refund.
        isRefund: !!r.isRefund,
      });
      markJustAdded([editing.id]);
      goBackAfterSave();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  const onSaveAll = async () => {
    setError(null);
    const pending = [...rows];
    if (expr !== '') {
      const res = formToStaged();
      if ('error' in res) {
        setError(res.error);
        return;
      }
      if (await warnIfRepeat(res.row)) return;
      pending.push(res.row);
    }
    if (pending.length === 0) {
      setError('Enter an amount');
      return;
    }

    setSaving(true);
    let saved = 0;
    const savedIds: string[] = [];
    try {
      for (const r of pending) {
        const id = await persistStaged(r, categories);
        if (id) savedIds.push(id);
        saved += 1;
      }
      // The lists you land back on glow these rows once (lib/justAdded).
      markJustAdded(savedIds);
      rememberDefaults(pending);
      goBackAfterSave();
    } catch (e) {
      // Keep only what didn't make it in, so a retry doesn't double up.
      setRows(pending.slice(saved));
      clearForm();
      setSaving(false);
      showAlert(
        'Only some entries saved',
        `${saved} of ${pending.length} saved before this went wrong: ${errorMessage(e)}`
      );
    }
  };

  const onDelete = () => {
    if (!editing) return;
    const splitId = editing.splitId;
    if (splitId) {
      const count = splitParts?.length ?? 2;
      showAlert(
        'Delete this split payment?',
        `All ${count} parts move to Recently deleted for 30 days. Account balances update right away.`,
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
                setError(errorMessage(e));
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
              setError(errorMessage(e));
            }
          },
        },
      ]
    );
  };

  /** Picks the person just added in the new-person sheet. */
  const onPersonAdded = async () => {
    setAddPersonVisible(false);
    const before = new Set(people.map((p) => p.id));
    const ppl = await listPeople();
    setPeople(ppl);
    const added = ppl.find((p) => !before.has(p.id));
    if (added) setPersonId(added.id);
  };

  const title = editing ? 'Edit transaction' : 'Add';
  const saveTitle = saving
    ? 'Saving…'
    : editing
      ? 'Save changes'
      : splitParts
        ? 'Save split'
        : refund && rows.length === 0
          ? 'Save refund'
          : repeatWarning
            ? 'Save anyway'
            : rows.length > 0
              ? `Save ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`
              : 'Save';
  const sum = hasOperator(expr);
  const shownAmount = sum
    ? amountValue === null
      ? '0'
      : formatTyped(String(amountValue))
    : formatTyped(expr);
  // The pad steps aside whenever the phone keyboard is up (a note, a category search).
  const padVisible = padOpen && !noteEditing && !searchFocused && !isLinked;

  const saveButton = (
    <PrimaryButton
      title={saveTitle}
      done={saveDone}
      onPress={splitParts ? onSaveSplit : editing ? onSaveSingleEdit : onSaveAll}
      disabled={saving || isLinked}
      style={styles.saveBtn}
    />
  );
  const addToListButton = !editing && !splitParts && (
    <Pressable
      onPress={addRow}
      style={withPressed(styles.addToList)}
      accessibilityRole="button"
      accessibilityHint="Keeps this entry on a list and starts the next one; Save saves them all"
    >
      <Feather name="plus" size={14} color={theme.colors.textPrimary} />
      <Text style={styles.addToListText}>Add to list</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        title={title}
        showBack
        right={
          editing ? (
            !isLinked ? (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete transaction"
                style={withPressed(styles.trashBtn)}
              >
                <Feather name="trash-2" size={16} color={theme.colors.expense} />
              </Pressable>
            ) : undefined
          ) : (
            <Pressable
              onPress={() => setRepeatSheetVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Repeat a recent entry"
              style={withPressed(styles.repeatBtn)}
            >
              <Feather name="rotate-ccw" size={13} color={theme.colors.textPrimary} />
              <Text style={styles.repeatBtnText}>Repeat</Text>
            </Pressable>
          )
        }
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {isLinked && (
          <SoftCard backgroundColor={theme.colors.goldTint} padding={12} style={styles.linkedNote}>
            <Text style={styles.linkedText}>
              This entry is tied to a loan or a person&rsquo;s ledger — edit it from there.
            </Text>
          </SoftCard>
        )}

        <AmountCard
          type={type}
          refund={refund}
          editing={!!editing}
          onTypeChange={onTypeChange}
          currency={currency}
          expr={expr}
          isSum={sum}
          shownAmount={shownAmount}
          padVisible={padVisible}
          isLinked={isLinked}
          onOpenPad={() => setPadOpen(true)}
          frequentAmounts={frequentAmounts}
          amountMinor={amountMinor}
          onPickAmount={(minor) => setExpr(exprFromMinor(minor))}
        />

        {repeatWarning && (
          <View style={styles.repeatNote} accessibilityLiveRegion="polite">
            <Feather name="alert-triangle" size={14} color={theme.colors.idGoldDeep} />
            <Text style={styles.repeatNoteText}>{repeatWarning.message}</Text>
          </View>
        )}

        {type === 'friend' ? (
          <FriendFields
            people={people}
            accounts={spendableAccounts}
            personId={personId}
            setPersonId={setPersonId}
            friendSign={friendSign}
            setFriendSign={setFriendSign}
            friendAccountId={friendAccountId}
            setFriendAccountId={setFriendAccountId}
            onAddPerson={() => setAddPersonVisible(true)}
          />
        ) : (
          <>
            {pickableAccounts.length === 0 && (
              // Nothing to record this against yet (previously only a "Pick an account" error on Save):
              // opens the same Add Account form Profile uses, right here.
              <SoftCard backgroundColor={theme.colors.primaryTint} padding={14} style={styles.noAccountCard}>
                <Text style={styles.noAccountTitle}>
                  {accounts.length === 0 ? 'Add your first account' : 'Add a spendable account'}
                </Text>
                <Text style={styles.noAccountText}>
                  {accounts.length === 0
                    ? 'A bank account, cash, or a UPI wallet. That is where this entry will be recorded.'
                    : 'Savings accounts can only send or receive transfers. Add a bank, cash or wallet account for spending.'}
                </Text>
                <PrimaryButton
                  title="Add an account"
                  onPress={() => setAddAccountVisible(true)}
                  style={styles.noAccountBtn}
                />
              </SoftCard>
            )}

            {type === 'transfer' ? (
              <TransferAccounts
                fromOptions={pickableAccounts}
                accounts={accounts}
                fromId={effectiveAccountId}
                toId={toAccountId}
                onPickFrom={pickAccount}
                onPickTo={setToAccountId}
              />
            ) : splitParts ? (
              <SplitCard
                parts={splitParts}
                totalMinor={amountMinor}
                categories={filteredCategories}
                currency={currency}
                onEdit={openSplit}
                onRemove={
                  editing
                    ? undefined
                    : () => {
                        setSplitParts(null);
                        setError(null);
                      }
                }
              />
            ) : (
              <View style={styles.section}>
                {usual.length > 0 && !isLinked && (
                  <UsualChips
                    usual={usual}
                    categoryId={categoryId}
                    amountMinor={amountMinor}
                    accountId={effectiveAccountId}
                    onPick={(u) => {
                      setCategoryId(u.categoryId);
                      setExpr(exprFromMinor(u.amountMinor));
                      pickAccount(u.accountId);
                    }}
                  />
                )}
                <CategoryPicker
                  categories={filteredCategories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                  variant="medal"
                  searchable
                  onSearchFocusChange={setSearchFocused}
                />
              </View>
            )}
          </>
        )}

        {rows.length > 0 && (
          <StagedList
            rows={rows}
            netMinor={totals.income - totals.expense}
            fadeStyle={listFade}
            onRemove={removeRow}
          />
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {rows.length > 0 && (
          <View style={styles.totalsRow}>
            <Totals label="In" value={totals.income} color={theme.colors.incomeText} />
            <Totals label="Out" value={totals.expense} color={theme.colors.expenseText} />
            <Totals label="Net" value={totals.income - totals.expense} color={theme.colors.textPrimary} />
          </View>
        )}
        {noteEditing ? (
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Lunch with team"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.noteInput}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => setNoteEditing(false)}
            onBlur={() => setNoteEditing(false)}
            accessibilityLabel="Note"
          />
        ) : (
          <DetailBar>
            {(type === 'expense' || type === 'income') && effectiveAccount && (
              <DetailChip
                icon="credit-card"
                label={effectiveAccount.name}
                onPress={() => setAccountSheetOpen(true)}
                accessibilityLabel={`Account, ${effectiveAccount.name}. Change`}
              />
            )}
            <DetailChip
              icon="calendar"
              label={date === today ? 'Today' : date === yesterday ? 'Yesterday' : dateChipLabel(date)}
              onPress={() => setCalendarOpen(true)}
              accessibilityLabel={`Date, ${dateChipLabel(date)}. Change`}
            />
            <DetailChip
              icon="edit-3"
              label={note.trim() || 'Note'}
              muted={!note.trim()}
              onPress={() => setNoteEditing(true)}
              accessibilityLabel={note.trim() ? `Note, ${note}. Edit` : 'Add a note'}
            />
            {/* A purchase can be money back, or one payment across several categories, but not both. */}
            {type === 'expense' && !isLinked && (
              <DetailChip
                icon="corner-up-left"
                label="Money back"
                active={refund}
                disabled={!!splitParts}
                onPress={() => {
                  setRefund((r) => !r);
                  setError(null);
                }}
                accessibilityLabel="Money back (a refund)"
              />
            )}
            {/* Not alongside a list being built: a split is saved on its own. */}
            {type === 'expense' && !isLinked && (
              <DetailChip
                icon="scissors"
                label={splitParts ? `Split · ${splitParts.length}` : 'Split'}
                active={!!splitParts}
                disabled={refund || rows.length > 0}
                onPress={openSplit}
                accessibilityLabel={
                  splitParts ? `Split into ${splitParts.length} parts. Edit` : 'Split this payment'
                }
              />
            )}
          </DetailBar>
        )}
        {padVisible ? (
          <AmountPad onKey={onPadKey} onClear={() => setExpr('')}>
            {addToListButton}
            {saveButton}
          </AmountPad>
        ) : (
          <View style={styles.actionRow}>
            {addToListButton}
            {saveButton}
          </View>
        )}
      </KeyboardStickyView>

      <ModalSheet
        visible={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        title={type === 'income' ? 'Received in' : 'Pay from'}
        scrollable={false}
      >
        <View style={styles.accountRow}>
          {pickableAccounts.map((acc) => (
            <AccountTile
              key={acc.id}
              account={acc}
              active={effectiveAccountId === acc.id}
              onPress={() => {
                pickAccount(acc.id);
                setAccountSheetOpen(false);
              }}
            />
          ))}
        </View>
      </ModalSheet>

      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          setError(null);
          await load();
        }}
      />

      <AddPersonModal
        visible={addPersonVisible}
        onClose={() => setAddPersonVisible(false)}
        onCreated={() => void onPersonAdded()}
      />

      <CalendarSheet
        visible={calendarOpen}
        value={date}
        quickPicks
        onClose={() => setCalendarOpen(false)}
        onPick={setDate}
      />

      <RepeatEntrySheet
        visible={repeatSheetVisible}
        onClose={() => setRepeatSheetVisible(false)}
        fromAdd
        onLogged={() => router.back()}
      />
    </View>
  );
}
