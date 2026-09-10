import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listPeople,
  createPerson,
  getPersonLedger,
  addLedgerEntry,
  recordMoneyGivenToPerson,
  recordMoneyReceivedFromPerson,
  deleteLedgerEntry,
  PersonWithBalance,
} from '@/db/people';
import { listAccounts, listCategories } from '@/db/ledger';
import { listLoansForPerson } from '@/db/loans';
import { formatMoney, toMinor } from '@/lib/money';
import { roundedMinor, allocateRoundedMinor } from '@/lib/round';
import { Account, Category, Loan, PersonLedgerEntry } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { ModalSheet } from '@/components/ModalSheet';
import { Chip } from '@/components/Chip';
import { theme, FLAT_PALETTE } from '@/constants/theme';
import { parseLocalIsoDate, partsToIsoDate } from '@/lib/date';
import { useFadeIn } from '@/lib/useFadeIn';
import { usePressScale } from '@/lib/usePressScale';

function lastActivityLabel(dateStr: string | null): string {
  if (!dateStr) return 'No activity yet';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - parseLocalIsoDate(dateStr).getTime()) / 86400000);
  if (days <= 0) return 'Last: today';
  if (days === 1) return 'Last: yesterday';
  return `Last: ${days} days ago`;
}

/**
 * Friends & Family — informal, interest-free IOUs. Lives here as a section
 * rather than its own screen so it can sit beside formal loans in the
 * Borrowed & Lent tab: both answer the same question ("who owes whom"), and
 * splitting them across a tab and a buried menu made them feel unrelated.
 */
export function PeopleSection() {
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected] = useState<PersonWithBalance | null>(null);
  const listFadeStyle = useFadeIn([people]);

  const load = useCallback(async () => {
    setPeople(await listPeople());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Each person's balance is shown rounded to a whole rupee; the two summary
  // totals are the sum of those rounded balances so they match the list.
  const dispPersonBalance = (p: PersonWithBalance) => roundedMinor(p.balanceMinor);
  const totalOwedToYou = people.reduce((sum, p) => sum + Math.max(0, dispPersonBalance(p)), 0);
  const totalYouOwe = people.reduce((sum, p) => sum + Math.max(0, -dispPersonBalance(p)), 0);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeading}>Informal IOUs</Text>
        <AddButton onPress={() => setAddVisible(true)} label="+ Person" />
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.flatMint }]}>
          <Text style={styles.summaryLabel}>Owed to you</Text>
          <Text style={styles.summaryValue}>{formatMoney(totalOwedToYou)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.flatPink }]}>
          <Text style={styles.summaryLabel}>You owe</Text>
          <Text style={styles.summaryValue}>{formatMoney(totalYouOwe)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {people.length === 0 ? (
          <EmptyState title="No one here yet" subtitle="Add a friend or family member." />
        ) : (
          people.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              color={FLAT_PALETTE[i % FLAT_PALETTE.length]}
              fadeStyle={listFadeStyle}
              onPress={() => setSelected(p)}
            />
          ))
        )}
      </ScrollView>

      <AddPersonModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onCreated={async () => {
          setAddVisible(false);
          await load();
        }}
      />

      {selected && (
        <PersonDetailModal
          person={selected}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await load();
          }}
        />
      )}
    </View>
  );
}

const AnimatedPersonRow = Animated.createAnimatedComponent(Pressable);

function PersonRow({
  person,
  color,
  fadeStyle,
  onPress,
}: {
  person: PersonWithBalance;
  color: string;
  fadeStyle: any;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPersonRow
      style={[styles.row, fadeStyle, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarInitial}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {person.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {lastActivityLabel(person.lastActivityDate)}
        </Text>
      </View>
      <Text
        style={[
          styles.rowValue,
          { color: person.balanceMinor >= 0 ? theme.colors.income : theme.colors.expense },
        ]}
        numberOfLines={1}
      >
        {person.balanceMinor >= 0 ? 'owes you ' : 'you owe '}
        {formatMoney(Math.abs(roundedMinor(person.balanceMinor)))}
      </Text>
    </AnimatedPersonRow>
  );
}

function AddPersonModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    setSaving(true);
    try {
      await createPerson({ name: name.trim() });
      setName('');
      onCreated();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} variant="center" showClose title="New person">
      <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Abhinav" />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.modalActions}>
        <PrimaryButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ flex: 1, marginRight: 8 }}
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Add'}
          onPress={submit}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </ModalSheet>
  );
}

