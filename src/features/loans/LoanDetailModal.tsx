import { useCallback, useState } from 'react';
import { View, Text, Pressable, Animated, Alert } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import {
  getLoanSchedule,
  payInstallment,
  getLoanById,
  deleteLoan,
  restoreLoan,
  getLoanRateHistory,
  LoanRateChange,
} from '@/db/loans';
import { listAccounts, listCategories } from '@/db/ledger';
import { formatMoney } from '@/lib/money';
import { allocateRoundedMinor } from '@/lib/round';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { usePressScale } from '@/lib/usePressScale';
import { Loan, LoanPayment, Account, Category } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { modalFooterStyles as f, theme } from '@/constants/theme';
import { toLocalIsoDate, partsToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { NeoTile } from '@/components/NeoTile';
import { styles } from './loans.styles';
import { AssetModal } from './AssetModal';
import { AccountModal } from './AccountModal';
import { RateChangeModal } from './RateChangeModal';
import { PrepayModal } from './PrepayModal';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LoanDetailModal({
  loan,
  onClose,
  onChanged,
}: {
  loan: Loan;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { show: showUndo } = useUndoToast();
  const [liveLoan, setLiveLoan] = useState<Loan>(loan);
  const [schedule, setSchedule] = useState<LoanPayment[]>([]);
  const [rateHistory, setRateHistory] = useState<LoanRateChange[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payVisible, setPayVisible] = useState(false);
  const [prepayVisible, setPrepayVisible] = useState(false);
  const [rateChangeVisible, setRateChangeVisible] = useState(false);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paidDone, setPaidDone] = useState(false);
  const [moreActionsVisible, setMoreActionsVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  // The date actually paid — defaults to the installment's own due date, not
  // "today", so backfilling an EMI that was really paid months ago (common
  // when someone starts using Yume partway through an existing loan)
  // records it on the date it actually happened instead of dating every
  // catch-up payment "today" and cluttering the transaction list with a pile
  // of same-day entries that never happened that day.
  const [payYear, setPayYear] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payDay, setPayDay] = useState('');

  const kebabPress = usePressScale();
  const accountRowPress = usePressScale();
  const assetRowPress = usePressScale();
  const expandPress = usePressScale();
  const collapsePress = usePressScale();

  // Re-fetches the loan row itself, not just derived props — after a
  // payment or prepayment, outstandingPrincipalMinor and status change on
  // the loans table, and the `loan` prop is a snapshot from when the modal
  // was opened, so trusting it for display would show stale figures.
  const load = useCallback(async () => {
    try {
      const [freshLoan, sched, history, accs, cats] = await Promise.all([
        getLoanById(loan.id),
        getLoanSchedule(loan.id),
        loan.rateType === 'floating' ? getLoanRateHistory(loan.id) : Promise.resolve([]),
        listAccounts(),
        listCategories(),
      ]);
      if (freshLoan) setLiveLoan(freshLoan);
      setSchedule(sched);
      setRateHistory(history);
      setAccounts(accs);
      // A borrowed-loan repayment is an expense; a lent-loan repayment received
      // is income — only categories of the matching kind are valid here, never
      // a cross-kind fallback (which previously could tag an income transaction
      // with an expense category or vice versa).
      const wantKind = (freshLoan?.direction ?? loan.direction) === 'borrowed' ? 'expense' : 'income';
      setCategories(cats.filter((c) => c.kind === wantKind));
      setLoadError(null);
    } catch (e: any) {
      // Previously unguarded — a transient failure here left accounts/
      // categories empty with no explanation, so Pay/Prepay just looked
      // permanently greyed out (disabled={!defaultAccount || !emiCategory})
      // with no hint why.
      setLoadError(String(e?.message ?? e));
    }
  }, [loan.id, loan.direction, loan.rateType]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const nextInstallment = schedule.find((p) => p.status === 'pending');
  // Distinguishes an on-time/late payment from paying an EMI ahead of its
  // own due date — the "Pay" button otherwise accepted either identically,
  // silently letting an installment be marked paid weeks or months early
  // with no signal that it wasn't actually due, and no path through the
  // dedicated "Prepay" flow (which is for extra principal, not an early EMI).
  const todayIso = toLocalIsoDate(new Date());
  const isPayingEarly = !!nextInstallment && nextInstallment.dueDate > todayIso;
  const emiCategory =
    categories.find((c) => c.name === 'Loan EMI' || c.name === 'Loan Repayment') ?? categories[0] ?? null;
  // If the account this loan was originally linked to was since deleted, this
  // silently substitutes whatever account happens to be first in the list —
  // `linkedAccountMissing` below surfaces that instead of debiting the wrong
  // account with no explanation.
  const linkedAccountMissing =
    !!liveLoan.linkedAccountId && !accounts.some((a) => a.id === liveLoan.linkedAccountId);
  const defaultAccount = liveLoan.linkedAccountId
    ? (accounts.find((a) => a.id === liveLoan.linkedAccountId) ?? accounts[0])
    : accounts[0];

  const openPay = () => {
    if (!nextInstallment) return;
    const d = parseLocalIsoDate(nextInstallment.dueDate);
    setPayYear(String(d.getFullYear()));
    setPayMonth(String(d.getMonth() + 1));
    setPayDay(String(d.getDate()));
    setPayVisible(true);
  };

  const paidDateIso = partsToIsoDate(payYear, payMonth, payDay);

  const markPaid = async () => {
    if (!nextInstallment || !defaultAccount || !emiCategory || !paidDateIso) return;
    setBusy(true);
    try {
      await payInstallment(nextInstallment.id, {
        accountId: defaultAccount.id,
        categoryId: emiCategory.id,
        paidDate: paidDateIso,
      });
      await load();
      await onChanged();
      // A brief "done" checkmark (PrimaryButton's own `done` prop) before
      // the sheet closes, instead of it vanishing the instant the write
      // finishes — the actual data is already saved by this point, so the
      // extra ~380ms is purely a felt confirmation, nothing riskier.
      setPaidDone(true);
      setTimeout(() => {
        setPaidDone(false);
        setBusy(false);
        setPayVisible(false);
      }, 380);
    } catch (e: any) {
      Alert.alert('Could not record payment', String(e?.message ?? e));
      setBusy(false);
      // Always closes on any outcome, same as before the "done" checkmark
      // delay was added to the success path — an error left the sheet open
      // afterwards, in a stale not-busy state suggesting Confirm was still
      // safe to retry immediately, when the accompanying alert already
      // gives the user the chance to reopen Pay and try again properly.
      setPayVisible(false);
    }
  };

  // Pay is the one thing you do almost every time you open a loan, so it
  // stays as the single visible action; Prepay/Update rate/Delete are real
  // but rare, moved behind "⋯" so a 240-month home loan's detail screen
  // looks exactly as simple as a 6-month one. Rendered via the app's own
  // `ActionSheet` (styled to match the rest of Yume) rather than
  // `Alert.alert` — see that component's own comment for why, and for how
  // it also removes the 3-button ceiling this used to work around by
  // dropping an explicit Cancel row.
  const moreActionItems: ActionSheetItem[] = [];
  if (liveLoan.status === 'active' && nextInstallment) {
    moreActionItems.push({
      key: 'prepay',
      label: 'Make a prepayment',
      icon: 'trending-up',
      onPress: () => setPrepayVisible(true),
    });
  }
  if (liveLoan.status === 'active' && liveLoan.rateType === 'floating') {
    moreActionItems.push({
      key: 'rate',
      label: 'Update interest rate',
      icon: 'percent',
      onPress: () => setRateChangeVisible(true),
    });
  }
  moreActionItems.push({
    key: 'delete',
    label: 'Delete loan',
    icon: 'trash-2',
    destructive: true,
    // A wrapped call, not a direct reference — `confirmDelete` is declared
    // further down this same render, so a direct reference here would be a
    // temporal-dead-zone error; by the time this item is actually clicked
    // (long after this render finished), `confirmDelete` is defined either way.
    onPress: () => confirmDelete(),
  });

  const runDelete = async () => {
    setBusy(true);
    try {
      const snapshot = await deleteLoan(liveLoan.id);
      haptics.warn();
      onChanged();
      onClose();
      showUndo(`Deleted "${liveLoan.counterparty}"`, async () => {
        await restoreLoan(snapshot);
        onChanged();
      });
    } catch (e: any) {
      Alert.alert('Could not delete loan', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  // Deleting a loan always cascades — its whole schedule, any rate-change
  // history, and any disbursement/fee transactions it recorded go with it —
  // so unlike a single transaction or account, this always gets a confirm
  // step before the instant-delete + undo toast that follows.
  const confirmDelete = () => {
    Alert.alert(
      `Delete "${liveLoan.counterparty}"?`,
      'This also removes its payment schedule and any transactions it recorded. You can undo right after, if needed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => runDelete() },
      ]
    );
  };

  const pendingInstallments = schedule.filter((p) => p.status === 'pending');
  const visibleSchedule = scheduleExpanded ? schedule : pendingInstallments.slice(0, 2);
  const hiddenCount = schedule.length - visibleSchedule.length;

  // Round outstanding and asset value the same way they're displayed, then
  // derive equity from those rounded figures so "equity" always equals the
  // asset value minus the outstanding as they appear on screen.
  const toWholeRupee = (minor: number) => Math.round(minor / 100) * 100;
  const dispOutstanding = toWholeRupee(liveLoan.outstandingPrincipalMinor);
  const dispAssetValue = toWholeRupee(liveLoan.assetValueMinor ?? 0);
  const dispEquity = dispAssetValue - dispOutstanding;

  return (
    <>
      <ModalSheet
        visible
        onClose={onClose}
        title={liveLoan.counterparty}
        footer={<PrimaryButton title="Close" variant="secondary" onPress={onClose} disabled={busy} />}
      >
        {loadError && <Text style={styles.errorText}>Couldn't load the latest details: {loadError}</Text>}

        {/* A neutral card with the same red/green direction rail as the
              loan's card in the list — everything but Pay lives behind "⋯"
              now, so this reads the same whether it's a 6-month loan or a
              240-month one. */}
        <NeoTile
          style={[
            styles.detailHero,
            liveLoan.direction === 'borrowed' ? styles.cardRailBorrowed : styles.cardRailLent,
          ]}
        >
          <View style={styles.detailHeroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSub}>
                {(liveLoan.interestRateAnnualBp / 100).toFixed(2)}% ·{' '}
                {liveLoan.rateType === 'floating' ? 'Floating' : 'Fixed'} · {liveLoan.status}
              </Text>
            </View>
            <AnimatedPressable
              onPress={() => setMoreActionsVisible(true)}
              onPressIn={kebabPress.onPressIn}
              onPressOut={kebabPress.onPressOut}
              hitSlop={10}
              style={[styles.kebabBtn, kebabPress.animatedStyle]}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="More loan actions"
            >
              <Feather name="more-horizontal" size={16} color={theme.colors.ink} />
            </AnimatedPressable>
          </View>
          <View style={styles.cardStatsRow}>
            <View>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(dispOutstanding)}
              </Text>
            </View>
            <View>
              <Text style={styles.statLabel}>EMI</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(liveLoan.emiAmountMinor)}
              </Text>
            </View>
            {nextInstallment && (
              <View>
                <Text style={styles.statLabel}>Next due</Text>
                <Text style={styles.statValue}>{nextInstallment.dueDate}</Text>
              </View>
            )}
          </View>
        </NeoTile>

        <AnimatedPressable
          onPress={() => setAccountModalVisible(true)}
          onPressIn={accountRowPress.onPressIn}
          onPressOut={accountRowPress.onPressOut}
          style={[styles.assetRow, accountRowPress.animatedStyle]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>EMI account</Text>
            <Text style={styles.rowSub}>
              {defaultAccount ? `${defaultAccount.name} · tap to change` : 'Add an account first'}
            </Text>
          </View>
          <Text style={styles.viewAllText}>Change ›</Text>
        </AnimatedPressable>

        {liveLoan.direction === 'borrowed' && (
          <AnimatedPressable
            onPress={() => setAssetModalVisible(true)}
            onPressIn={assetRowPress.onPressIn}
            onPressOut={assetRowPress.onPressOut}
            style={[styles.assetRow, assetRowPress.animatedStyle]}
          >
            {liveLoan.assetValueMinor ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{liveLoan.assetLabel || 'Asset'}</Text>
                  <Text style={styles.rowSub}>Value {formatMoney(dispAssetValue)} · tap to update</Text>
                </View>
                <Text style={[styles.rowValue, dispEquity >= 0 ? styles.income : styles.expense]}>
                  {formatMoney(dispEquity)} equity
                </Text>
              </>
            ) : liveLoan.assetLabel ? (
              // A label was saved with no value yet (value is optional) —
              // shown distinctly from "nothing tracked at all" so it's
              // clear there's something to finish, not just an unused prompt.
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{liveLoan.assetLabel}</Text>
                <Text style={styles.rowSub}>No value set yet · tap to add one</Text>
              </View>
            ) : (
              <Text style={styles.viewAllText}>+ Track what this loan financed (home, car) ›</Text>
            )}
          </AnimatedPressable>
        )}

        {liveLoan.status === 'active' && nextInstallment && (
          <PrimaryButton
            title={
              busy
                ? 'Recording...'
                : isPayingEarly
                  ? `Pay #${nextInstallment.installmentNumber} early`
                  : `Pay #${nextInstallment.installmentNumber} — ${formatMoney(nextInstallment.emiAmountMinor)}`
            }
            onPress={openPay}
            disabled={busy || !defaultAccount || !emiCategory}
            style={{ marginTop: 12 }}
          />
        )}
        {!defaultAccount && (
          <Text style={styles.hintText}>Add an account first to record payments against this loan.</Text>
        )}
        {!!defaultAccount && !emiCategory && (
          <Text style={styles.hintText}>
            Add an {liveLoan.direction === 'borrowed' ? 'expense' : 'income'} category first — payments need
            one to record against.
          </Text>
        )}
        {linkedAccountMissing && defaultAccount && (
          <Text style={styles.hintText}>
            This loan's original account was deleted — payments will go through {defaultAccount.name} instead.
          </Text>
        )}

        <Text style={styles.sectionTitle}>{scheduleExpanded ? 'Full schedule' : 'Next up'}</Text>
        {visibleSchedule.map((p) => {
          // Show the principal and interest split rounded so it adds up to the
          // rounded EMI exactly — the stored paise components already sum to
          // emiAmountMinor, this just keeps that true after rounding for
          // display (otherwise "₹274 + ₹783" can read next to a "₹1,056" EMI).
          const [dispPrincipal, dispInterest] = allocateRoundedMinor(
            [p.principalComponentMinor, p.interestComponentMinor],
            p.emiAmountMinor
          );
          return (
            <View key={p.id} style={styles.scheduleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>
                  #{p.installmentNumber} · {p.dueDate}
                </Text>
                <Text style={styles.rowSub}>
                  Principal {formatMoney(dispPrincipal)} · Interest {formatMoney(dispInterest)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.rowValue}>{formatMoney(p.emiAmountMinor)}</Text>
                <Text style={[styles.statusTag, p.status === 'paid' && styles.statusTagPaid]}>
                  {p.status}
                </Text>
              </View>
            </View>
          );
        })}
        {!scheduleExpanded && hiddenCount > 0 && (
          <AnimatedPressable
            onPress={() => {
              haptics.tap();
              setScheduleExpanded(true);
            }}
            onPressIn={expandPress.onPressIn}
            onPressOut={expandPress.onPressOut}
            style={[{ paddingVertical: 10 }, expandPress.animatedStyle]}
          >
            <Text style={styles.viewAllText}>View full schedule ({hiddenCount} more) ›</Text>
          </AnimatedPressable>
        )}
        {scheduleExpanded && (
          <AnimatedPressable
            onPress={() => {
              haptics.tap();
              setScheduleExpanded(false);
            }}
            onPressIn={collapsePress.onPressIn}
            onPressOut={collapsePress.onPressOut}
            style={[{ paddingVertical: 10 }, collapsePress.animatedStyle]}
          >
            <Text style={styles.viewAllText}>Show less ‹</Text>
          </AnimatedPressable>
        )}

        {rateHistory.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Rate history</Text>
            {rateHistory.map((h) => (
              <View key={h.id} style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {(h.oldRateAnnualBp / 100).toFixed(2)}% → {(h.newRateAnnualBp / 100).toFixed(2)}%
                  </Text>
                  <Text style={styles.rowSub}>
                    From {h.effectiveDate} · {h.mode === 'keepTenure' ? 'EMI changed' : 'tenure changed'}
                  </Text>
                </View>
                {h.mode === 'keepTenure' && (
                  <Text style={styles.rowValue}>
                    {formatMoney(h.oldEmiAmountMinor)} → {formatMoney(h.newEmiAmountMinor)}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}
      </ModalSheet>

      {payVisible && nextInstallment && (
        <ModalSheet
          visible
          onClose={() => setPayVisible(false)}
          variant="center"
          scrollable={false}
          title={isPayingEarly ? 'Pay ahead of schedule?' : 'Confirm payment'}
          footer={
            <View style={f.footerCol}>
              {!paidDateIso && <Text style={styles.errorText}>Enter a valid date</Text>}
              <View style={f.footerRow}>
                <PrimaryButton
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setPayVisible(false)}
                  disabled={busy}
                  style={f.footerBtn}
                />
                <PrimaryButton
                  title={busy ? 'Recording...' : isPayingEarly ? 'Pay Early' : 'Confirm'}
                  done={paidDone}
                  onPress={markPaid}
                  disabled={busy || !paidDateIso}
                  style={f.footerBtn}
                />
              </View>
            </View>
          }
        >
          <Text style={styles.cardSub}>
            {formatMoney(nextInstallment.emiAmountMinor)} from {defaultAccount?.name ?? '—'}
          </Text>
          {isPayingEarly && (
            <Text style={styles.hintText}>
              Installment #{nextInstallment.installmentNumber} isn't due until {nextInstallment.dueDate} —
              today is {todayIso}. Marking it paid now records it as complete ahead of schedule. To put extra
              money toward the loan instead, use Prepay.
            </Text>
          )}
          <Text style={styles.fieldLabel}>Actually paid on</Text>
          <View style={styles.dateFieldsRow}>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Day"
                value={payDay}
                onChangeText={setPayDay}
                keyboardType="numeric"
                placeholder="DD"
                style={styles.dateFieldInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Month"
                value={payMonth}
                onChangeText={setPayMonth}
                keyboardType="numeric"
                placeholder="MM"
                style={styles.dateFieldInput}
              />
            </View>
            <View style={{ flex: 1.3 }}>
              <FormInput
                label="Year"
                value={payYear}
                onChangeText={setPayYear}
                keyboardType="numeric"
                placeholder="YYYY"
                style={styles.dateFieldInput}
              />
            </View>
          </View>
          <Text style={styles.hintText}>
            Defaults to this installment's due date — change it if you're catching up on a payment that
            actually happened on a different day.
          </Text>
        </ModalSheet>
      )}

      {prepayVisible && defaultAccount && emiCategory && (
        <PrepayModal
          loan={liveLoan}
          account={defaultAccount}
          categoryId={emiCategory.id}
          onClose={() => setPrepayVisible(false)}
          onDone={async () => {
            setPrepayVisible(false);
            await load();
            await onChanged();
          }}
        />
      )}

      {rateChangeVisible && (
        <RateChangeModal
          loan={liveLoan}
          remainingMonths={pendingInstallments.length}
          onClose={() => setRateChangeVisible(false)}
          onDone={async () => {
            setRateChangeVisible(false);
            await load();
            await onChanged();
          }}
        />
      )}

      {assetModalVisible && (
        <AssetModal
          loan={liveLoan}
          onClose={() => setAssetModalVisible(false)}
          onDone={async () => {
            setAssetModalVisible(false);
            await load();
            await onChanged();
          }}
        />
      )}

      {accountModalVisible && (
        <AccountModal
          accounts={accounts}
          currentAccountId={defaultAccount?.id ?? null}
          onClose={() => setAccountModalVisible(false)}
          onDone={async () => {
            setAccountModalVisible(false);
            await load();
            await onChanged();
          }}
          loanId={liveLoan.id}
        />
      )}

      <ActionSheet
        visible={moreActionsVisible}
        onClose={() => setMoreActionsVisible(false)}
        title="More options"
        items={moreActionItems}
      />
    </>
  );
}
