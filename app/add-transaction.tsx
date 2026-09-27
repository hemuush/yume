import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Alert, Animated } from 'react-native';
import { MovingRow } from '@/components/MovingRow';
import { Text, TextInput } from '@/components/Text';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import {
  listAccounts,
  listCategories,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
  getTransactionLink,
  getFrequentAmountsForCategory,
  getRepeatEntries,
  RepeatEntry,
  getLastAccountForCategory,
  findRecentRepeat,
} from '@/db/ledger';
import { getAddDefaults, setAddDefaults, AddDefaults } from '@/db/settings';
import {
  listPeople,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  addLedgerEntry,
  PersonWithBalance,
} from '@/db/people';
import { Account, Category, Transaction } from '@/types';
import { theme } from '@/constants/theme';
import { toMinor, formatMoney, getCurrencySymbol } from '@/lib/money';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { haptics } from '@/lib/haptics';
import { AppHeader } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ModalSheet } from '@/components/ModalSheet';
import { SoftCard } from '@/features/home/SoftCard';
import { CalendarSheet } from '@/components/CalendarSheet';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { AddPersonModal } from '@/features/people/AddPersonModal';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { styles } from '@/features/add/add.styles';
import {
  EntryType,
  ADD_TYPES,
  EDIT_TYPES,
  TYPE_WASH,
  Staged,
  isTxType,
  dateChipLabel,
  repeatKey,
} from '@/features/add/addEntry';
import { applyPadKey, evaluateAmount, exprFromMinor, hasOperator, PadKey } from '@/features/add/padMath';
import { AmountPad } from '@/features/add/AmountPad';
import { AccountTile, Totals, FriendFields, DetailChip } from '@/features/add/AddFields';

/** How many "Your usual" chips Add shows. */
const USUAL_COUNT = 4;