function PersonDetailModal({
  person,
  onClose,
  onChanged,
}: {
  person: PersonWithBalance;
  onClose: () => void;
  onChanged: () => void;
}) {
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
  const today = useMemo(() => new Date(), []);
  const [entryYear, setEntryYear] = useState(String(today.getFullYear()));
  const [entryMonth, setEntryMonth] = useState(String(today.getMonth() + 1));
  const [entryDay, setEntryDay] = useState(String(today.getDate()));
  const entryDateIso = partsToIsoDate(entryYear, entryMonth, entryDay);

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
    if (!entryDateIso) {
      setError('Enter a valid date');
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
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  // Previously there was no way at all to remove a mistaken entry — deleting
  // FROM the ledger side (rather than from Transactions, which only reaches
  // entries that have a linked transaction) covers "just adjust balance"
  // entries too.
  const onDeleteEntry = (entry: PersonLedgerEntry) => {
    Alert.alert(
      'Delete this entry?',
      `${entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid')} · ${formatMoney(Math.abs(entry.amountMinor))} on ${entry.date}.${
        entry.transactionId ? ' Its linked transaction will be removed too.' : ''
      } This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteLedgerEntry(entry.id);
              await load();
              await onChanged();
            } catch (e: any) {
              Alert.alert('Could not delete entry', String(e?.message ?? e));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ModalSheet visible onClose={onClose} title={person.name}>
      <Text
        style={[
          styles.detailBalance,
          { color: liveBalanceMinor >= 0 ? theme.colors.income : theme.colors.expense },
        ]}
      >
        {liveBalanceMinor >= 0 ? 'Owes you ' : 'You owe '}
        {formatMoney(Math.abs(dispBalanceMinor))}
      </Text>

      {linkedLoans.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Linked loans</Text>
          {linkedLoans.map((loan) => (
            <Pressable key={loan.id} style={styles.row} onPress={onClose}>
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
            Separate from the balance above — tracked as a formal loan with its own schedule. Tap to close
            this and open the Loans segment.
          </Text>
        </>
      )}

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

      <Text style={styles.fieldLabel}>Date</Text>
      <View style={styles.dateFieldsRow}>
        <View style={{ flex: 1 }}>
          <FormInput
            label="Day"
            value={entryDay}
            onChangeText={setEntryDay}
            keyboardType="numeric"
            placeholder="DD"
            style={styles.dateFieldInput}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormInput
            label="Month"
            value={entryMonth}
            onChangeText={setEntryMonth}
            keyboardType="numeric"
            placeholder="MM"
            style={styles.dateFieldInput}
          />
        </View>
        <View style={{ flex: 1.3 }}>
          <FormInput
            label="Year"
            value={entryYear}
            onChangeText={setEntryYear}
            keyboardType="numeric"
            placeholder="YYYY"
            style={styles.dateFieldInput}
          />
        </View>
      </View>
      {!entryDateIso && <Text style={styles.errorText}>Enter a valid date</Text>}

      <Text style={styles.fieldLabel}>Did cash actually move?</Text>
      <View style={styles.chipRow}>
        <Chip label="Just adjust balance" active={accountId === null} onPress={() => setAccountId(null)} />
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
          ? 'This will also record a real transaction on that account — expense for "They owe more", income for "They repaid" — so it shows up in Transactions and Reports too.'
          : "This only updates the balance above — no real transaction is created, so it won't appear in Transactions or Reports. Pick an account instead if cash actually moved."}
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.modalActions}>
        <PrimaryButton
          title={saving ? '...' : 'They owe more'}
          variant="secondary"
          onPress={() => record(1)}
          disabled={saving || !entryDateIso}
          style={{ flex: 1, marginRight: 8 }}
        />
        <PrimaryButton
          title={saving ? '...' : 'They repaid'}
          onPress={() => record(-1)}
          disabled={saving || !entryDateIso}
          style={{ flex: 1 }}
        />
      </View>

      <Text style={styles.sectionTitle}>History</Text>
      {ledger.length === 0 ? (
        <Text style={styles.emptyText}>No entries yet.</Text>
      ) : (
        <>
          {ledger.map((entry, i) => (
            <Pressable
              key={entry.id}
              style={styles.row}
              onLongPress={() => onDeleteEntry(entry)}
              disabled={saving}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>
                  {entry.note || (entry.amountMinor >= 0 ? 'Lent' : 'Repaid')}
                </Text>
                <Text style={styles.rowSub}>{entry.date}</Text>
              </View>
              <Text
                style={[
                  styles.rowValue,
                  { color: entry.amountMinor >= 0 ? theme.colors.income : theme.colors.expense },
                ]}
              >
                {entry.amountMinor >= 0 ? '+' : '-'}
                {formatMoney(Math.abs(dispEntryAmounts[i]))}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.hintText}>Hold an entry above to delete it.</Text>
        </>
      )}

      <PrimaryButton title="Close" variant="secondary" onPress={onClose} style={{ marginTop: 16 }} />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
  },
  summaryLabel: { fontSize: 12, color: theme.colors.onFlat, opacity: 0.65, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: theme.colors.onFlat },
  emptyText: { marginHorizontal: 20, color: theme.colors.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: '500' },
  rowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.onFlat },
  rowValue: { fontSize: 14, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeading: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  detailBalance: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalActions: { flexDirection: 'row', marginTop: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dateFieldsRow: { flexDirection: 'row', gap: 10 },
  dateFieldInput: { flex: 1, textAlign: 'center' },
  hintText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 10, lineHeight: 17 },
  errorText: { color: theme.colors.expense, fontSize: 13, marginBottom: 10 },
});
