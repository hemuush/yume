import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listCategories, createTransaction } from '@/db/ledger';
import {
  listPeople,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  addLedgerEntry,
  PersonWithBalance,
} from '@/db/people';
import { Account, Category, TransactionType } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Chip } from '@/components/Chip';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { theme } from '@/constants/theme';
import { formatMoney, toMinor } from '@/lib/money';
import { partsToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { CategoryPicker } from '@/components/CategoryPicker';
import { styles } from '@/features/add-historical/addHistorical.styles';

type EntryMode = TransactionType | 'friend';

const TX_TYPES: { label: string; value: EntryMode }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
  { label: 'Friend', value: 'friend' },
];

interface TransactionPendingRow {
  id: string;
  kind: 'transaction';
  type: TransactionType;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  categoryName: string;
  amountMinor: number;
  // Captured at the moment the row is added, not read from `selectedMonth`
  // at save time — otherwise switching the month chip after staging rows
  // (e.g. to start entering a different month before hitting Save) would
  // silently re-date every already-staged row to the newly selected month.
  month: number;
  year: number;
  day: number;
  note: string;
}

/**
 * A friend/family IOU entry, backfilled with a real historical date — the
 * live Friends & Family screen can only record "today", so this is the only
 * way to catch up on an old borrowed/lent transaction. Mirrors
 * PersonDetailModal's own record() in src/features/PeopleSection.tsx: an
 * account picked means real cash moved (a real expense/income transaction is
 * created alongside the ledger entry); "Just adjust balance" records a
 * bookkeeping-only ledger entry with no linked transaction.
 */
interface FriendPendingRow {
  id: string;
  kind: 'friend';
  personId: string;
  personName: string;
  sign: 1 | -1; // 1 = they owe more, -1 = they repaid
  accountId: string | null;
  accountName: string | null;
  amountMinor: number;
  month: number;
  year: number;
  day: number;
  note: string;
}

type PendingRow = TransactionPendingRow | FriendPendingRow;