/** "1,500.5" while typing a single number: grouped whole part, decimals exactly as typed. */
function formatTyped(expr: string): string {
  if (expr === '') return '0';
  const [whole, decimals] = expr.split('.');
  const grouped = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(whole || '0'));
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  // `accountId` pre-selects the account (the "from" side of a transfer) —
  // Home's account summary sheet opens Add this way.
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    accountId?: string;
    toAccountId?: string;
  }>();
  const editingId = params.id;
  const initialType = params.type;
  const initialAccountId = params.accountId;
  // A transfer's destination, e.g. "Move money here" on a goal that follows an account.
  const initialToAccountId = params.toAccountId;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const [type, setType] = useState<EntryType>(isTxType(params.type) ? params.type : 'expense');
  // What's been typed on the number pad — a number, or a sum like "120+45".
  const [expr, setExpr] = useState('');
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
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frequentAmounts, setFrequentAmounts] = useState<number[]>([]);
  const [usual, setUsual] = useState<RepeatEntry[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  // The pad is up for a new entry straight away (the amount is what every
  // entry needs first); an edit opens without it, since it's often only the
  // category or date changing — tapping the amount brings it up.
  const [padOpen, setPadOpen] = useState(!editingId);
  const [noteEditing, setNoteEditing] = useState(false);
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

  const listFade = useFadeIn([rows.length]);

  const amountValue = evaluateAmount(expr);
  const amountMinor = amountValue === null ? 0 : toMinor(amountValue);

  // Only expense/income have a "usual amount for this category" in the
  // first place — transfers move whatever the transfer needs to move, and
  // friend entries are keyed to a person, not a category. Re-fetches on
  // every categoryId change, which is exactly when it needs to be different.
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

  // A new entry's account follows its category: the account that category
  // was last used with (Food usually goes on the same card) — until you pick
  // an account yourself.
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
   * Pre-selects what this entry type was last saved with. Anything that no
   * longer fits is skipped rather than applied: an account that's gone (or a
   * savings account for an expense/income, which can't hold one), or a
   * category that's gone, archived, or the wrong kind. Skipped values fall
   * back exactly as before this existed (first spendable account, no category).
   */
  const applyDefaults = useCallback((t: EntryType, accs: Account[], cats: Category[]) => {
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
    setCategoryId(
      td?.categoryId && cats.some((c) => c.id === td.categoryId && c.kind === t) ? td.categoryId : null
    );
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
        setType(tx.type);
        setExpr(exprFromMinor(tx.amountMinor));
        setAccountId(tx.accountId);
        setToAccountId(tx.toAccountId);
        setCategoryId(tx.categoryId);
        setNote(tx.note);
        setDate(tx.date);
      }
    } else if (!editingId && !seeded) {
      addDefaults.current = await getAddDefaults().catch(() => ({}));
      const startType = isTxType(initialType) ? initialType : 'expense';
      applyDefaults(startType, accs, cats);
      // Wins over the remembered default — but only if it can actually take
      // this entry (a savings account can only be a transfer's "from").
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
  }, [editingId, seeded, initialType, initialAccountId, initialToAccountId, applyDefaults]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  // Savings accounts aren't spendable directly — money has to be transferred
  // out to a bank/cash/wallet account first, so expense/income/friend entries
  // only offer non-savings accounts. Transfers still see every account, since
  // that's the only way money moves in or out of savings. createTransaction
  // (src/db/ledger.ts) enforces this too, so a legacy expense/income row
  // still pointing at a savings account gets reassigned to a spendable one
  // the moment it's opened for edit rather than being re-savable as-is.
  const spendableAccounts = useMemo(() => accounts.filter((a) => a.type !== 'savings'), [accounts]);
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
    // A new entry switches to what this type was last saved with; an edit
    // keeps its own values, exactly as before.
    if (!editing) applyDefaults(next, accounts, categories);
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
  const formToStaged = (): { row: Staged } | { error: string } => {
    if (amountMinor <= 0) return { error: 'Enter a valid amount' };
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (type === 'friend') {
      if (!personId) return { error: 'Pick a person' };
      const person = people.find((p) => p.id === personId);
      const acc = friendAccountId ? accounts.find((a) => a.id === friendAccountId) : null;
      return {
        row: {
          id,
          kind: 'friend',
          personId,
          personName: person?.name ?? '—',
          sign: friendSign,
          accountId: friendAccountId,
          accountName: acc?.name ?? null,
          amountMinor,
          date,
          note,
        },
      };
    }

    if (!effectiveAccountId) return { error: 'Pick an account' };
    if (type !== 'transfer' && !categoryId) return { error: 'Pick a category' };
    if (type === 'transfer' && (!toAccountId || toAccountId === effectiveAccountId)) {
      return { error: 'Pick a different destination account' };
    }
    if (type === 'transfer') {
      // Same rule createTransaction enforces — caught here so it shows as a
      // form error instead of a half-saved batch.
      const fromCurrency = accounts.find((a) => a.id === effectiveAccountId)?.currency;
      const toCurrency = accounts.find((a) => a.id === toAccountId)?.currency;
      if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
        return { error: `These accounts use different currencies (${fromCurrency} and ${toCurrency})` };
      }
    }
    const cat = categories.find((c) => c.id === categoryId);
    return {
      row: {
        id,
        kind: 'transaction',
        type,
        accountId: effectiveAccountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId,
        label: type === 'transfer' ? 'Transfer' : (cat?.name ?? '—'),
        categoryIcon: type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag'),
        categoryColor: type === 'transfer' ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted),
        amountMinor,
        date,
        note,
      },
    };
  };

  /**
   * True (and shows a note) when `row` looks like one already saved in the
   * last 30 minutes or already on the list below — the first Save only
   * warns. Tapping Save again for the same entry goes ahead. Friend entries
   * and edits aren't checked.
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

  const totals = rows.reduce(
    (acc, r) => {
      if (r.kind === 'transaction') {
        if (r.type === 'income') acc.income += r.amountMinor;
        if (r.type === 'expense') acc.expense += r.amountMinor;
      } else if (r.accountId) {
        if (r.sign === -1) acc.income += r.amountMinor;
        else acc.expense += r.amountMinor;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const persistRow = async (r: Staged) => {
    if (r.kind === 'friend') {
      if (r.accountId) {
        const category =
          r.sign === 1
            ? (categories.find((c) => c.kind === 'expense' && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'expense' && c.name === 'Miscellaneous') ??
              categories.find((c) => c.kind === 'expense'))
            : (categories.find((c) => c.kind === 'income' && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'income' && c.name === 'Other Income') ??
              categories.find((c) => c.kind === 'income'));
        if (!category) throw new Error('No category available for this friend entry');
        const payload = {
          personId: r.personId,
          accountId: r.accountId,
          categoryId: category.id,
          amountMinor: r.amountMinor,
          date: r.date,
          note: r.note,
        };
        if (r.sign === 1) await recordMoneyGivenToPerson(payload);
        else await recordMoneyReceivedFromPerson(payload);
      } else {
        await addLedgerEntry({
          personId: r.personId,
          amountMinor: r.amountMinor * r.sign,
          date: r.date,
          note: r.note,
        });
      }
      return;
    }
    await createTransaction({
      type: r.type,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      categoryId: r.categoryId,
      amountMinor: r.amountMinor,
      date: r.date,
      note: r.note,
    });
  };

  // A brief "done" checkmark (PrimaryButton's own `done` prop) before
  // navigating back, instead of the screen vanishing the instant the write
  // finishes — the data is already saved by this point, so the short delay
  // is purely a felt confirmation.
  const goBackAfterSave = () => {
    setSaveDone(true);
    setTimeout(() => router.back(), 320);
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
      });
      goBackAfterSave();
    } catch (e: any) {
      setError(String(e?.message ?? e));
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
    try {
      for (const r of pending) {
        await persistRow(r);
        saved += 1;
      }
      rememberDefaults(pending);
      goBackAfterSave();
    } catch (e: any) {
      // Keep only what didn't make it in, so a retry doesn't double up.
      setRows(pending.slice(saved));
      clearForm();
      setSaving(false);
      Alert.alert(
        'Only some entries saved',
        `${saved} of ${pending.length} saved before this went wrong: ${String(e?.message ?? e)}`
      );
    }
  };

  const onDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete this transaction?',
      'This removes it permanently — account balances update immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(editing.id);
              router.back();
            } catch (e: any) {
              setError(String(e?.message ?? e));
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

  const wash = TYPE_WASH[type];
  const title = editing ? 'Edit Transaction' : 'Add';
  const saveTitle = saving
    ? 'Saving…'
    : editing
      ? 'Save changes'
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
      onPress={editing ? onSaveSingleEdit : onSaveAll}
      disabled={saving || isLinked}
      style={styles.saveBtn}
    />
  );
  const addToListButton = !editing && (
    <Pressable
      onPress={addRow}
      style={styles.addToList}
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
                style={styles.trashBtn}
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
              style={styles.repeatBtn}
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

        <SoftCard backgroundColor={wash.bg} padding={16} style={styles.heroCard}>
          <SegmentedControl options={editing ? EDIT_TYPES : ADD_TYPES} value={type} onChange={onTypeChange} />

          <Text style={[styles.heroLabel, { color: wash.accent }]}>
            {type === 'friend' ? 'Amount' : `${type[0].toUpperCase()}${type.slice(1)} amount`}
          </Text>
          <Pressable
            onPress={() => setPadOpen(true)}
            disabled={isLinked}
            style={styles.amountRow}
            accessibilityRole="button"
            accessibilityLabel={`Amount, ${expr === '' ? 'empty' : shownAmount}`}
            accessibilityHint={padVisible ? undefined : 'Opens the number pad'}
          >
            <Text style={[styles.amountCurrency, { color: wash.accent }]}>{getCurrencySymbol(currency)}</Text>
            <Text
              style={[styles.amountText, expr === '' && styles.amountPlaceholder]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {shownAmount}
            </Text>
            {padVisible && <View style={styles.caret} />}
          </Pressable>
          {sum && <Text style={styles.expression}>{expr.replace(/([+−×÷])/g, ' $1 ')}</Text>}

          {frequentAmounts.length > 0 && (
            <View style={styles.frequentRow}>
              {frequentAmounts.map((minor) => {
                const active = amountMinor === minor;
                return (
                  <Pressable
                    key={minor}
                    onPress={() => {
                      haptics.tap();
                      setExpr(exprFromMinor(minor));
                    }}
                    style={[styles.frequentChip, active && styles.frequentChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.frequentChipText, active && styles.frequentChipTextActive]}>
                      {formatMoney(minor, currency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SoftCard>

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
              // Nothing to record this against yet — used to surface only as a
              // "Pick an account" error on Save. Opens the same Add Account form
              // Profile uses, right here.
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
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>From</Text>
                  <View style={styles.accountRow}>
                    {pickableAccounts.map((acc) => (
                      <AccountTile
                        key={acc.id}
                        account={acc}
                        active={effectiveAccountId === acc.id}
                        onPress={() => pickAccount(acc.id)}
                      />
                    ))}
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.label}>To</Text>
                  <View style={styles.accountRow}>
                    {accounts
                      .filter((a) => a.id !== effectiveAccountId)
                      .map((acc) => (
                        <AccountTile
                          key={acc.id}
                          account={acc}
                          active={toAccountId === acc.id}
                          onPress={() => setToAccountId(acc.id)}
                        />
                      ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.section}>
                {usual.length > 0 && !isLinked && (
                  <>
                    <Text style={styles.label}>Your usual</Text>
                    <View style={styles.recentRow}>
                      {usual.map((u) => {
                        const active =
                          categoryId === u.categoryId &&
                          amountMinor === u.amountMinor &&
                          effectiveAccountId === u.accountId;
                        return (
                          <Pressable
                            key={`${u.categoryId}:${u.amountMinor}:${u.accountId}`}
                            onPress={() => {
                              haptics.tap();
                              setCategoryId(u.categoryId);
                              setExpr(exprFromMinor(u.amountMinor));
                              pickAccount(u.accountId);
                            }}
                            style={[styles.recentChip, active && styles.recentChipActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${u.categoryName}, ${formatMoney(u.amountMinor, u.accountCurrency)}, logged ${u.timesLogged} times`}
                          >
                            <CategoryIcon
                              name={u.categoryIcon}
                              color={u.categoryColor}
                              size={11}
                              square={20}
                            />
                            <Text style={styles.recentChipText} numberOfLines={1}>
                              {u.categoryName} ·
                            </Text>
                            <Text style={styles.recentChipAmount}>
                              {formatMoney(u.amountMinor, u.accountCurrency)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
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

        <View style={styles.detailRow}>
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
        </View>
        {noteEditing && (
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
        )}

        {rows.length > 0 && (
          <Animated.View style={[styles.staged, listFade]}>
            <View style={styles.stagedHeadRow}>
              <Text style={styles.stagedHead}>{rows.length} staged</Text>
              <Text style={styles.stagedHeadTotal}>
                {totals.income - totals.expense >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(totals.income - totals.expense))}
              </Text>
            </View>
            {rows.map((r, i) => {
              const incomeLike = r.kind === 'transaction' ? r.type === 'income' : r.sign === -1;
              const expenseLike = r.kind === 'transaction' ? r.type === 'expense' : r.sign === 1;
              return (
                <MovingRow key={r.id} style={[styles.stagedRow, i > 0 && styles.stagedRowDivider]}>
                  <CategoryIcon
                    name={r.kind === 'transaction' ? r.categoryIcon : 'account-multiple'}
                    color={r.kind === 'transaction' ? r.categoryColor : theme.colors.secondary}
                    size={15}
                    square={30}
                  />
                  <View style={styles.stagedMid}>
                    <Text style={styles.stagedLabel} numberOfLines={1}>
                      {r.kind === 'transaction'
                        ? r.label
                        : `${r.personName} ${r.sign === 1 ? 'owes more' : 'repaid'}`}
                      {!!r.note && <Text style={styles.stagedNote}> · {r.note}</Text>}
                    </Text>
                    <Text style={styles.stagedSub}>
                      {dateChipLabel(r.date)}
                      {r.kind === 'friend' ? ` · ${r.accountName ?? 'balance only'}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[styles.stagedValue, incomeLike && styles.income, expenseLike && styles.expense]}
                  >
                    {incomeLike ? '+' : expenseLike ? '−' : ''}
                    {formatMoney(r.amountMinor)}
                  </Text>
                  <Pressable
                    onPress={() => removeRow(r.id)}
                    hitSlop={14}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this entry from the list"
                  >
                    <Feather name="x" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                </MovingRow>
              );
            })}
          </Animated.View>
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {rows.length > 0 && (
          <View style={styles.totalsRow}>
            <Totals label="In" value={totals.income} color={theme.colors.income} />
            <Totals label="Out" value={totals.expense} color={theme.colors.expense} />
            <Totals label="Net" value={totals.income - totals.expense} color={theme.colors.textPrimary} />
          </View>
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
        title="Account"
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
