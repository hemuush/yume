import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { getCachedCurrency } from '@/db/settings';
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
import { spendableAccountsOf, defaultCurrencyAccountsOf } from '@/lib/account';
import { listLoansForPerson } from '@/db/loans';
import { inputMinor, formatMoney, toMinor } from '@/lib/money';
import { roundedMinor, allocateRoundedMinor } from '@/lib/round';
import { Account, Category, Loan, PersonLedgerEntry } from '@/types';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
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
import { useAccent } from '@/theme/AccentContext';

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
  const { accent } = useAccent();
  const [ledger, setLedger] = useState<PersonLedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [linkedLoans, setLinkedLoans] = useState<Loan[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defaults to today but stays editable, so catching up on a friend's expense from last week isn't
  // misdated.
  const [entryDateIso, setEntryDateIso] = useState(() => toLocalIsoDate(new Date()));
  // The history entry whose ⋯ menu is open.
  const [menuEntry, setMenuEntry] = useState<PersonLedgerEntry | null>(null);
  const [tab, setTab] = useState<'settle' | 'history'>('settle');

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedPersonId, setLoadedPersonId] = useState<string | null>(null);
  const running = useRef(false);
  const detailsLoaded = loadedPersonId === person.id;

  // Latest load wins, and closing the sheet voids any in flight, so a slow earlier fetch can't overwrite
  // fresher figures or set state after unmount.
  const loadTicket = useRef(0);
  useEffect(
    () => () => {
      loadTicket.current += 1;
    },
    []
  );
  const load = useCallback(async () => {
    const ticket = ++loadTicket.current;
    try {
      const [led, accs, cats, loans] = await Promise.all([
        getPersonLedger(person.id),
        listAccounts(),
        listCategories(),
        listLoansForPerson(person.id),
      ]);
      if (ticket !== loadTicket.current) return;
      setLedger(led);
      // Cash moving to or from a friend is income or spending, which a savings account can't take (as on Add).
      setAccounts(defaultCurrencyAccountsOf(spendableAccountsOf(accs)));
      setCategories(cats);
      setLinkedLoans(loans);
      setLoadedPersonId(person.id);
      setLoadError(null);
    } catch (e) {
      if (ticket !== loadTicket.current) return;
      setLoadError(errorMessage(e));
    }
  }, [person.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Derived from the live ledger, not the `person` prop, which is a snapshot from when the modal opened and
  // goes stale once a new entry is recorded.
  const currency = getCachedCurrency();
  const liveBalanceMinor = detailsLoaded
    ? ledger.reduce((sum, e) => ((e.currency ?? currency) === currency ? sum + e.amountMinor : sum), 0)
    : person.balanceMinor;
  // Show each history entry rounded so the running list adds up to the
  // rounded balance shown at the top of the sheet.
  const dispEntryAmounts = new Array<number>(ledger.length);
  for (const code of new Set(ledger.map((e) => e.currency ?? currency))) {
    const indexes = ledger.flatMap((e, i) => ((e.currency ?? currency) === code ? [i] : []));
    const rounded = allocateRoundedMinor(indexes.map((i) => ledger[i].amountMinor));
    indexes.forEach((index, i) => {
      dispEntryAmounts[index] = rounded[i];
    });
  }
  const dispBalanceMinor = detailsLoaded
    ? dispEntryAmounts.reduce(
        (sum, v, i) => ((ledger[i].currency ?? currency) === currency ? sum + v : sum),
        0
      )
    : roundedMinor(person.balanceMinor);

  // "They owe more" (sign 1) with an account means cash left it: recorded as a real expense transaction plus
  // the ledger entry, not a bookkeeping-only IOU. Likewise "They repaid" (sign -1) is real income into it.
  const record = async (sign: 1 | -1) => {
    if (running.current || !detailsLoaded || loadError) return;
    setError(null);
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    running.current = true;
    setSaving(true);
    try {
      const date = entryDateIso;
      if (accountId) {
        // A dedicated category, not "Miscellaneous"/"Other Income", so friend transactions stand out in
        // Transactions and don't inflate an unrelated catch-all total.
        // Only the built-in Friends & Family category, or the named catch-all: never whichever category
        // happens to be first, which would misfile the transaction.
        const category =
          sign === 1
            ? (categories.find((c) => c.kind === 'expense' && c.isSystem && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'expense' && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'expense' && c.name === 'Miscellaneous'))
            : (categories.find((c) => c.kind === 'income' && c.isSystem && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'income' && c.name === 'Friends & Family') ??
              categories.find((c) => c.kind === 'income' && c.name === 'Other Income'));
        if (!category) {
          throw new Error(
            `The "Friends & Family" ${sign === 1 ? 'expense' : 'income'} category is missing. Choose "Just adjust balance" instead, or add that category.`
          );
        }
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
      running.current = false;
    }
  };

  // Deleting from the ledger side (not Transactions, which only reaches entries with a linked transaction)
  // also covers "just adjust balance" entries.
  const runDeleteEntry = async (entry: PersonLedgerEntry) => {
    if (running.current || !detailsLoaded || loadError) return;
    running.current = true;
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
      running.current = false;
    }
  };

  // A "just adjust balance" entry is one row, deleted instantly; one with a linked transaction cascades (that
  // transaction goes, balances update), so it gets an extra confirm. A linked loan lives on the Loans screen.
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
      onClose={saving ? () => {} : onClose}
      footer={
        tab === 'history' ? (
          <PrimaryButton title="Done" onPress={onClose} disabled={saving} />
        ) : (
          // Worded from where the balance stands: when you owe them, paying back is the main action.
          <View style={f.footerRow}>
            {liveBalanceMinor < 0 ? (
              <>
                <PrimaryButton
                  title={saving ? 'Saving…' : 'I owe more'}
                  variant="secondary"
                  onPress={() => record(-1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={f.footerBtn}
                />
                <PrimaryButton
                  title={saving ? 'Saving…' : 'I paid them back'}
                  onPress={() => record(1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={f.footerBtn}
                />
              </>
            ) : (
              <>
                <PrimaryButton
                  title={saving ? 'Saving…' : 'They owe more'}
                  variant="secondary"
                  onPress={() => record(1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={f.footerBtn}
                />
                <PrimaryButton
                  title={saving ? 'Saving…' : 'They repaid'}
                  onPress={() => record(-1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={f.footerBtn}
                />
              </>
            )}
          </View>
        )
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
              : accent
        }
        icon="account-outline"
        kicker={liveBalanceMinor > 0 ? 'Owes you' : liveBalanceMinor < 0 ? 'You owe' : 'All square'}
        amount={formatMoney(Math.abs(dispBalanceMinor))}
        amountColor={liveBalanceMinor < 0 ? theme.colors.expenseText : theme.colors.textPrimary}
        title={person.name}
        meta={
          !detailsLoaded
            ? loadError
              ? 'Latest details unavailable'
              : 'Loading latest details…'
            : ledger.length === 0
              ? 'No entries yet'
              : `${ledger.length} ${ledger.length === 1 ? 'entry' : 'entries'} · last ${dayMonthYear(ledger[0].date)}`
        }
      />
      {loadError && (
        <>
          <Text style={styles.errorText}>Couldn't load the latest details: {loadError}</Text>
          <PrimaryButton title="Retry" variant="secondary" compact onPress={load} />
        </>
      )}
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
                <Text style={styles.rowLabel} numberOfLines={2}>
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
          <AmountField label="Amount" value={amount} onChangeText={setAmount} placeholder="0" />
          {liveBalanceMinor !== 0 && (
            // One tap fills the whole balance, the usual way a friend's tab gets settled.
            <View style={styles.settleRow}>
              <Chip
                label={`Settle ${formatMoney(Math.abs(liveBalanceMinor))}`}
                active={inputMinor(amount) === Math.abs(liveBalanceMinor)}
                onPress={() => setAmount(String(Math.abs(liveBalanceMinor) / 100))}
              />
            </View>
          )}
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
              ? liveBalanceMinor < 0
                ? '“I owe more” records money in. “I paid them back” records money out of the selected account.'
                : '“They owe more” records money out. “They repaid” records money into the selected account.'
              : 'Balance only adjusts what’s owed. Choose an account if money actually moved.'}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </>
      )}

      {tab === 'history' &&
        (!detailsLoaded ? (
          <Text style={styles.emptyText}>
            {loadError ? 'History unavailable. Tap Retry above.' : 'Loading history…'}
          </Text>
        ) : ledger.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet.</Text>
        ) : (
          <>
            {ledger.map((entry, i) => (
              <Pressable
                key={entry.id}
                style={withPressed(styles.row)}
                onLongPress={() => onDeleteEntry(entry)}
                accessibilityRole="button"
                accessibilityLabel={`${entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid')}, ${formatMoney(Math.abs(dispEntryAmounts[i]), entry.currency)}, ${dayMonthYear(entry.date)}`}
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
                  {formatMoney(Math.abs(dispEntryAmounts[i]), entry.currency)}
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
