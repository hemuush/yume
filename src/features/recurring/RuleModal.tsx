import { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import {
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  RecurringRuleInput,
} from '@/db/recurring';
import { Account, Category, RecurringRule, RecurrenceFrequency, TransactionType } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { toMinor } from '@/lib/money';
import { partsToIsoDate } from '@/lib/date';
import { CategoryPicker } from '@/components/CategoryPicker';
import { styles } from './recurring.styles';
import { frequencyNoun } from './recurring.helpers';

const TX_TYPES: { label: string; value: TransactionType }[] = [
  { label: 'Expense', value: 'expense' },
  { label: 'Income', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
];

const FREQUENCIES: { label: string; value: RecurrenceFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

export function RuleModal({
  visible,
  editing,
  accounts,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  visible: boolean;
  editing: RecurringRule | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [intervalCount, setIntervalCount] = useState('1');
  const [startYear, setStartYear] = useState(String(today.getFullYear()));
  const [startMonth, setStartMonth] = useState(String(today.getMonth() + 1));
  const [startDay, setStartDay] = useState(String(today.getDate()));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endYear, setEndYear] = useState(String(today.getFullYear() + 1));
  const [endMonth, setEndMonth] = useState(String(today.getMonth() + 1));
  const [endDay, setEndDay] = useState(String(today.getDate()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setType(editing.type);
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId);
      setCategoryId(editing.categoryId);
      setAmount((editing.amountMinor / 100).toString());
      setNote(editing.note);
      setFrequency(editing.frequency);
      setIntervalCount(String(editing.intervalCount));
      const [sy, sm, sd] = editing.nextRunDate.split('-');
      setStartYear(sy);
      setStartMonth(String(Number(sm)));
      setStartDay(String(Number(sd)));
      if (editing.endDate) {
        setHasEndDate(true);
        const [ey, em, ed] = editing.endDate.split('-');
        setEndYear(ey);
        setEndMonth(String(Number(em)));
        setEndDay(String(Number(ed)));
      } else {
        setHasEndDate(false);
      }
    } else {
      setType('expense');
      setAccountId(accounts[0]?.id ?? null);
      setToAccountId(null);
      setCategoryId(null);
      setAmount('');
      setNote('');
      setFrequency('monthly');
      setIntervalCount('1');
      setStartYear(String(today.getFullYear()));
      setStartMonth(String(today.getMonth() + 1));
      setStartDay(String(today.getDate()));
      setHasEndDate(false);
      setEndYear(String(today.getFullYear() + 1));
      setEndMonth(String(today.getMonth() + 1));
      setEndDay(String(today.getDate()));
    }
    setError(null);
  }, [visible, editing, accounts, today]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );
  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null;

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
    if (type === 'transfer' && (!toAccountId || toAccountId === effectiveAccountId)) {
      setError('Pick a different destination account');
      return;
    }
    const startDate = partsToIsoDate(startYear, startMonth, startDay);
    if (!startDate) {
      setError('Enter a valid start date');
      return;
    }
    const endDate = hasEndDate ? partsToIsoDate(endYear, endMonth, endDay) : null;
    if (hasEndDate && !endDate) {
      setError('Enter a valid end date');
      return;
    }
    const interval = parseInt(intervalCount || '0', 10);
    if (!Number.isInteger(interval) || interval <= 0) {
      setError('Repeat interval must be 1 or more');
      return;
    }

    const input: RecurringRuleInput = {
      type,
      accountId: effectiveAccountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : categoryId,
      amountMinor,
      note,
      frequency,
      intervalCount: interval,
      nextRunDate: startDate,
      endDate,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateRecurringRule(editing.id, input);
      } else {
        await createRecurringRule(input);
      }
      onSaved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete this recurring entry?',
      'Past transactions it already created stay untouched — only future occurrences stop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteRecurringRule(editing.id);
              onDeleted();
            } catch (e: any) {
              Alert.alert('Could not delete', String(e?.message ?? e));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={editing ? 'Edit Recurring Entry' : 'New Recurring Entry'}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={f.footerBtn}
              disabled={saving}
            />
            <PrimaryButton
              title={saving ? 'Saving...' : editing ? 'Save' : 'Create'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
          {editing && (
            <PrimaryButton title="Delete" variant="secondary" onPress={confirmDelete} disabled={saving} />
          )}
        </View>
      }
    >
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

      <Text style={styles.fieldLabel}>Repeats</Text>
      <SegmentedControl options={FREQUENCIES} value={frequency} onChange={setFrequency} />

      <FormInput
        label={`Every N ${frequencyNoun(frequency, parseInt(intervalCount || '1', 10))}`}
        value={intervalCount}
        onChangeText={setIntervalCount}
        keyboardType="numeric"
        placeholder="1"
      />

      <Text style={styles.fieldLabel}>Starts on</Text>
      <View style={styles.dateFieldsRow}>
        <View style={{ flex: 1 }}>
          <FormInput
            label="Day"
            value={startDay}
            onChangeText={setStartDay}
            keyboardType="numeric"
            placeholder="DD"
            style={styles.dateFieldInput}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput
            label="Month"
            value={startMonth}
            onChangeText={setStartMonth}
            keyboardType="numeric"
            placeholder="MM"
            style={styles.dateFieldInput}
          />
        </View>
        <View style={{ flex: 1.3 }}>
          <FormInput
            label="Year"
            value={startYear}
            onChangeText={setStartYear}
            keyboardType="numeric"
            placeholder="YYYY"
            style={styles.dateFieldInput}
          />
        </View>
      </View>

      <View style={styles.endDateRow}>
        <Text style={styles.fieldLabel}>Ends on a specific date</Text>
        <ToggleSwitch value={hasEndDate} onChange={setHasEndDate} />
      </View>
      {hasEndDate && (
        <View style={styles.dateFieldsRow}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Day"
              value={endDay}
              onChangeText={setEndDay}
              keyboardType="numeric"
              placeholder="DD"
              style={styles.dateFieldInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Month"
              value={endMonth}
              onChangeText={setEndMonth}
              keyboardType="numeric"
              placeholder="MM"
              style={styles.dateFieldInput}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <FormInput
              label="Year"
              value={endYear}
              onChangeText={setEndYear}
              keyboardType="numeric"
              placeholder="YYYY"
              style={styles.dateFieldInput}
            />
          </View>
        </View>
      )}

      <FormInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Netflix" />
    </ModalSheet>
  );
}
