import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { getCachedCurrency } from '@/db/settings';
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
import { formatMoney, toMinor } from '@/lib/money';
import { roundedMinor, allocateRoundedMinor } from '@/lib/round';
import { Account, Category, Loan, PersonLedgerEntry } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { SheetTabs } from '@/components/SheetTabs';
import { dayMonthYear } from '@/lib/dateLabels';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { PersonHistory } from './PersonHistory';
import { SettleForm } from './SettleForm';
import { createSettleForm } from './settleFormStore';
import { useStableCallback } from '@/lib/useStableCallback';
import { styles } from './people.styles';
import { errorMessage } from '@/lib/errorMessage';
import { withPressed } from '@/lib/pressed';
import { showAlert } from '@/components/AppDialog';
import { useAccent } from '@/theme/AccentContext';
import { useStacked } from '@/lib/useStacked';

/** One person: their live balance, linked loans, a form to record money either way, and history. */
export function PersonDetailModal({
  person,
  onClose,
  onChanged,
  initialTab = 'settle',
}: {
  person: PersonWithBalance;
  onClose: () => void;
  /** May be async: the sheet waits for it before it finishes. */
  onChanged: () => void | Promise<void>;
  initialTab?: 'settle' | 'history';
}) {
  const { show: showUndo } = useUndoToast();
  const { accent } = useAccent();
  const stacked = useStacked();
  const [ledger, setLedger] = useState<PersonLedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [linkedLoans, setLinkedLoans] = useState<Loan[]>([]);
  // What is typed on the Settle page lives outside the sheet's state: a digit redraws that page, not the sheet.
  const [form] = useState(createSettleForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'settle' | 'history'>(initialTab);

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
      void load();
    }, [load])
  );

  // Derived from the live ledger, not the `person` prop, which is a snapshot from when the modal opened and
  // goes stale once a new entry is recorded.
  const currency = getCachedCurrency();
  // Show each history entry rounded so the running list adds up to the
  // rounded balance shown at the top of the sheet.
  const { dispEntryAmounts, dispBalanceMinor } = useMemo(() => {
    const amounts = new Array<number>(ledger.length);
    for (const code of new Set(ledger.map((e) => e.currency ?? currency))) {
      const indexes = ledger.flatMap((e, i) => ((e.currency ?? currency) === code ? [i] : []));
      const rounded = allocateRoundedMinor(indexes.map((i) => ledger[i].amountMinor));
      indexes.forEach((index, i) => {
        amounts[index] = rounded[i];
      });
    }
    const balance = detailsLoaded
      ? amounts.reduce((sum, v, i) => ((ledger[i].currency ?? currency) === currency ? sum + v : sum), 0)
      : roundedMinor(person.balanceMinor);
    return { dispEntryAmounts: amounts, dispBalanceMinor: balance };
  }, [ledger, currency, detailsLoaded, person.balanceMinor]);

  // "They owe more" (sign 1) with an account means cash left it: recorded as a real expense transaction plus
  // the ledger entry, not a bookkeeping-only IOU. Likewise "They repaid" (sign -1) is real income into it.
  const record = async (sign: 1 | -1) => {
    if (running.current || !detailsLoaded || loadError) return;
    setError(null);
    const { amount, note, dateIso: date, accountId } = form.get();
    const amountMinor = toMinor(parseFloat(amount || '0'));
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    running.current = true;
    setSaving(true);
    try {
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
      form.clear();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
      running.current = false;
      return;
    }
    // The entry is saved. A failed refresh must not read as a failed save, or a retry would record it twice.
    try {
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
      // The entry is gone, so a failed refresh must not hide the Undo or read as a failed delete.
      await load();
      try {
        await onChanged();
      } catch {
        // The parent refreshes again on focus.
      }
      showUndo(`Deleted ${entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid')}`, async () => {
        await restoreLedgerEntry(snapshot);
        await load();
        await onChanged();
      });
    } catch (e) {
      showAlert('Couldn’t delete entry', errorMessage(e));
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
      void runDeleteEntry(entry);
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

  // One function for the history's rows and menu, so they are not drawn again for each render of the sheet.
  const onDelete = useStableCallback(onDeleteEntry);

  return (
    <ModalSheet
      dismissible={!saving}
      visible
      title="Friends & family"
      onClose={saving ? () => {} : onClose}
      footer={
        tab === 'history' ? (
          <PrimaryButton
            title="Settle up"
            onPress={() => setTab('settle')}
            disabled={saving || !detailsLoaded || !!loadError}
          />
        ) : (
          // Worded from where the balance stands: when you owe them, paying back is the main action.
          <View style={[f.footerRow, stacked && styles.footerStack]}>
            {dispBalanceMinor < 0 ? (
              <>
                <PrimaryButton
                  loading={saving}
                  title={saving ? 'Saving…' : 'I owe more'}
                  variant="secondary"
                  onPress={() => record(-1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={[f.footerBtn, stacked && styles.footerStackButton]}
                />
                <PrimaryButton
                  loading={saving}
                  title={saving ? 'Saving…' : 'I paid them back'}
                  onPress={() => record(1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={[f.footerBtn, stacked && styles.footerStackButton]}
                />
              </>
            ) : (
              <>
                <PrimaryButton
                  loading={saving}
                  title={saving ? 'Saving…' : 'They owe more'}
                  variant="secondary"
                  onPress={() => record(1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={[f.footerBtn, stacked && styles.footerStackButton]}
                />
                <PrimaryButton
                  loading={saving}
                  title={saving ? 'Saving…' : 'They repaid'}
                  onPress={() => record(-1)}
                  disabled={saving || !detailsLoaded || !!loadError}
                  style={[f.footerBtn, stacked && styles.footerStackButton]}
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
      <DraftCard
        hue={
          dispBalanceMinor > 0
            ? theme.colors.secondary
            : dispBalanceMinor < 0
              ? theme.colors.idCoralDeep
              : accent
        }
        icon="account-outline"
        kicker={dispBalanceMinor > 0 ? 'Owes you' : dispBalanceMinor < 0 ? 'You owe' : 'All square'}
        figure={formatMoney(Math.abs(dispBalanceMinor))}
        figureColor={dispBalanceMinor < 0 ? theme.colors.expenseText : undefined}
        per="balance"
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
          <Text style={styles.errorText}>Couldn’t load the latest details: {loadError}</Text>
          <PrimaryButton title="Retry" variant="secondary" compact onPress={load} />
        </>
      )}
      <SheetTabs
        options={[
          { label: 'Settle', value: 'settle' },
          { label: 'History', value: 'history' },
        ]}
        value={tab}
        onChange={setTab}
      />

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
              <View style={styles.detailCopy}>
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
            Tracked separately as a loan, not in the balance above. Tap one to open Loans.
          </Text>
        </>
      )}

      {tab === 'settle' && (
        <SettleForm form={form} accounts={accounts} dispBalanceMinor={dispBalanceMinor} error={error} />
      )}

      {tab === 'history' && (
        <PersonHistory
          ledger={ledger}
          amounts={dispEntryAmounts}
          loaded={detailsLoaded}
          loadError={loadError}
          saving={saving}
          onDelete={onDelete}
        />
      )}
    </ModalSheet>
  );
}
