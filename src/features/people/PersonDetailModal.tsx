import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import {
  getPersonLedger,
  addLedgerEntry,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  deleteLedgerEntry,
  restoreLedgerEntry,
  PersonWithBalance,
} from '@/db/people';
import { listAccounts, listCategories } from '@/db/ledger';
import { listLoansForPerson } from '@/db/loans';
import { formatMoney, toMinor } from '@/lib/money';
import { roundedMinor, allocateRoundedMinor } from '@/lib/round';
import { Account, Category, Loan, PersonLedgerEntry } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { SegmentedControl } from '@/components/SegmentedControl';
import { dayMonthYear } from '@/lib/dateLabels';
import { Chip } from '@/components/Chip';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { toLocalIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { ActionSheet } from '@/components/ActionSheet';
import { styles } from './people.styles';
import { errorMessage } from '@/lib/errorMessage';
import { withPressed } from '@/lib/pressed';
import { showAlert } from '@/components/AppDialog';

/** One person: their live balance, linked loans, a form to record money either way, and history. */
export function PersonDetailModal({
  person,
  onClose,
  onChanged,
}: {
  person: PersonWithBalance;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { show: showUndo } = useUndoToast();
  const [ledger, setLedger] = useState<PersonLedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [linkedLoans, setLinkedLoans] = useState<Loan[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defaults to today but stays editable — previously hardcoded to "today"
  // with no field to change it at all, so catching up on a friend's expense
  // from last week always misdated it as happening today.
  const [entryDateIso, setEntryDateIso] = useState(() => toLocalIsoDate(new Date()));
  // The history entry whose ⋯ menu is open.
  const [menuEntry, setMenuEntry] = useState<PersonLedgerEntry | null>(null);
  const [tab, setTab] = useState<'settle' | 'history'>('settle');

  const load = useCallback(async () => {
    const [led, accs, cats, loans] = await Promise.all([
      getPersonLedger(person.id),
      listAccounts(),
      listCategories(),
      listLoansForPerson(person.id),
    ]);
    setLedger(led);
    setAccounts(accs);
    setCategories(cats);
    setLinkedLoans(loans);
  }, [person.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Derived from the live ledger rather than the `person` prop, which is a
  // snapshot taken when the modal opened and goes stale the moment a new
  // entry is recorded below.
  const liveBalanceMinor = ledger.reduce((sum, e) => sum + e.amountMinor, 0);
  // Show each history entry rounded so the running list adds up to the
  // rounded balance shown at the top of the sheet.
  const dispEntryAmounts = allocateRoundedMinor(
    ledger.map((e) => e.amountMinor),
    liveBalanceMinor
  );
  const dispBalanceMinor = dispEntryAmounts.reduce((sum, v) => sum + v, 0);

  // "They owe more" (sign 1) with an account selected means cash actually
  // left that account to cover them — recorded as a real expense transaction
  // plus the ledger entry, not just a bookkeeping-only IOU note. Likewise
  // "They repaid" (sign -1) with an account is real income into it.
  const record = async (sign: 1 | -1) => {
    setError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const date = entryDateIso;
      if (accountId) {
        // A dedicated category — not "Miscellaneous"/"Other Income" — so a
        // friend transaction is identifiable at a glance in Transactions and
        // doesn't quietly inflate an unrelated catch-all category's total.
        const category =
          sign === 1
            ? (categories.find((c) => c.kind === 'expense' && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'expense' && c.name === 'Miscellaneous') ??
              categories.find((c) => c.kind === 'expense'))
            : (categories.find((c) => c.kind === 'income' && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'income' && c.name === 'Other Income') ??
              categories.find((c) => c.kind === 'income'));
        if (!category) throw new Error('No category available');
        if (sign === 1) {
          await recordMoneyGivenToPerson({
            personId: person.id,
            accountId,
            categoryId: category.id,
            amountMinor,
            date,
            note,
          });
        } else {
          await recordMoneyReceivedFromPerson({
            personId: person.id,
            accountId,
            categoryId: category.id,
            amountMinor,
            date,
            note,
          });
        }
      } else {
        await addLedgerEntry({ personId: person.id, amountMinor: amountMinor * sign, date, note });
      }
      setAmount('');
      setNote('');
      await load();
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Previously there was no way at all to remove a mistaken entry — deleting
  // FROM the ledger side (rather than from Transactions, which only reaches
  // entries that have a linked transaction) covers "just adjust balance"
  // entries too.
  const runDeleteEntry = async (entry: PersonLedgerEntry) => {
    setSaving(true);
    try {
      const snapshot = await deleteLedgerEntry(entry.id);
      haptics.warn();
      await load();
      await onChanged();
      showUndo(`Deleted ${entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid')}`, async () => {
        await restoreLedgerEntry(snapshot);
        await load();
        await onChanged();
      });
    } catch (e) {
      showAlert("Couldn't delete entry", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // A "just adjust balance" entry is a single row, deleted instantly like
  // everywhere else — one with a linked transaction cascades (that
  // transaction goes with it, and account balances update immediately), so
  // that case gets an extra confirm step first.
  // A linked loan lives on the Loans screen, with its schedule.
  const openLoans = () => {
    onClose();
    router.push('/loans');
  };

  const onDeleteEntry = (entry: PersonLedgerEntry) => {
    if (!entry.transactionId) {
      runDeleteEntry(entry);
      return;
    }
    showAlert(
      'Delete this entry?',
      'Its linked transaction will be removed too, and account balances will update immediately. You can undo right after, if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => runDeleteEntry(entry) },
      ]
    );
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      footer={
        <View style={f.footerRow}>
          <PrimaryButton
            title={saving ? '…' : 'They owe more'}
            variant="secondary"
            onPress={() => record(1)}
            disabled={saving}
            style={f.footerBtn}
          />
          <PrimaryButton
            title={saving ? '…' : 'They repaid'}
            onPress={() => record(-1)}
            disabled={saving}
            style={f.footerBtn}
          />
        </View>
      }
    >
      {/* The calm-sheets sign-off (Direction C): the balance as a card —
          mint when they owe you, coral when you owe them — then two pages:
          record money either way, and the history. */}
      <SheetCard
        hue={
          liveBalanceMinor > 0
            ? theme.colors.secondary
            : liveBalanceMinor < 0
              ? theme.colors.idCoralDeep
              : theme.colors.primary
        }
        icon="account-outline"
        kicker={liveBalanceMinor > 0 ? 'Owes you' : liveBalanceMinor < 0 ? 'You owe' : 'All square'}
        amount={formatMoney(Math.abs(dispBalanceMinor))}
        amountColor={liveBalanceMinor < 0 ? theme.colors.expenseText : theme.colors.textPrimary}
        title={person.name}
        meta={
          ledger.length === 0
            ? 'No entries yet'
            : `${ledger.length} ${ledger.length === 1 ? 'entry' : 'entries'} · last ${dayMonthYear(ledger[0].date)}`
        }
      />
      <View style={styles.sheetTabs}>
        <SegmentedControl
          options={[
            { label: 'Settle', value: 'settle' },
            { label: 'History', value: 'history' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'history' && linkedLoans.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Linked loans</Text>
          {linkedLoans.map((loan) => (
            <Pressable
              key={loan.id}
              style={withPressed(styles.row)}
              onPress={openLoans}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {loan.direction === 'borrowed' ? 'You borrowed' : 'You lent'} ·{' '}
                  {(loan.interestRateAnnualBp / 100).toFixed(2)}%
                </Text>
                <Text style={styles.rowSub}>{loan.status}</Text>
              </View>
              <Text style={styles.rowValue}>{formatMoney(roundedMinor(loan.outstandingPrincipalMinor))}</Text>
            </Pressable>
          ))}
          <Text style={styles.hintText}>
            Separate from the balance above — tracked as a formal loan with its own schedule. Tap one to see
            it in Loans.
          </Text>
        </>
      )}

      {tab === 'settle' && (
        <>
          <FormInput
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
          />
          <FormInput
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Dinner split"
          />

          <DateField label="Date" value={entryDateIso} onChange={setEntryDateIso} pastFacing />

          <Text style={styles.fieldLabel}>Did cash actually move?</Text>
          <View style={styles.chipRow}>
            <Chip
              label="Just adjust balance"
              active={accountId === null}
              onPress={() => setAccountId(null)}
            />
            {accounts.map((acc) => (
              <Chip
                key={acc.id}
                label={acc.name}
                active={accountId === acc.id}
                onPress={() => setAccountId(acc.id)}
              />
            ))}
          </View>
          <Text style={styles.hintText}>
            {accountId
              ? 'This will also record a real transaction on that account — expense for "They owe more", income for "They repaid" — so it shows up in Activity and Reports too.'
              : "This only updates the balance above — no real transaction is created, so it won't appear in Activity or Reports. Pick an account instead if cash actually moved."}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </>
      )}

      {tab === 'history' &&
        (ledger.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet.</Text>
        ) : (
          <>
            {ledger.map((entry, i) => (
              <Pressable
                key={entry.id}
                style={withPressed(styles.row)}
                onLongPress={() => onDeleteEntry(entry)}
                accessibilityHint="Double tap and hold to delete"
                disabled={saving}
              >
                <View
                  style={[
                    styles.historyIcon,
                    {
                      backgroundColor:
                        entry.amountMinor >= 0 ? theme.colors.incomeTint : theme.colors.expenseTint,
                    },
                  ]}
                >
                  <Feather
                    name={entry.amountMinor >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={13}
                    color={entry.amountMinor >= 0 ? theme.colors.income : theme.colors.expense}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid')}
                  </Text>
                  <Text style={styles.rowSub}>{dayMonthYear(entry.date)}</Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    { color: entry.amountMinor >= 0 ? theme.colors.incomeText : theme.colors.expenseText },
                  ]}
                >
                  {entry.amountMinor >= 0 ? '+' : '-'}
                  {formatMoney(Math.abs(dispEntryAmounts[i]))}
                </Text>
                <Pressable
                  onPress={() => setMenuEntry(entry)}
                  hitSlop={10}
                  disabled={saving}
                  style={withPressed(styles.moreBtn)}
                  accessibilityRole="button"
                  accessibilityLabel={`More for the ${dayMonthYear(entry.date)} entry`}
                >
                  <Feather name="more-horizontal" size={15} color={theme.colors.textSecondary} />
                </Pressable>
              </Pressable>
            ))}
          </>
        ))}
      <ActionSheet
        visible={!!menuEntry}
        onClose={() => setMenuEntry(null)}
        title={
          menuEntry
            ? `${menuEntry.note || (menuEntry.amountMinor >= 0 ? 'Lent' : 'Repaid')} · ${dayMonthYear(menuEntry.date)}`
            : undefined
        }
        items={
          menuEntry
            ? [
                {
                  key: 'delete',
                  label: 'Delete entry',
                  icon: 'trash-2',
                  destructive: true,
                  onPress: () => onDeleteEntry(menuEntry),
                },
              ]
            : []
        }
      />
    </ModalSheet>
  );
}
