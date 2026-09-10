import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, Animated } from 'react-native';
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
} from '@/db/ledger';
import {
  listPeople,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  addLedgerEntry,
  PersonWithBalance,
} from '@/db/people';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { theme } from '@/constants/theme';
import { toMinor, formatMoney } from '@/lib/money';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { AppHeader } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SoftCard } from '@/features/home/SoftCard';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';

type EntryType = TransactionType | 'friend';

const ADD_TYPES: { label: string; value: EntryType }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Friend', value: 'friend' },
];
const EDIT_TYPES = ADD_TYPES.slice(0, 3);

interface StagedTx {
  id: string;
  kind: 'transaction';
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  label: string;
  categoryIcon: string;
  categoryColor: string;
  amountMinor: number;
  date: string;
  note: string;
}
interface StagedFriend {
  id: string;
  kind: 'friend';
  personId: string;
  personName: string;
  sign: 1 | -1;
  accountId: string | null;
  accountName: string | null;
  amountMinor: number;
  date: string;
  note: string;
}
type Staged = StagedTx | StagedFriend;

function isTxType(v: string | undefined): v is TransactionType {
  return v === 'expense' || v === 'income' || v === 'transfer';
}

function dateChipLabel(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const editingId = params.id;

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
  const [error, setError] = useState<string | null>(null);

  const listFade = useFadeIn([rows.length]);

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
    }
    setSeeded(true);
  }, [editingId, seeded]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null;
  const today = toLocalIsoDate(new Date());
  const yesterday = addDaysToIsoDate(today, -1);

  const onTypeChange = (next: EntryType) => {
    setType(next);
    setCategoryId(null);
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
      router.back();
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
      router.back();
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
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
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
    ]);
  };

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

        <View style={styles.section}>
          <SegmentedControl options={editing ? EDIT_TYPES : ADD_TYPES} value={type} onChange={onTypeChange} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.amountInput}
            />
          </View>
        </View>

        {type === 'friend' ? (
          <FriendFields
            people={people}
            accounts={accounts}
            personId={personId}
            setPersonId={setPersonId}
            friendSign={friendSign}
            setFriendSign={setFriendSign}
            friendAccountId={friendAccountId}
            setFriendAccountId={setFriendAccountId}
          />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>{type === 'transfer' ? 'From' : 'Account'}</Text>
              <View style={styles.chipRow}>
                {accounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    active={effectiveAccountId === acc.id}
                    onPress={() => setAccountId(acc.id)}
                  />
                ))}
              </View>
            </View>

            {type === 'transfer' && (
              <View style={styles.section}>
                <Text style={styles.label}>To</Text>
                <View style={styles.chipRow}>
                  {accounts
                    .filter((a) => a.id !== effectiveAccountId)
                    .map((acc) => (
                      <Chip
                        key={acc.id}
                        label={acc.name}
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
            <Text style={styles.stagedHead}>{rows.length} staged</Text>
            {rows.map((r) => {
              const incomeLike = r.kind === 'transaction' ? r.type === 'income' : r.sign === -1;
              const expenseLike = r.kind === 'transaction' ? r.type === 'expense' : r.sign === 1;
              return (
                <View key={r.id} style={styles.stagedRow}>
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
                  <Pressable onPress={() => removeRow(r.id)} hitSlop={10} style={styles.removeBtn}>
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
          onPress={editing ? onSaveSingleEdit : onSaveAll}
          disabled={saving || isLinked}
        />
      </KeyboardStickyView>

      <CalendarSheet
        visible={calendarOpen}
        value={date}
        onClose={() => setCalendarOpen(false)}
        onPick={setDate}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function Totals({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, { color }]}>{formatMoney(value)}</Text>
    </View>
  );
}

function FriendFields({
  people,
  accounts,
  personId,
  setPersonId,
  friendSign,
  setFriendSign,
  friendAccountId,
  setFriendAccountId,
}: {
  people: PersonWithBalance[];
  accounts: Account[];
  personId: string | null;
  setPersonId: (id: string) => void;
  friendSign: 1 | -1;
  setFriendSign: (s: 1 | -1) => void;
  friendAccountId: string | null;
  setFriendAccountId: (id: string | null) => void;
}) {
  if (people.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.hint}>Add a person in Borrowed &amp; Lent → Friends &amp; Family first.</Text>
      </View>
    );
  }
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>Person</Text>
        <View style={styles.chipRow}>
          {people.map((p) => (
            <Chip key={p.id} label={p.name} active={personId === p.id} onPress={() => setPersonId(p.id)} />
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>What happened?</Text>
        <SegmentedControl
          options={[
            { label: 'They owe more', value: 'owe' },
            { label: 'They repaid', value: 'repaid' },
          ]}
          value={friendSign === 1 ? 'owe' : 'repaid'}
          onChange={(v) => setFriendSign(v === 'owe' ? 1 : -1)}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Did cash actually move?</Text>
        <View style={styles.chipRow}>
          <Chip
            label="Just adjust balance"
            active={friendAccountId === null}
            onPress={() => setFriendAccountId(null)}
          />
          {accounts.map((acc) => (
            <Chip
              key={acc.id}
              label={acc.name}
              active={friendAccountId === acc.id}
              onPress={() => setFriendAccountId(acc.id)}
            />
          ))}
        </View>
        <Text style={styles.hint}>
          {friendAccountId
            ? 'Records a real transaction on that account too, so it shows in Transactions and Reports.'
            : 'Only updates the balance — no real transaction, so it won’t appear in Transactions or Reports.'}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  section: { marginBottom: 18 },
  label: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  hint: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    lineHeight: 16,
    marginTop: 8,
  },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
  },
  amountCurrency: { fontFamily: theme.font.monoBold, fontSize: 22, color: theme.colors.textMuted },
  amountInput: {
    flex: 1,
    fontFamily: theme.font.monoBold,
    fontSize: 24,
    color: theme.colors.textPrimary,
    paddingVertical: 14,
  },
  noteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: theme.font.body,
    color: theme.colors.textPrimary,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  chipActive: { borderColor: theme.colors.secondary, backgroundColor: theme.colors.secondaryTint },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },

  addToList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.secondary,
    borderRadius: 13,
    paddingVertical: 12,
    marginTop: 2,
  },
  addToListText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textPrimary },

  staged: { marginTop: 18 },
  stagedHead: {
    fontFamily: theme.font.roundedBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  stagedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 7,
  },
  stagedMid: { flex: 1, minWidth: 0 },
  stagedLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textPrimary },
  stagedNote: { fontFamily: theme.font.body, color: theme.colors.textMuted },
  stagedSub: { fontFamily: theme.font.body, fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },
  stagedValue: { fontFamily: theme.font.monoBold, fontSize: 11.5, color: theme.colors.textPrimary },
  removeBtn: { padding: 2 },

  linkedNote: { marginBottom: 16 },
  linkedText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textPrimary, lineHeight: 17 },

  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  total: { alignItems: 'center' },
  totalLabel: {
    fontFamily: theme.font.mono,
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  totalValue: { fontFamily: theme.font.monoBold, fontSize: 12, marginTop: 2 },
  error: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.expense,
    textAlign: 'center',
    marginBottom: 8,
  },
  income: { color: theme.colors.income },
  expense: { color: theme.colors.expense },
});
