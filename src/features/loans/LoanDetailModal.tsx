import { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  getLoanSchedule,
  payInstallment,
  getLoanById,
  deleteLoan,
  getLoanRateHistory,
  LoanRateChange,
} from '@/db/loans';
import { listAccounts, listCategories } from '@/db/ledger';
import { formatMoney } from '@/lib/money';
import { allocateRoundedMinor } from '@/lib/round';
import { Loan, LoanPayment, Account, Category } from '@/types';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { toLocalIsoDate, partsToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { NeoTile } from '@/components/NeoTile';
import { styles } from './loans.styles';
import { AssetModal } from './AssetModal';
import { AccountModal } from './AccountModal';
import { RateChangeModal } from './RateChangeModal';
import { PrepayModal } from './PrepayModal';

export function LoanDetailModal({
  loan,
  onClose,
  onChanged,
}: {
  loan: Loan;
  onClose: () => void;
  onChanged: () => void;
}) {
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
    } catch (e: any) {
      Alert.alert('Could not record payment', String(e?.message ?? e));
    } finally {
      setBusy(false);
      setPayVisible(false);
    }
  };

  // Pay is the one thing you do almost every time you open a loan, so it
  // stays as the single visible action; Prepay/Update rate/Delete are real
  // but rare, moved behind "⋯" so a 240-month home loan's detail screen
  // looks exactly as simple as a 6-month one.
  const showMoreActions = () => {
    // Android's native alert dialog supports at most 3 buttons — a 4th is
    // silently dropped rather than shown or wrapped. With an explicit
    // "Cancel" always appended, a floating active loan with a pending
    // installment (prepay + update rate + delete + cancel = 4) lost Cancel
    // entirely, leaving no way to dismiss the sheet except the device back
    // gesture. Dropping the explicit Cancel button and relying on Android's
    // own cancelable-dialog behavior (back button / tap outside) instead
    // keeps every real action visible regardless of how many apply.
    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] =
      [];
    if (liveLoan.status === 'active' && nextInstallment) {
      buttons.push({ text: 'Make a prepayment', onPress: () => setPrepayVisible(true) });
    }
    if (liveLoan.status === 'active' && liveLoan.rateType === 'floating') {
      buttons.push({ text: 'Update interest rate', onPress: () => setRateChangeVisible(true) });
    }
    buttons.push({ text: 'Delete loan', style: 'destructive', onPress: confirmDelete });
    Alert.alert('More options', undefined, buttons, { cancelable: true });
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this loan?',
      "This removes the loan, its schedule, and any disbursement or fee transaction it recorded — for fixing a loan entered with wrong details, not for one that's simply paid off. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteLoan(liveLoan.id);
              await onChanged();
              onClose();
            } catch (e: any) {
              Alert.alert('Could not delete loan', String(e?.message ?? e));
            } finally {
              setBusy(false);
            }
          },
        },
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
      <ModalSheet visible onClose={onClose} title={liveLoan.counterparty}>
        {loadError && <Text style={styles.errorText}>Couldn't load the latest details: {loadError}</Text>}

        {/* Colored by direction, matching the loan's card in the list —
              and everything but Pay lives behind "⋯" now, so this reads the
              same whether it's a 6-month loan or a 240-month one. */}
        <NeoTile
          backgroundColor={liveLoan.direction === 'borrowed' ? theme.colors.idCoral : theme.colors.idTeal}
          style={styles.detailHero}
        >
          <View style={styles.detailHeroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSub}>
                {(liveLoan.interestRateAnnualBp / 100).toFixed(2)}% ·{' '}
                {liveLoan.rateType === 'floating' ? 'Floating' : 'Fixed'} · {liveLoan.status}
              </Text>
            </View>
            <Pressable onPress={showMoreActions} hitSlop={10} style={styles.kebabBtn} disabled={busy}>
              <Text style={styles.kebabText}>⋯</Text>
            </Pressable>
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

        <Pressable onPress={() => setAccountModalVisible(true)} style={styles.assetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>EMI account</Text>
            <Text style={styles.rowSub}>
              {defaultAccount ? `${defaultAccount.name} · tap to change` : 'Add an account first'}
            </Text>
          </View>
          <Text style={styles.viewAllText}>Change ›</Text>
        </Pressable>

        {liveLoan.direction === 'borrowed' && (
          <Pressable onPress={() => setAssetModalVisible(true)} style={styles.assetRow}>
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
          </Pressable>
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
          <Pressable onPress={() => setScheduleExpanded(true)} style={{ paddingVertical: 10 }}>
            <Text style={styles.viewAllText}>View full schedule ({hiddenCount} more) ›</Text>
          </Pressable>
        )}
        {scheduleExpanded && (
          <Pressable onPress={() => setScheduleExpanded(false)} style={{ paddingVertical: 10 }}>
            <Text style={styles.viewAllText}>Show less ‹</Text>
          </Pressable>
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

        <PrimaryButton
          title="Close"
          variant="secondary"
          onPress={onClose}
          style={{ marginTop: 10 }}
          disabled={busy}
        />
      </ModalSheet>

      {payVisible && nextInstallment && (
        <ModalSheet
          visible
          onClose={() => setPayVisible(false)}
          variant="center"
          scrollable={false}
          title={isPayingEarly ? 'Pay ahead of schedule?' : 'Confirm payment'}
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
          {!paidDateIso && <Text style={styles.errorText}>Enter a valid date</Text>}
          <View style={styles.modalActions}>
            <PrimaryButton
              title="Cancel"
              variant="secondary"
              onPress={() => setPayVisible(false)}
              disabled={busy}
              style={{ flex: 1, marginRight: 8 }}
            />
            <PrimaryButton
              title={busy ? 'Recording...' : isPayingEarly ? 'Pay Early' : 'Confirm'}
              onPress={markPaid}
              disabled={busy || !paidDateIso}
              style={{ flex: 1 }}
            />
          </View>
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
    </>
  );
}
