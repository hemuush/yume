import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { createTransaction, updateTransaction } from '@/db/ledger';
import { toMinor } from '@/lib/money';
import { Account, Category, Transaction, TransactionType } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { parseLocalIsoDate, partsToIsoDate } from '@/lib/date';
import { CategoryPicker } from '@/components/CategoryPicker';
import { styles } from './transactions.styles';

const TX_TYPES: { label: string; value: TransactionType }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
];

export function AddTransactionModal({
  visible,
  accounts,
  categories,
  editing,
  initialType,
  onClose,
  onSaved,
}: {
  visible: boolean;
  accounts: Account[];
  categories: Category[];
  editing: Transaction | null;
  initialType?: TransactionType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<TransactionType>(initialType ?? 'expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateYear, setDateYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const d = editing ? parseLocalIsoDate(editing.date) : new Date();
    setDateDay(String(d.getDate()));
    setDateMonth(String(d.getMonth() + 1));
    setDateYear(String(d.getFullYear()));
    if (editing) {
      setType(editing.type);
      setAmount((editing.amountMinor / 100).toString());
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId);
      setCategoryId(editing.categoryId);
      setNote(editing.note);
    } else {
      setType(initialType ?? 'expense');
      setAmount('');
      setAccountId(accounts[0]?.id ?? null);
      setToAccountId(null);
      setCategoryId(null);
      setNote('');
    }
    setError(null);
    // `accounts` is intentionally excluded: it's only read to seed the default
    // source account when the modal opens for a *new* entry. Re-running this on
    // an accounts refresh would wipe whatever the user has half-filled in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing, initialType]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );

  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null;

  // Switching between expense/income/transfer must drop any previously
  // selected category — an expense category id left over from before the
  // switch would otherwise silently attach to an income transaction.
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
    const date = partsToIsoDate(dateYear, dateMonth, dateDay);
    if (!date) {
      setError('Enter a valid date');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateTransaction(editing.id, {
          type,
          accountId: effectiveAccountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type === 'transfer' ? null : categoryId,
          amountMinor,
          date,
          note,
        });
      } else {
        await createTransaction({
          type,
          accountId: effectiveAccountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type === 'transfer' ? null : categoryId,
          amountMinor,
          date,
          note,
        });
      }
      onSaved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} title={editing ? 'Edit Transaction' : 'New Transaction'}>
      <SegmentedControl options={TX_TYPES} value={type} onChange={onTypeChange} />

      <FormInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0.00"
      />

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

      {type === 'transfer' && (
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
      )}

      {type !== 'transfer' && (
        <>
          <Text style={styles.fieldLabel}>Category</Text>
          <CategoryPicker
            categories={filteredCategories}
            selectedId={categoryId}
            onSelect={setCategoryId}
            variant="medal"
          />
        </>
      )}

      <Text style={styles.fieldLabel}>Date</Text>
      <View style={styles.dateFieldsRow}>
        <FormInput
          label="Day"
          value={dateDay}
          onChangeText={setDateDay}
          keyboardType="numeric"
          placeholder="DD"
          style={styles.dateFieldInput}
        />
        <FormInput
          label="Month"
          value={dateMonth}
          onChangeText={setDateMonth}
          keyboardType="numeric"
          placeholder="MM"
          style={styles.dateFieldInput}
        />
        <FormInput
          label="Year"
          value={dateYear}
          onChangeText={setDateYear}
          keyboardType="numeric"
          placeholder="YYYY"
          style={styles.dateFieldInput}
        />
      </View>

      <FormInput
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Lunch with team"
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.modalActions}>
        <PrimaryButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ flex: 1, marginRight: 8 }}
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Save'}
          onPress={submit}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </ModalSheet>
  );
}
