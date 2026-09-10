import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
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
import { Account, Category, Transaction, TransactionType } from '@/types';
import { theme } from '@/constants/theme';
import { toMinor } from '@/lib/money';
import { toLocalIsoDate, parseLocalIsoDate, addDaysToIsoDate } from '@/lib/date';
import { AppHeader } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { SoftCard } from '@/features/home/SoftCard';
import { CalendarSheet } from '@/features/transactions/CalendarSheet';

const TX_TYPES: { label: string; value: TransactionType }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
];

function isTxType(v: string | undefined): v is TransactionType {
  return v === 'expense' || v === 'income' || v === 'transfer';
}

function dateLabel(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const editingId = params.id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const [type, setType] = useState<TransactionType>(isTxType(params.type) ? params.type : 'expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => toLocalIsoDate(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [accs, cats] = await Promise.all([listAccounts(), listCategories()]);
    setAccounts(accs);
    setCategories(cats);

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

  // Switching type must drop any category picked under the old type.
  const onTypeChange = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
  };

  const submit = async () => {
    setError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!effectiveAccountId || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount and account');
      return;
    }
    if (type !== 'transfer' && !categoryId) {
      setError('Pick a category');
      return;
    }
    if (type === 'transfer' && !toAccountId) {
      setError('Pick a destination account');
      return;
    }
    if (type === 'transfer' && toAccountId === effectiveAccountId) {
      setError('Pick a different destination account');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        accountId: effectiveAccountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId,
        amountMinor,
        date,
        note,
      };
      if (editing) await updateTransaction(editing.id, payload);
      else await createTransaction(payload);
      router.back();
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setSaving(false);
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

  const title = editing ? 'Edit Transaction' : 'New Transaction';
  const saveTitle = saving ? 'Saving…' : editing ? 'Save changes' : `Save ${type}`;

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
        contentContainerStyle={{ padding: 20, paddingBottom: 140 + insets.bottom }}
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
          <Text style={styles.label}>Type</Text>
          <SegmentedControl options={TX_TYPES} value={type} onChange={onTypeChange} />
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

        <View style={styles.section}>
          <Text style={styles.label}>{type === 'transfer' ? 'From' : 'Account'}</Text>
          <View style={styles.chipRow}>
            {accounts.map((acc) => (
              <Pressable
                key={acc.id}
                onPress={() => setAccountId(acc.id)}
                style={[styles.chip, effectiveAccountId === acc.id && styles.chipActive]}
              >
                <Text style={styles.chipText}>{acc.name}</Text>
              </Pressable>
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
                  <Pressable
                    key={acc.id}
                    onPress={() => setToAccountId(acc.id)}
                    style={[styles.chip, toAccountId === acc.id && styles.chipActive]}
                  >
                    <Text style={styles.chipText}>{acc.name}</Text>
                  </Pressable>
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

        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => setDate(today)}
              style={[styles.chip, date === today && styles.chipActive]}
            >
              <Text style={styles.chipText}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => setDate(yesterday)}
              style={[styles.chip, date === yesterday && styles.chipActive]}
            >
              <Text style={styles.chipText}>Yesterday</Text>
            </Pressable>
            <Pressable
              onPress={() => setCalendarOpen(true)}
              style={[styles.chip, date !== today && date !== yesterday && styles.chipActive]}
            >
              <Feather name="calendar" size={12} color={theme.colors.ink} />
              <Text style={styles.chipText}> {dateLabel(date)} </Text>
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
      </KeyboardAwareScrollView>

      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
      >
        {error && <Text style={styles.error}>{error}</Text>}
        <PrimaryButton title={saveTitle} onPress={submit} disabled={saving || isLinked} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  section: { marginBottom: 18 },
  label: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 8,
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
  error: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.expense,
    textAlign: 'center',
    marginBottom: 8,
  },
});
