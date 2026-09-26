import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Alert, Animated } from 'react-native';
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
  getRecentCategoryIds,
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
import { toMinor, formatMoney } from '@/lib/money';
import { toLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { AppHeader } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SoftCard } from '@/features/home/SoftCard';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { styles } from '@/features/add/add.styles';
import {
  EntryType,
  ADD_TYPES,
  EDIT_TYPES,
  TYPE_WASH,
  Staged,
  isTxType,
  dateChipLabel,
} from '@/features/add/addEntry';
import { Chip, AccountTile, Totals, FriendFields } from '@/features/add/AddFields';

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const editingId = params.id;
  const initialType = params.type;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const [type, setType] = useState<EntryType>(isTxType(params.type) ? params.type : 'expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => toLocalIsoDate(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Friend mode
  const [personId, setPersonId] = useState<string | null>(null);
  const [friendSign, setFriendSign] = useState<1 | -1>(1);
  const [friendAccountId, setFriendAccountId] = useState<string | null>(null);

  const [rows, setRows] = useState<Staged[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frequentAmounts, setFrequentAmounts] = useState<number[]>([]);
  const [recentCategoryIds, setRecentCategoryIds] = useState<string[]>([]);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  // What each entry type was last saved with (see AddDefaults) — loaded once
  // for a new entry, never for an edit, which always shows the entry's own values.
  const addDefaults = useRef<AddDefaults>({});

  const listFade = useFadeIn([rows.length]);

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

  // The user's most-used categories of the current kind, for the one-tap
  // "Recent" row. Expense/income only, same as frequent amounts above.
  useEffect(() => {
    if (type !== 'expense' && type !== 'income') {
      setRecentCategoryIds([]);
      return;
    }
    let cancelled = false;
    getRecentCategoryIds(type)
      .then((ids) => {
        if (!cancelled) setRecentCategoryIds(ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type]);

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
        setAmount((tx.amountMinor / 100).toString());
        setAccountId(tx.accountId);
        setToAccountId(tx.toAccountId);
        setCategoryId(tx.categoryId);
        setNote(tx.note);
        setDate(tx.date);
      }
    } else if (!editingId && !seeded) {
      addDefaults.current = await getAddDefaults().catch(() => ({}));
      applyDefaults(isTxType(initialType) ? initialType : 'expense', accs, cats);
    }
    setSeeded(true);
  }, [editingId, seeded, initialType, applyDefaults]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Only ids that still resolve to a category of the current kind (the
  // list below is already non-archived), in most-used order.
  const recentCategories = useMemo(
    () =>
      recentCategoryIds
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is Category => !!c && c.kind === (type === 'income' ? 'income' : 'expense')),
    [recentCategoryIds, categories, type]
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
  const today = toLocalIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);

  const onTypeChange = (next: EntryType) => {
    setType(next);
    setCategoryId(null);
    // A new entry switches to what this type was last saved with; an edit
    // keeps its own values, exactly as before.
    if (!editing) applyDefaults(next, accounts, categories);
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
    setAmount('');
    setNote('');
  };

  /** Validate the current form into a staged row, or return an error string. */
  const formToStaged = (): { row: Staged } | { error: string } => {
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) return { error: 'Enter a valid amount' };
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

  const addRow = () => {
    setError(null);
    const res = formToStaged();
    if ('error' in res) {
      setError(res.error);
      return;
    }
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
    if (amount.trim() !== '') {
      const res = formToStaged();
      if ('error' in res) {
        setError(res.error);
        return;
      }
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

  const wash = TYPE_WASH[type];
  const title = editing ? 'Edit Transaction' : 'Add';
  const saveTitle = saving
    ? 'Saving…'
    : editing
      ? 'Save changes'
      : rows.length > 0
        ? `Save ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`
        : 'Save';

  return (
    <View style={styles.container}>
      <AppHeader
        title={title}
        showBack
        right={
          editing && !isLinked ? (
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
        }
      />

      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 150 + insets.bottom }}
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
          <View style={styles.amountRow}>
            <Text style={[styles.amountCurrency, { color: wash.accent }]}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.amountInput}
              // A new entry starts typing straight away — the amount is
              // what every entry needs first. An edit opens without the
              // keyboard, since it's often only the category or date changing.
              autoFocus={!editingId}
              accessibilityLabel="Amount"
            />
          </View>

          {recentCategories.length > 0 && !isLinked && (
            <View style={styles.recentRow}>
              {recentCategories.map((cat) => {
                const active = categoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    style={[styles.recentChip, active && styles.recentChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Category ${cat.name}`}
                  >
                    <CategoryIcon name={cat.icon} color={cat.color} size={11} square={20} />
                    <Text style={styles.recentChipText} numberOfLines={1}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {frequentAmounts.length > 0 && (
            <View style={styles.frequentRow}>
              {frequentAmounts.map((amountMinor) => {
                // Compares parsed numeric minor units, not raw strings — a
                // string compare ("150.5" vs a user-typed "150.50") missed
                // the match for any amount with a non-canonical decimal form.
                const active = amount.trim() !== '' && toMinor(parseFloat(amount)) === amountMinor;
                return (
                  <Pressable
                    key={amountMinor}
                    onPress={() => setAmount((amountMinor / 100).toString())}
                    style={[styles.frequentChip, active && styles.frequentChipActive]}
                  >
                    <Text style={[styles.frequentChipText, active && styles.frequentChipTextActive]}>
                      {formatMoney(amountMinor)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </SoftCard>

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
            <View style={styles.section}>
              <Text style={styles.label}>{type === 'transfer' ? 'From' : 'Account'}</Text>
              <View style={styles.accountRow}>
                {pickableAccounts.map((acc) => (
                  <AccountTile
                    key={acc.id}
                    account={acc}
                    active={effectiveAccountId === acc.id}
                    onPress={() => setAccountId(acc.id)}
                  />
                ))}
              </View>
            </View>

            {type === 'transfer' && (
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
            )}

            {type !== 'transfer' && (
              <View style={styles.section}>
                <Text style={styles.label}>Category</Text>
                <CategoryPicker
                  categories={filteredCategories}
                  selectedId={categoryId}
                  onSelect={setCategoryId}
                  variant="medal"
                />
              </View>
            )}
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <View style={styles.chipRow}>
            <Chip label="Today" active={date === today} onPress={() => setDate(today)} />
            <Chip label="Yesterday" active={date === yesterday} onPress={() => setDate(yesterday)} />
            <Pressable
              onPress={() => setCalendarOpen(true)}
              style={[styles.chip, date !== today && date !== yesterday && styles.chipActive]}
            >
              <Feather name="calendar" size={12} color={theme.colors.ink} />
              <Text style={styles.chipText}> {dateChipLabel(date)} </Text>
              <Feather name="chevron-down" size={12} color={theme.colors.ink} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Lunch with team"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.noteInput}
          />
        </View>

        {!editing && (
          <Pressable onPress={addRow} style={styles.addToList}>
            <Feather name="plus" size={14} color={theme.colors.textPrimary} />
            <Text style={styles.addToListText}>Add to list</Text>
          </Pressable>
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
                <View key={r.id} style={[styles.stagedRow, i > 0 && styles.stagedRowDivider]}>
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
                    hitSlop={10}
                    style={styles.removeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this entry from the list"
                  >
                    <Feather name="x" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
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
        <PrimaryButton
          title={saveTitle}
          done={saveDone}
          onPress={editing ? onSaveSingleEdit : onSaveAll}
          disabled={saving || isLinked}
        />
      </KeyboardStickyView>

      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          setError(null);
          await load();
        }}
      />

      <CalendarSheet
        visible={calendarOpen}
        value={date}
        onClose={() => setCalendarOpen(false)}
        onPick={setDate}
      />
    </View>
  );
}
