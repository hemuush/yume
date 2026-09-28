import { useCallback, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import {
  getLoanSchedule,
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
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet, SheetFooter } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { SettingsRow } from '@/components/SettingsRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { homeStyles as h } from '@/features/home/homeStyles';
import { toLocalIsoDate } from '@/lib/date';
import { dayMonthYear, weekdayDayMonth } from '@/lib/dateLabels';
import { styles } from './loans.styles';
import { AssetModal } from './AssetModal';
import { AccountModal } from './AccountModal';
import { RateChangeModal } from './RateChangeModal';
import { PrepayModal } from './PrepayModal';
import { PayInstallmentSheet } from './PayInstallmentSheet';
import Svg, { Path } from 'react-native-svg';
import { loanPayoff, payoffMonth, balanceLinePath } from '@/lib/loanPayoff';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

/** The payoff line's drawing box (it stretches to the card's width). */
const PAYOFF_LINE_WIDTH = 300;
const PAYOFF_LINE_HEIGHT = 56;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function LoanDetailModal({
  loan,
  onClose,
  onChanged,
  startWithPay = false,
}: {
  loan: Loan;
  onClose: () => void;
  onChanged: () => void;
  /** Opens straight onto the next EMI's pay sheet (an EMI reminder's "Pay now"). */
  startWithPay?: boolean;
}) {
  const { show: showUndo } = useUndoToast();
  const [liveLoan, setLiveLoan] = useState<Loan>(loan);
  const [schedule, setSchedule] = useState<LoanPayment[]>([]);
  const [rateHistory, setRateHistory] = useState<LoanRateChange[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payVisible, setPayVisible] = useState(startWithPay);
  const [prepayVisible, setPrepayVisible] = useState(false);
  const [rateChangeVisible, setRateChangeVisible] = useState(false);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreActionsVisible, setMoreActionsVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [tab, setTab] = useState<'overview' | 'schedule'>('overview');

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
    } catch (e) {
      // Previously unguarded — a transient failure here left accounts/
      // categories empty with no explanation, so Pay/Prepay just looked
      // permanently greyed out (disabled={!defaultAccount || !emiCategory})
      // with no hint why.
      setLoadError(errorMessage(e));
    }
  }, [loan.id, loan.direction, loan.rateType]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const nextInstallment = schedule.find((p) => p.status === 'pending');
  // When it's paid off and what it still costs — from the schedule, so a prepayment or rate change shows at once.
  const payoff = loanPayoff(schedule, liveLoan.outstandingPrincipalMinor);
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
    if (nextInstallment) setPayVisible(true);
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
    } catch (e) {
      showAlert("Couldn't delete loan", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Deleting a loan always cascades — its whole schedule, any rate-change
  // history, and any disbursement/fee transactions it recorded go with it —
  // so unlike a single transaction or account, this always gets a confirm
  // step before the instant-delete + undo toast that follows.
  const confirmDelete = () => {
    showAlert(
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

  // The calm-sheets sign-off (Direction C): the loan as a card — coral for
  // money you owe, mint for money you lent — then two pages: where it stands,
  // and its schedule. Pay is the footer's one button; Prepay, Update rate and
  // Delete stay behind ⋯, so a 240-month loan looks as simple as a 6-month one.
  const canPay = liveLoan.status === 'active' && !!nextInstallment;
  return (
    <>
      <ModalSheet
        visible
        onClose={onClose}
        footer={
          <SheetFooter
            onMore={() => setMoreActionsVisible(true)}
            moreLabel="More loan actions"
            disabled={busy}
          >
            {canPay && (
              <PrimaryButton
                title={
                  busy
                    ? 'Recording…'
                    : isPayingEarly
                      ? `Pay #${nextInstallment.installmentNumber} early`
                      : `Pay #${nextInstallment.installmentNumber} · ${formatMoney(nextInstallment.emiAmountMinor)}`
                }
                onPress={openPay}
                disabled={busy || !defaultAccount || !emiCategory}
                style={f.footerBtn}
              />
            )}
          </SheetFooter>
        }
      >
        {loadError && <Text style={styles.errorText}>Couldn't load the latest details: {loadError}</Text>}

        <SheetCard
          hue={liveLoan.direction === 'borrowed' ? theme.colors.idCoralDeep : theme.colors.secondary}
          icon={liveLoan.direction === 'borrowed' ? 'bank-outline' : 'hand-coin-outline'}
          kicker={`${(liveLoan.interestRateAnnualBp / 100).toFixed(2)}% · ${
            liveLoan.rateType === 'floating' ? 'floating' : 'fixed'
          }${liveLoan.status === 'active' ? '' : ` · ${liveLoan.status}`}`}
          amount={formatMoney(dispOutstanding)}
          title={liveLoan.counterparty}
          meta={
            nextInstallment
              ? `EMI ${formatMoney(liveLoan.emiAmountMinor)} · next ${weekdayDayMonth(nextInstallment.dueDate)}`
              : `EMI ${formatMoney(liveLoan.emiAmountMinor)}`
          }
        />
        <View style={styles.sheetTabs}>
          <SegmentedControl
            options={[
              { label: 'Overview', value: 'overview' },
              { label: 'Schedule', value: 'schedule' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === 'overview' ? (
          <>
            {payoff.lastDueDate && (
              <View style={styles.payoffCard}>
                <Text style={styles.statLabel}>
                  {liveLoan.direction === 'borrowed' ? 'Debt-free in' : 'Paid back in full by'}
                </Text>
                <Text style={styles.payoffMonth}>{payoffMonth(payoff.lastDueDate)}</Text>
                <Text style={styles.rowSub}>
                  {payoff.emisLeft} EMI{payoff.emisLeft === 1 ? '' : 's'} to go ·{' '}
                  <Text style={styles.payoffMoney}>{formatMoney(payoff.interestLeftMinor)}</Text> interest
                  still {liveLoan.direction === 'borrowed' ? 'to pay' : 'to come'}
                </Text>
                <Svg
                  width="100%"
                  height={PAYOFF_LINE_HEIGHT}
                  viewBox={`0 0 ${PAYOFF_LINE_WIDTH} ${PAYOFF_LINE_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <Path
                    d={balanceLinePath(payoff.balances, PAYOFF_LINE_WIDTH, PAYOFF_LINE_HEIGHT - 4)}
                    stroke={theme.colors.income}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
                <View style={styles.payoffAxis}>
                  <Text style={styles.rowSub}>Now · {formatMoney(dispOutstanding)} left</Text>
                  <Text style={styles.rowSub}>{payoff.lastDueDate.slice(0, 4)}</Text>
                </View>
              </View>
            )}

            <View style={[h.card, h.cardInSheet]}>
              <SettingsRow
                round
                icon="bank"
                iconBg={theme.colors.primaryTint}
                label="EMI account"
                sub={defaultAccount ? defaultAccount.name : 'Add an account first'}
                onPress={() => setAccountModalVisible(true)}
              />
              {liveLoan.direction === 'borrowed' && (
                <SettingsRow
                  round
                  icon="home-outline"
                  iconBg={theme.colors.idGold}
                  label={liveLoan.assetLabel || 'What it paid for'}
                  sub={
                    liveLoan.assetValueMinor
                      ? `Worth ${formatMoney(dispAssetValue)} · ${formatMoney(dispEquity)} equity`
                      : liveLoan.assetLabel
                        ? 'No value set yet'
                        : 'Track a home or car this loan financed'
                  }
                  subColor={liveLoan.assetValueMinor && dispEquity < 0 ? theme.colors.expense : undefined}
                  onPress={() => setAssetModalVisible(true)}
                  divider
                />
              )}
            </View>

            {!defaultAccount && (
              <Text style={styles.hintText}>Add an account first to record payments against this loan.</Text>
            )}
            {!!defaultAccount && !emiCategory && (
              <Text style={styles.hintText}>
                Add an {liveLoan.direction === 'borrowed' ? 'expense' : 'income'} category first — payments
                need one to record against.
              </Text>
            )}
            {linkedAccountMissing && defaultAccount && (
              <Text style={styles.hintText}>
                This loan's original account was deleted — payments will go through {defaultAccount.name}{' '}
                instead.
              </Text>
            )}
          </>
        ) : (
          <>
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
                      #{p.installmentNumber} · {dayMonthYear(p.dueDate)}
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
                {rateHistory.map((r) => (
                  <View key={r.id} style={styles.scheduleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>
                        {(r.oldRateAnnualBp / 100).toFixed(2)}% → {(r.newRateAnnualBp / 100).toFixed(2)}%
                      </Text>
                      <Text style={styles.rowSub}>
                        From {dayMonthYear(r.effectiveDate)} ·{' '}
                        {r.mode === 'keepTenure' ? 'EMI changed' : 'tenure changed'}
                      </Text>
                    </View>
                    {r.mode === 'keepTenure' && (
                      <Text style={styles.rowValue}>
                        {formatMoney(r.oldEmiAmountMinor)} → {formatMoney(r.newEmiAmountMinor)}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ModalSheet>

      {payVisible && nextInstallment && (
        <PayInstallmentSheet
          installment={nextInstallment}
          account={defaultAccount ?? null}
          categoryId={emiCategory?.id ?? null}
          onClose={() => setPayVisible(false)}
          onPaid={async () => {
            await load();
            await onChanged();
          }}
        />
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