/** The last 24 months, most recent first, as { label, month (1-12), year } — a fast way to pick "which month am I backfilling" without typing digits. */
function recentMonths(count: number): { label: string; month: number; year: number }[] {
  const out: { label: string; month: number; year: number }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({
      label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }
  return out;
}

/**
 * Backfilling a whole past month one transaction-at-a-time (each picking its
 * own day, account, category, amount) is exactly what makes catching up on
 * old data feel like a chore. This screen fixes the month once, then lets
 * entries pile up in a lightweight list with a running income/expense/net
 * total always visible — the "checkpoint" that lets you catch a typo before
 * anything is actually written — and only commits everything to the real
 * ledger (via the same createTransaction() every other screen uses, so
 * Reports/Home/trends see these exactly like any other transaction) when you
 * tap Save. The day-of-month defaults to the 1st rather than forcing you to
 * know the exact day for every old entry, but stays editable per row for
 * anyone who does know it.
 */
export default function AddHistoricalScreen() {
  const insets = useSafeAreaInsets();
  const months = useMemo(() => recentMonths(24), []);
  const [selectedMonth, setSelectedMonth] = useState(months[1] ?? months[0]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<EntryMode>('expense');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(1);
  const [note, setNote] = useState('');
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [friendSign, setFriendSign] = useState<1 | -1>(1);
  const [friendAccountId, setFriendAccountId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const amountInputRef = useRef<TextInput>(null);
  const listFadeStyle = useFadeIn([rows.length]);

  const daysInSelectedMonth = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
  const dayOptions = useMemo(
    () => Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1),
    [daysInSelectedMonth]
  );

  // Switching to a shorter month (e.g. from January to February) while day
  // 30 was selected would otherwise leave a day that no longer exists in the
  // chosen month silently selected until the next add.
  useEffect(() => {
    if (day > daysInSelectedMonth) setDay(daysInSelectedMonth);
  }, [daysInSelectedMonth, day]);

  const load = useCallback(async () => {
    const [accs, cats, ppl] = await Promise.all([listAccounts(), listCategories(), listPeople()]);
    setAccounts(accs);
    setCategories(cats);
    setPeople(ppl);
    setAccountId((prev) => prev ?? accs[0]?.id ?? null);
    setPersonId((prev) => prev ?? ppl[0]?.id ?? null);
  }, []);

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

  const onTypeChange = (next: EntryMode) => {
    setType(next);
    setCategoryId(null);
  };

  const addRow = () => {
    setRowError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setRowError('Enter a valid amount');
      return;
    }

    if (type === 'friend') {
      if (!personId) {
        setRowError('Pick a person');
        return;
      }
      const person = people.find((p) => p.id === personId);
      const account = friendAccountId ? accounts.find((a) => a.id === friendAccountId) : null;
      setRows((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          kind: 'friend',
          personId,
          personName: person?.name ?? '—',
          sign: friendSign,
          accountId: friendAccountId,
          accountName: account?.name ?? null,
          amountMinor,
          month: selectedMonth.month,
          year: selectedMonth.year,
          day,
          note,
        },
      ]);
      setAmount('');
      setNote('');
      amountInputRef.current?.focus();
      return;
    }

    if (!effectiveAccountId) {
      setRowError('Enter a valid amount and account');
      return;
    }
    if (type !== 'transfer' && !categoryId) {
      setRowError('Pick a category');
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === effectiveAccountId)) {
      setRowError('Pick a different destination account');
      return;
    }
    const cat = categories.find((c) => c.id === categoryId);
    setRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        kind: 'transaction',
        type,
        accountId: effectiveAccountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId,
        categoryName: type === 'transfer' ? 'Transfer' : (cat?.name ?? '—'),
        amountMinor,
        month: selectedMonth.month,
        year: selectedMonth.year,
        day,
        note,
      },
    ]);
    setAmount('');
    setNote('');
    // Same category/account/day carry over (bulk-backfilling a month usually
    // means several similar entries in a row) — only the amount and note
    // reset, and focus jumps straight back to Amount so a rapid string of
    // "type a number, tap Add, type the next number" never touches anything
    // else.
    amountInputRef.current?.focus();
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const totals = rows.reduce(
    (acc, r) => {
      if (r.kind === 'transaction') {
        if (r.type === 'income') acc.income += r.amountMinor;
        if (r.type === 'expense') acc.expense += r.amountMinor;
      } else if (r.accountId) {
        // "Just adjust balance" moves no real money through an account, so
        // it doesn't belong in the income/expense totals below — only a
        // friend row backed by a real account does.
        if (r.sign === -1) acc.income += r.amountMinor;
        else acc.expense += r.amountMinor;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const saveAll = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    setSaveProgress({ done: 0, total: rows.length });
    let savedCount = 0;
    try {
      for (const r of rows) {
        const iso = partsToIsoDate(String(r.year), String(r.month), String(r.day));
        if (!iso) throw new Error(`Row ${savedCount + 1} has an invalid day`);
        if (r.kind === 'friend') {
          if (r.accountId) {
            // Mirrors PersonDetailModal.record()'s own category lookup in
            // src/features/PeopleSection.tsx, so a backfilled friend
            // transaction lands in the same default category a live one would.
            const category =
              r.sign === 1
                ? (categories.find((c) => c.kind === 'expense' && c.name === 'Friends & Family') ??
                  categories.find((c) => c.kind === 'expense' && c.name === 'Miscellaneous') ??
                  categories.find((c) => c.kind === 'expense'))
                : (categories.find((c) => c.kind === 'income' && c.name === 'Friends & Family') ??
                  categories.find((c) => c.kind === 'income' && c.name === 'Other Income') ??
                  categories.find((c) => c.kind === 'income'));
            if (!category) throw new Error(`Row ${savedCount + 1} has no category available`);
            if (r.sign === 1) {
              await recordMoneyGivenToPerson({
                personId: r.personId,
                accountId: r.accountId,
                categoryId: category.id,
                amountMinor: r.amountMinor,
                date: iso,
                note: r.note,
              });
            } else {
              await recordMoneyReceivedFromPerson({
                personId: r.personId,
                accountId: r.accountId,
                categoryId: category.id,
                amountMinor: r.amountMinor,
                date: iso,
                note: r.note,
              });
            }
          } else {
            await addLedgerEntry({
              personId: r.personId,
              amountMinor: r.amountMinor * r.sign,
              date: iso,
              note: r.note,
            });
          }
          savedCount += 1;
          setSaveProgress({ done: savedCount, total: rows.length });
          continue;
        }
        await createTransaction({
          type: r.type,
          accountId: r.accountId,
          toAccountId: r.toAccountId,
          categoryId: r.categoryId,
          amountMinor: r.amountMinor,
          date: iso,
          note: r.note,
        });
        savedCount += 1;
        setSaveProgress({ done: savedCount, total: rows.length });
      }
      Alert.alert('Saved', `Added ${savedCount} transaction${savedCount === 1 ? '' : 's'}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
      setRows([]);
    } catch (e: any) {
      // Whatever saved before the failure is already real ledger data — keep
      // only the rows that didn't make it in, so retrying Save doesn't
      // duplicate the ones that succeeded.
      setRows((prev) => prev.slice(savedCount));
      Alert.alert(
        'Only some entries saved',
        `${savedCount} of ${rows.length} saved before this went wrong: ${String(e?.message ?? e)}`
      );
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title="Add Past Data" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.introText}>
          Pick the month once, then add as many entries as you need — nothing is saved until you tap Save at
          the end.
        </Text>

        <Text style={styles.sectionTitle}>Which month?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthStrip}
        >
          {months.map((m) => (
            <Chip
              key={`${m.year}-${m.month}`}
              label={m.label}
              active={selectedMonth.year === m.year && selectedMonth.month === m.month}
              onPress={() => setSelectedMonth(m)}
            />
          ))}
        </ScrollView>

        {accounts.length === 0 ? (
          <EmptyState
            title="Add an account first"
            subtitle="You need at least one account before logging past data."
          />
        ) : (
          <View style={styles.form}>
            <SegmentedControl options={TX_TYPES} value={type} onChange={onTypeChange} />

            <FormInput
              ref={amountInputRef}
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              returnKeyType="done"
              onSubmitEditing={addRow}
            />

            <Text style={styles.fieldLabel}>Day in {selectedMonth.label.split(' ')[0]}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayStrip}
            >
              {dayOptions.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDay(d)}
                  style={[styles.dayCell, day === d && styles.dayCellActive]}
                >
                  <Text style={[styles.dayCellText, day === d && styles.dayCellTextActive]}>{d}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {type === 'friend' ? (
              people.length === 0 ? (
                <Text style={styles.hintText}>
                  Add a person in Borrowed &amp; Lent → Friends &amp; Family first.
                </Text>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Person</Text>
                  <View style={styles.chipRow}>
                    {people.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.name}
                        active={personId === p.id}
                        onPress={() => setPersonId(p.id)}
                      />
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>What happened?</Text>
                  <SegmentedControl
                    options={[
                      { label: 'They owe more', value: 'owe' },
                      { label: 'They repaid', value: 'repaid' },
                    ]}
                    value={friendSign === 1 ? 'owe' : 'repaid'}
                    onChange={(v) => setFriendSign(v === 'owe' ? 1 : -1)}
                  />

                  <Text style={styles.fieldLabel}>Did cash actually move?</Text>
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
                  <Text style={styles.hintText}>
                    {friendAccountId
                      ? 'This will also record a real transaction on that account — expense for "They owe more", income for "They repaid" — so it shows up in Transactions and Reports too.'
                      : "This only updates the balance — no real transaction is created, so it won't appear in Transactions or Reports. Pick an account instead if cash actually moved."}
                  </Text>
                </>
              )
            ) : (
              <>
                <Text style={styles.fieldLabel}>{type === 'transfer' ? 'From account' : 'Account'}</Text>
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

                {type === 'transfer' ? (
                  <>
                    <Text style={styles.fieldLabel}>To account</Text>
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
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Category</Text>
                    <CategoryPicker
                      categories={filteredCategories}
                      selectedId={categoryId}
                      onSelect={setCategoryId}
                      variant="chip"
                    />
                  </>
                )}
              </>
            )}

            <FormInput
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Groceries"
            />

            {rowError && <Text style={styles.errorText}>{rowError}</Text>}

            <PrimaryButton title="+ Add to list" variant="secondary" onPress={addRow} />
          </View>
        )}

        {rows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} staged
            </Text>
            <Animated.View style={[styles.list, listFadeStyle]}>
              {rows.map((r) => {
                const isFriend = r.kind === 'friend';
                const isIncomeLike = isFriend ? r.sign === -1 : r.type === 'income';
                const isExpenseLike = isFriend ? r.sign === 1 : r.type === 'expense';
                return (
                  <View key={r.id} style={styles.pendingRow}>
                    <CategoryIcon
                      name={
                        isFriend
                          ? 'account-multiple'
                          : r.type === 'transfer'
                            ? 'swap-horizontal'
                            : (categories.find((c) => c.id === r.categoryId)?.icon ?? 'tag')
                      }
                      color={
                        isFriend
                          ? theme.colors.secondary
                          : r.type === 'transfer'
                            ? theme.colors.secondary
                            : (categories.find((c) => c.id === r.categoryId)?.color ?? theme.colors.textMuted)
                      }
                    />
                    <View style={styles.pendingContent}>
                      <Text style={styles.pendingLabel} numberOfLines={1}>
                        {isFriend
                          ? `${r.personName} ${r.sign === 1 ? 'owes more' : 'repaid'}`
                          : r.categoryName}
                        {!!r.note && <Text style={styles.pendingNoteInline}> · {r.note}</Text>}
                      </Text>
                      <Text style={styles.pendingSub}>
                        {r.year}-{String(r.month).padStart(2, '0')}-{String(r.day).padStart(2, '0')}
                        {isFriend ? ` · ${r.accountName ?? 'balance only'}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.pendingValue,
                        isIncomeLike && styles.income,
                        isExpenseLike && styles.expense,
                      ]}
                    >
                      {isExpenseLike ? '-' : isIncomeLike ? '+' : ''}
                      {formatMoney(r.amountMinor)}
                    </Text>
                    <Pressable onPress={() => removeRow(r.id)} hitSlop={10} style={styles.removeBtn}>
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  </View>
                );
              })}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {rows.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.footerTotals}>
            <View>
              <Text style={styles.footerLabel}>Income</Text>
              <Text style={[styles.footerValue, styles.income]}>{formatMoney(totals.income)}</Text>
            </View>
            <View>
              <Text style={styles.footerLabel}>Expense</Text>
              <Text style={[styles.footerValue, styles.expense]}>{formatMoney(totals.expense)}</Text>
            </View>
            <View>
              <Text style={styles.footerLabel}>Net</Text>
              <Text style={styles.footerValue}>{formatMoney(totals.income - totals.expense)}</Text>
            </View>
          </View>
          <PrimaryButton
            title={
              saveProgress
                ? `Saving ${saveProgress.done} of ${saveProgress.total}...`
                : `Save ${rows.length} transaction${rows.length === 1 ? '' : 's'}`
            }
            onPress={saveAll}
            disabled={saving}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
