import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import {
  advanceDate,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  restoreRecurringRule,
  RecurringRuleInput,
} from '@/db/recurring';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { Account, Category, RecurringRule, RecurrenceFrequency, TransactionType } from '@/types';
import { ModalSheet, SheetLink } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { SettingsRow } from '@/components/SettingsRow';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';
import { useAccent } from '@/theme/AccentContext';
import { hexToRgba } from '@/lib/color';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { DateTile } from '@/components/DateTile';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { toMinor, formatMoney, inputMinor } from '@/lib/money';
import { toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { CategoryPicker } from '@/components/CategoryPicker';
import { styles } from './recurring.styles';
import { cadenceLabel, frequencyNoun } from './recurring.helpers';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { spendableAccountsOf } from '@/lib/account';

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
  prefill,
}: {
  visible: boolean;
  editing: RecurringRule | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  /** A new rule's starting values — "Make it recurring" on an entry fills the form from it. */
  prefill?: {
    type: TransactionType;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    amountMinor: number;
    note: string;
    nextRunDate: string;
  };
}) {
  const { show: showUndo } = useUndoToast();
  const { accent } = useAccent();
  const today = useMemo(() => toLocalIsoDate(new Date()), []);
  const [type, setType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [intervalCount, setIntervalCount] = useState('1');
  const [startDate, setStartDate] = useState(today);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(() => addMonthsToIsoDate(today, 12));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'setup' | 'schedule'>('setup');
  // Which row's picker is open in place — one at a time.
  const [open, setOpen] = useState<'account' | 'to' | 'category' | null>(null);

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
      setStartDate(editing.nextRunDate);
      setHasEndDate(!!editing.endDate);
      setEndDate(editing.endDate ?? addMonthsToIsoDate(editing.nextRunDate, 12));
    } else {
      setType(prefill?.type ?? 'expense');
      setAccountId(prefill?.accountId ?? accounts[0]?.id ?? null);
      setToAccountId(prefill?.toAccountId ?? null);
      setCategoryId(prefill?.categoryId ?? null);
      setAmount(prefill ? (prefill.amountMinor / 100).toString() : '');
      setNote(prefill?.note ?? '');
      setFrequency('monthly');
      setIntervalCount('1');
      setStartDate(prefill?.nextRunDate ?? today);
      setHasEndDate(false);
      setEndDate(addMonthsToIsoDate(today, 12));
    }
    setError(null);
    setTab('setup');
    // A new rule opens on the category grid; an existing one on its summary.
    setOpen(editing || prefill?.categoryId ? null : 'category');
  }, [visible, editing, accounts, today, prefill]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type]
  );
  // Same rule as the add-transaction screen: a recurring expense/income can't fire straight out of a savings
  // account (transfer out first); validate() in src/db/recurring.ts enforces it too.
  const spendableAccounts = useMemo(() => spendableAccountsOf(accounts), [accounts]);
  const pickableAccounts = type === 'transfer' ? accounts : spendableAccounts;
  const effectiveAccountId =
    accountId && pickableAccounts.some((a) => a.id === accountId)
      ? accountId
      : (pickableAccounts[0]?.id ?? null);

  const onTypeChange = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
    setOpen(next === 'transfer' ? null : 'category');
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
    if (hasEndDate && endDate < startDate) {
      setError('The end date is before the start date');
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
      endDate: hasEndDate ? endDate : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateRecurringRule(editing.id, input);
      } else {
        await createRecurringRule(input);
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const snapshot = await deleteRecurringRule(editing.id);
      haptics.warn();
      onDeleted();
      showUndo('Deleted recurring entry', async () => {
        await restoreRecurringRule(snapshot);
        onDeleted();
      });
    } catch (e) {
      showAlert("Couldn't delete", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // The calm-sheets sign-off (Direction C): a live card of the rule as it
  // will be logged, then two pages — what gets logged, and when.
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const cat = categoriesById.get(categoryId ?? '');
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const interval = Math.max(1, parseInt(intervalCount || '1', 10) || 1);
  const upcoming = [startDate];
  while (upcoming.length < 3) {
    upcoming.push(
      advanceDate(upcoming[upcoming.length - 1], frequency, interval, Number(startDate.slice(8)))
    );
  }
  const toggle = (which: 'account' | 'to' | 'category') => setOpen((o) => (o === which ? null : which));

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            title={saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            onPress={submit}
            disabled={saving}
          />
        </View>
      }
    >
      <SheetCard
        hue={type === 'transfer' ? theme.colors.secondary : (cat?.color ?? accent)}
        icon={type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'repeat')}
        kicker={cadenceLabel(frequency, interval)}
        amount={formatMoney(inputMinor(amount))}
        title={
          note ||
          (type === 'transfer'
            ? `${accountName(effectiveAccountId) ?? '—'} → ${accountName(toAccountId) ?? '…'}`
            : cat
              ? categorySentence(cat.name, parentNameOf(cat.id, categoriesById))
              : editing
                ? 'Recurring entry'
                : 'New recurring entry')
        }
        meta={`${type === 'income' ? 'Into' : 'From'} ${accountName(effectiveAccountId) ?? '—'} · next ${weekdayDayMonth(startDate)}`}
      />
      <View style={styles.tabs}>
        <SegmentedControl
          options={[
            { label: 'Set up', value: 'setup' },
            { label: 'Schedule', value: 'schedule' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'setup' ? (
        <>
          <SegmentedControl options={TX_TYPES} value={type} onChange={onTypeChange} />
          <View style={styles.gap} />
          <AmountField label="Amount" value={amount} onChangeText={setAmount} placeholder="0.00" />
          <View style={[h.card, h.cardInSheet]}>
            <SettingsRow
              round
              icon="bank"
              iconBg={theme.colors.primaryTint}
              label={type === 'transfer' ? 'From' : 'Account'}
              value={accountName(effectiveAccountId)}
              onPress={() => toggle('account')}
              expanded={open === 'account'}
            />
            {open === 'account' && (
              <View style={styles.rowPanel}>
                {pickableAccounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    active={effectiveAccountId === acc.id}
                    onPress={() => {
                      setAccountId(acc.id);
                      setOpen(null);
                    }}
                  />
                ))}
              </View>
            )}
            {type === 'transfer' ? (
              <>
                <SettingsRow
                  round
                  icon="swap-horizontal"
                  iconBg={theme.colors.secondaryTint}
                  label="To"
                  value={accountName(toAccountId) ?? 'Pick one'}
                  onPress={() => toggle('to')}
                  expanded={open === 'to'}
                  divider
                />
                {open === 'to' && (
                  <View style={styles.rowPanel}>
                    {accounts
                      .filter((a) => a.id !== effectiveAccountId)
                      .map((acc) => (
                        <Chip
                          key={acc.id}
                          label={acc.name}
                          active={toAccountId === acc.id}
                          onPress={() => {
                            setToAccountId(acc.id);
                            setOpen(null);
                          }}
                        />
                      ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <SettingsRow
                  round
                  icon={cat?.icon ?? 'shape-outline'}
                  iconBg={cat ? hexToRgba(cat.color, 0.25) : theme.colors.surfaceAlt}
                  label="Category"
                  value={cat ? categorySentence(cat.name, parentNameOf(cat.id, categoriesById)) : 'Pick one'}
                  onPress={() => toggle('category')}
                  expanded={open === 'category'}
                  divider
                />
                {open === 'category' && (
                  <View style={styles.rowPanelGrid}>
                    <CategoryPicker
                      categories={filteredCategories}
                      selectedId={categoryId}
                      onSelect={(id) => {
                        setCategoryId(id);
                        setOpen(null);
                      }}
                      variant="medal"
                    />
                  </View>
                )}
              </>
            )}
          </View>
          <FormInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Netflix" />
          {editing && <SheetLink label="Delete recurring entry" onPress={confirmDelete} disabled={saving} />}
        </>
      ) : (
        <>
          <SegmentedControl options={FREQUENCIES} value={frequency} onChange={setFrequency} />
          <View style={styles.gap} />
          <AmountField
            decimal={false}
            label={`Every how many ${frequencyNoun(frequency, 2)}`}
            value={intervalCount}
            onChangeText={setIntervalCount}
            placeholder="1"
          />
          <DateField label="Starts on" value={startDate} onChange={setStartDate} />
          <View style={styles.endDateRow}>
            <Text style={styles.fieldLabel}>Ends on a specific date</Text>
            <ToggleSwitch value={hasEndDate} onChange={setHasEndDate} />
          </View>
          {hasEndDate && (
            <DateField label="Ends on" value={endDate} onChange={setEndDate} minDate={startDate} />
          )}
          <Text style={[styles.fieldLabel, styles.upcomingLabel]}>Coming up</Text>
          <View style={styles.upcoming}>
            {upcoming.map((d, i) => (
              <DateTile key={d} iso={d} background={i === 0 ? theme.colors.primaryTint : undefined} />
            ))}
          </View>
        </>
      )}
    </ModalSheet>
  );
}
