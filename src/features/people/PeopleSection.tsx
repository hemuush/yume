import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import ReanimatedAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
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
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { ModalSheet } from '@/components/ModalSheet';
import { Chip } from '@/components/Chip';
import { theme, FLAT_PALETTE, modalFooterStyles as f } from '@/constants/theme';
import { parseLocalIsoDate, partsToIsoDate } from '@/lib/date';
import { usePressScale } from '@/lib/usePressScale';
import { stableIndexFromId } from '@/lib/color';
import { CountUpAmount } from '@/components/CountUpAmount';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';
import { NeoTile } from '@/components/NeoTile';

// Compact — sits next to the balance on the card now rather than in a full
// sentence at the bottom; the pill above already says who-owes-whom.
function lastActivityShort(dateStr: string | null): string {
  if (!dateStr) return 'No activity';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - parseLocalIsoDate(dateStr).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

/**
 * Friends & Family — informal, interest-free IOUs. Lives here as a section
 * rather than its own screen so it can sit beside formal loans in the
 * Borrowed & Lent screen (Plan → Loans & people): both answer the same question ("who owes whom"), and
 * splitting them across a tab and a buried menu made them feel unrelated.
 */
export function PeopleSection() {
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [selected, setSelected] = useState<PersonWithBalance | null>(null);

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

      {/* Plain figures, not full-colour-fill cards — matches the same fix
          already applied to Loans' own You-owe/Owed-to-you row: colour lives
          on the number itself (green for real money owed to you), not the
          whole tile. Column order and always-on colour also now match
          Loans' summary row exactly, per the signed-off consistency pass. */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryLabel}>You owe</Text>
          <CountUpAmount minor={totalYouOwe} style={[styles.summaryValue, styles.summaryValueExpense]} />
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryLabel}>Owed to you</Text>
          <CountUpAmount minor={totalOwedToYou} style={[styles.summaryValue, styles.summaryValueIncome]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {people.length === 0 ? (
          <EmptyState title="No one here yet" subtitle="Add a friend or family member." />
        ) : (
          people.map((p, i) => (
            <PersonRow
              key={p.id}
              person={p}
              // Stable per-person (hashed from their own id), not per list
              // position — the same fix already applied to AccountChip,
              // MoneyStatCard, Profile's stats, and RuleCard: a colour tied
              // to list order means two people can swap colours just by one
              // of them being renamed (re-sorting the list) or a third
              // person being added ahead of them.
              color={FLAT_PALETTE[stableIndexFromId(p.id, FLAT_PALETTE.length)]}
              index={i}
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

// Rounded to whole rupees first (`dispPersonBalance`'s own rounding, applied
// before this is ever called) — a balance that rounds to exactly 0 reads as
// genuinely settled, not as a still-open debt that merely happens to be
// small. Distinct from PeopleSection's own aggregate You-owe/Owed-to-you
// totals below, which are sums, not a single person's sign, and keep their
// existing always-green/coral treatment.
type PersonStatus = 'owed' | 'owe' | 'settled';
function personStatus(dispBalanceMinor: number): PersonStatus {
  if (dispBalanceMinor === 0) return 'settled';
  return dispBalanceMinor > 0 ? 'owed' : 'owe';
}

const STATUS_PILL: Record<PersonStatus, { bg: string; dot: string; text: string; label: string }> = {
  owed: {
    bg: theme.colors.secondaryTint,
    dot: theme.colors.income,
    text: theme.colors.income,
    label: 'Owes you',
  },
  owe: {
    bg: theme.colors.expenseTint,
    dot: theme.colors.expense,
    text: theme.colors.expense,
    label: 'You owe',
  },
  settled: {
    bg: theme.colors.surfaceAlt,
    dot: theme.colors.textMuted,
    text: theme.colors.textSecondary,
    label: 'Settled',
  },
};

function PersonRow({
  person,
  color,
  index,
  onPress,
}: {
  person: PersonWithBalance;
  color: string;
  index: number;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const dispBalanceMinor = roundedMinor(person.balanceMinor);
  const status = personStatus(dispBalanceMinor);
  const pill = STATUS_PILL[status];
  const balanceColor =
    status === 'settled'
      ? theme.colors.textMuted
      : status === 'owed'
        ? theme.colors.income
        : theme.colors.expense;
  return (
    // Entrance (reanimated) and press-feedback (a plain RN Animated.Value)
    // are two different animation drivers, so the stagger lives on this
    // outer wrapper rather than fighting the press-scale style for the same
    // node — the same split SpendHeatmap's cells use.
    <ReanimatedAnimated.View
      entering={FadeIn.delay(Math.min(index * 45, MAX_LIST_STAGGER_MS))
        .duration(280)
        .springify()
        .reduceMotion(ReduceMotion.System)}
    >
      <NeoTile style={styles.card}>
        <AnimatedPersonRow
          style={animatedStyle}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <View style={styles.cardTop}>
            <View style={styles.who}>
              <View style={[styles.avatar, { backgroundColor: color }]}>
                <Text style={styles.avatarInitial}>{person.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {person.name}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: pill.dot }]} />
                  <Text style={[styles.statusPillText, { color: pill.text }]}>{pill.label}</Text>
                </View>
              </View>
            </View>
            <View style={styles.cardRight}>
              <Text
                style={[styles.cardBalance, { color: balanceColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(Math.abs(dispBalanceMinor))}
              </Text>
              <Text style={styles.cardSub}>{lastActivityShort(person.lastActivityDate)}</Text>
            </View>
          </View>
        </AnimatedPersonRow>
      </NeoTile>
    </ReanimatedAnimated.View>
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
    <ModalSheet
      visible={visible}
      onClose={onClose}
      variant="center"
      showClose
      title="New person"
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
            <PrimaryButton
              title={saving ? 'Saving...' : 'Add'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
        </View>
      }
    >
      <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. Abhinav" />
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
    } catch (e: any) {
      Alert.alert('Could not delete entry', String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  // A "just adjust balance" entry is a single row, deleted instantly like
  // everywhere else — one with a linked transaction cascades (that
  // transaction goes with it, and account balances update immediately), so
  // that case gets an extra confirm step first.
  const onDeleteEntry = (entry: PersonLedgerEntry) => {
    if (!entry.transactionId) {
      runDeleteEntry(entry);
      return;
    }
    Alert.alert(
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
      title={person.name}
      footer={
        <View style={f.footerRow}>
          <PrimaryButton
            title={saving ? '...' : 'They owe more'}
            variant="secondary"
            onPress={() => record(1)}
            disabled={saving || !entryDateIso}
            style={f.footerBtn}
          />
          <PrimaryButton
            title={saving ? '...' : 'They repaid'}
            onPress={() => record(-1)}
            disabled={saving || !entryDateIso}
            style={f.footerBtn}
          />
        </View>
      }
    >
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
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 26, marginBottom: 16 },
  summaryStat: { flex: 1 },
  summaryLabel: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  summaryValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  summaryValueIncome: { color: theme.colors.income },
  summaryValueExpense: { color: theme.colors.expense },
  emptyText: {
    fontFamily: theme.font.body,
    marginHorizontal: 20,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  // Each person's own bordered tile — same spacing/radius Loans' own
  // LoanCard uses, so the two segments of this tab read as one design
  // instead of a card list next to a plain divided list.
  card: { marginHorizontal: 20, marginBottom: 10, padding: 16, borderRadius: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 },
  cardName: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginLeft: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    marginLeft: 12,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusPillText: { fontFamily: theme.font.bodyBold, fontSize: 9.5 },
  cardRight: { alignItems: 'flex-end', flexShrink: 0 },
  cardBalance: { fontSize: 16, fontFamily: theme.font.monoBold },
  cardSub: { fontFamily: theme.font.body, fontSize: 9.5, color: theme.colors.textMuted, marginTop: 2 },
  // Kept for PersonDetailModal's linked-loans and ledger-history rows below
  // (a plain divided list still suits a modal's inner list, unlike the
  // section's own top-level person list above).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  rowSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.onFlat },
  rowValue: { fontFamily: theme.font.monoBold, fontSize: 13.5 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeading: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  detailBalance: { fontFamily: theme.font.monoBold, fontSize: 20, marginBottom: 16 },
  sectionTitle: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dateFieldsRow: { flexDirection: 'row', gap: 10 },
  dateFieldInput: { flex: 1, textAlign: 'center' },
  hintText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 10,
    lineHeight: 17,
  },
  errorText: { fontFamily: theme.font.bodyBold, color: theme.colors.expense, fontSize: 13, marginBottom: 10 },
  historyIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
