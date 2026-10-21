import { useSaveOnce } from '@/lib/useSaveOnce';
import { SheetFlow } from '@/components/SheetFlow';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
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
import { roundedMinor } from '@/lib/round';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { Loan, LoanPayment, Account, Category } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ModalSheet, SheetFooter } from '@/components/ModalSheet';
import { InsightDisclosure } from '@/components/InsightCard';
import { SheetCard } from '@/components/SheetCard';
import { SettingsRow } from '@/components/SettingsRow';
import { SheetTabs } from '@/components/SheetTabs';
import { ActionList, ActionSheetItem } from '@/components/ActionSheet';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';
import { toLocalIsoDate } from '@/lib/date';
import { dayMonthYear, weekdayDayMonth } from '@/lib/dateLabels';
import { styles } from './loans.styles';
import { AssetModal } from './AssetModal';
import { AccountModal } from './AccountModal';
import { RateChangeModal } from './RateChangeModal';
import { PrepayModal } from './PrepayModal';
import { spendableAccountsOf, defaultCurrencyAccountsOf } from '@/lib/account';
import { PayInstallmentSheet } from './PayInstallmentSheet';
import { LoanSchedule } from './LoanSchedule';
import { LoanStatGrid } from './LoanStatGrid';
import { isOverdueInstallment, isUnpaidInstallment, nextUnpaidInstallment } from './installmentStatus';
import Svg, { Path } from 'react-native-svg';
import { loanPayoff, payoffMonth, balanceLinePath } from '@/lib/loanPayoff';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

/** The payoff line's drawing box (it stretches to the card's width). */
const PAYOFF_LINE_WIDTH = 300;
const PAYOFF_LINE_HEIGHT = 40;

type LoanDetailProps = {
  loan: Loan;
  onClose: () => void;
  onChanged: () => void;
  startWithPay?: boolean;
  hue?: string;
};

/** A different loan owns a fresh sheet session, including its pending requests and child forms. */
export function LoanDetailModal(props: LoanDetailProps) {
  return (
    <SheetFlow key={props.loan.id}>
      <LoanDetailContent {...props} />
    </SheetFlow>
  );
}

function LoanDetailContent({ loan, onClose, onChanged, startWithPay = false, hue }: LoanDetailProps) {
  const { show: showUndo } = useUndoToast();
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  const [liveLoan, setLiveLoan] = useState<Loan>(loan);
  const [schedule, setSchedule] = useState<LoanPayment[]>([]);
  const [loadedLoanId, setLoadedLoanId] = useState<string | null>(null);
  const detailsLoaded = loadedLoanId === loan.id;
  const [rateHistory, setRateHistory] = useState<LoanRateChange[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payRequested, setPayRequested] = useState(startWithPay);
  const [payment, setPayment] = useState<{
    installment: LoanPayment;
    account: Account;
    categoryId: string;
    linkedAccountMissing: boolean;
  } | null>(null);
  const [prepayVisible, setPrepayVisible] = useState(false);
  const [rateChangeVisible, setRateChangeVisible] = useState(false);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moreActionsVisible, setMoreActionsVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'schedule'>('overview');

  // Re-fetches the loan row, not just derived props: payments/prepayments change outstandingPrincipalMinor
  // and status, and the `loan` prop is a snapshot from open, so using it would show stale figures.
  // Each load takes a ticket; only the latest one may write state, and unmounting voids every ticket, so a
  // slow earlier fetch can't overwrite fresher figures (or set state after close).
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
      const [freshLoan, sched, history, accs, cats] = await Promise.all([
        getLoanById(loan.id),
        getLoanSchedule(loan.id),
        loan.rateType === 'floating' ? getLoanRateHistory(loan.id) : Promise.resolve([]),
        listAccounts(),
        listCategories(),
      ]);
      if (ticket !== loadTicket.current) return;
      if (freshLoan) setLiveLoan(freshLoan);
      setSchedule(sched);
      setLoadedLoanId(loan.id);
      setRateHistory(history);
      // EMIs and prepayments are spending or income, which a savings account can't take.
      setAccounts(defaultCurrencyAccountsOf(spendableAccountsOf(accs)));
      // Borrowed-loan repayment is an expense, a lent-loan repayment received is income: only categories of
      // that kind are valid, never a cross-kind fallback (it could tag income with an expense category).
      const wantKind = (freshLoan?.direction ?? loan.direction) === 'borrowed' ? 'expense' : 'income';
      setCategories(cats.filter((c) => c.kind === wantKind));
      setLoadError(null);
    } catch (e) {
      if (ticket !== loadTicket.current) return;
      // Guarded: a transient failure would leave accounts/categories empty and Pay/Prepay looking permanently
      // greyed out (disabled={!defaultAccount || !emiCategory}) with no hint why.
      setLoadError(errorMessage(e));
    }
  }, [loan.id, loan.direction, loan.rateType]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // The first unpaid EMI, including one already past due (the database keeps those 'pending').
  const nextInstallment = nextUnpaidInstallment(schedule);
  // When it's paid off and what it still costs — from the schedule, so a prepayment or rate change shows at
  // once.
  const payoff = loanPayoff(schedule, liveLoan.outstandingPrincipalMinor);
  // Tells an on-time/late payment from paying an EMI before its due date: otherwise "Pay" accepted both,
  // silently marking an installment paid weeks early; "Prepay" is for extra principal, not an early EMI.
  const todayIso = toLocalIsoDate(new Date());
  const nextOverdue = !!nextInstallment && isOverdueInstallment(nextInstallment, todayIso);
  const isPayingEarly = !!nextInstallment && nextInstallment.dueDate > todayIso;
  // Only the built-in category for this direction (Loan EMI / Loan Repayment): never an arbitrary first one,
  // which would silently misfile the payment. If it's somehow missing, Pay stays off and the hint says why.
  const emiCategoryName = liveLoan.direction === 'borrowed' ? 'Loan EMI' : 'Loan Repayment';
  const emiCategory =
    categories.find((c) => c.name === emiCategoryName && c.isSystem) ??
    categories.find((c) => c.name === emiCategoryName) ??
    null;
  // If the loan's linked account was deleted, this falls back to the first account in the list;
  // `linkedAccountMissing` below surfaces that instead of debiting the wrong account silently.
  const linkedAccountMissing =
    !!liveLoan.linkedAccountId && !accounts.some((a) => a.id === liveLoan.linkedAccountId);
  const defaultAccount = liveLoan.linkedAccountId
    ? (accounts.find((a) => a.id === liveLoan.linkedAccountId) ?? accounts[0])
    : accounts[0];

  const openPay = useCallback(() => {
    const installment = nextUnpaidInstallment(schedule);
    if (liveLoan.status === 'closed' || !installment || !defaultAccount || !emiCategory) return;
    // The parent refreshes after a save. Keep this EMI/account stable until its confirmation closes.
    setPayment({
      installment,
      account: defaultAccount,
      categoryId: emiCategory.id,
      linkedAccountMissing,
    });
  }, [liveLoan.status, schedule, defaultAccount, emiCategory, linkedAccountMissing]);
  useEffect(() => {
    if (!payRequested || !detailsLoaded) return;
    setPayRequested(false);
    openPay();
  }, [payRequested, detailsLoaded, openPay]);

  // Pay is the one frequent action so it stays visible; Prepay/Update rate/Delete are rare, behind "⋯"
  // (shared action list) so a 240-month loan's detail screen looks as simple as a 6-month one.
  const moreActionItems: ActionSheetItem[] = [];
  // Offered only when it can open: it needs an account to pay from and the EMI category, like Pay.
  if (liveLoan.status !== 'closed' && nextInstallment && defaultAccount && emiCategory) {
    moreActionItems.push({
      key: 'prepay',
      // A loan you lent is prepaid by the borrower: you record it.
      label: liveLoan.direction === 'lent' ? 'Record a prepayment' : 'Make a prepayment',
      icon: 'trending-up',
      onPress: () => setPrepayVisible(true),
    });
  }
  if (liveLoan.status !== 'closed' && nextInstallment && liveLoan.rateType === 'floating') {
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
    // A wrapped call, not a direct reference: `confirmDelete` is declared later in this render, so
    // referencing it directly would be a temporal-dead-zone error; by click time it is defined either way.
    onPress: () => confirmDelete(),
  });

  const runDelete = () =>
    runAction(async () => {
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
    });

  // Deleting a loan cascades (schedule, rate-change history, disbursement/fee transactions), so unlike a
  // single transaction or account it always confirms before the instant-delete + undo toast.
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

  const pendingInstallments = schedule.filter(isUnpaidInstallment);
  const paidCount = schedule.filter((p) => p.status === 'paid').length;

  // Round outstanding and asset value as displayed, then derive equity from those rounded figures so equity
  // always equals the displayed asset value minus the displayed outstanding.
  const dispOutstanding = roundedMinor(liveLoan.outstandingPrincipalMinor);
  const dispAssetValue = roundedMinor(liveLoan.assetValueMinor ?? 0);
  const dispEquity = dispAssetValue - dispOutstanding;

  // The loan as a card (coral for money you owe, mint for money lent), then two pages: where it stands, and
  // its schedule. Pay is the footer's one button; Prepay, Update rate and Delete stay behind ⋯.
  const canPay = liveLoan.status !== 'closed' && !!nextInstallment;
  const incompleteSchedule =
    detailsLoaded &&
    liveLoan.status !== 'closed' &&
    liveLoan.outstandingPrincipalMinor > 0 &&
    !payoff.lastDueDate;
  return (
    <>
      <ModalSheet
        flowPage
        size="expanded"
        dismissible={!busy}
        visible={
          !(
            payment ||
            (prepayVisible && defaultAccount && emiCategory) ||
            rateChangeVisible ||
            assetModalVisible ||
            accountModalVisible
          )
        }
        title={moreActionsVisible ? 'Loan actions' : 'Loan details'}
        onClose={moreActionsVisible ? () => setMoreActionsVisible(false) : onClose}
        footer={
          moreActionsVisible ? (
            <PrimaryButton
              title="Back to loan"
              variant="secondary"
              onPress={() => setMoreActionsVisible(false)}
            />
          ) : (
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
                      : `${liveLoan.direction === 'lent' ? 'Receive' : 'Record'} EMI ${nextInstallment.installmentNumber} · ${formatMoney(nextInstallment.emiAmountMinor)}${isPayingEarly ? ' · early' : ''}`
                  }
                  onPress={openPay}
                  disabled={busy || !defaultAccount || !emiCategory}
                  style={f.footerBtn}
                />
              )}
            </SheetFooter>
          )
        }
      >
        {moreActionsVisible ? (
          <ActionList items={moreActionItems} onClose={() => setMoreActionsVisible(false)} />
        ) : (
          <>
            {loadError && (
              <View>
                <Text style={styles.errorText}>Couldn't load the latest details: {loadError}</Text>
                <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
              </View>
            )}

            <SheetCard
              hue={
                hue ?? (liveLoan.direction === 'borrowed' ? theme.colors.idCoralDeep : theme.colors.secondary)
              }
              icon={liveLoan.direction === 'borrowed' ? 'bank-outline' : 'hand-coin-outline'}
              kicker={`${(liveLoan.interestRateAnnualBp / 100).toFixed(2)}% · ${
                liveLoan.rateType === 'floating' ? 'floating' : 'fixed'
              }${liveLoan.status === 'active' ? '' : ` · ${liveLoan.status}`}`}
              amount={formatMoney(dispOutstanding)}
              title={liveLoan.counterparty}
              meta={`EMI ${formatMoney(liveLoan.emiAmountMinor)} a month`}
            />
            <SheetTabs
              variant="pill"
              options={[
                { label: 'Overview', value: 'overview' },
                { label: 'Schedule', value: 'schedule' },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'overview' ? (
              <>
                <LoanStatGrid
                  stats={[
                    {
                      label: 'Next EMI',
                      value: !detailsLoaded
                        ? loadError
                          ? 'Unavailable'
                          : 'Loading…'
                        : nextInstallment
                          ? formatMoney(nextInstallment.emiAmountMinor)
                          : incompleteSchedule
                            ? 'Schedule unavailable'
                            : 'None left',
                      sub: nextInstallment
                        ? `${weekdayDayMonth(nextInstallment.dueDate)}${nextOverdue ? ' · overdue' : ''}`
                        : undefined,
                    },
                    {
                      label: 'EMIs paid',
                      value: !detailsLoaded
                        ? loadError
                          ? 'Unavailable'
                          : 'Loading…'
                        : schedule.length > 0
                          ? `${paidCount} of ${schedule.length}`
                          : '–',
                    },
                    {
                      label: liveLoan.direction === 'borrowed' ? 'Borrowed' : 'Lent',
                      value: formatMoney(liveLoan.principalMinor),
                      sub: `Since ${dayMonthYear(liveLoan.startDate)}`,
                    },
                    {
                      label: liveLoan.direction === 'borrowed' ? 'Interest to pay' : 'Interest to come',
                      value: !detailsLoaded
                        ? loadError
                          ? 'Unavailable'
                          : 'Loading…'
                        : incompleteSchedule
                          ? 'Unavailable'
                          : formatMoney(payoff.interestLeftMinor),
                    },
                  ]}
                />
                {incompleteSchedule && (
                  <Text style={styles.hintText}>
                    The remaining schedule does not show a complete payoff. The outstanding balance is still
                    owed; review the loan data before relying on a payoff date.
                  </Text>
                )}
                {payoff.lastDueDate && (
                  <View style={styles.payoffCard}>
                    <Text style={styles.statLabel}>
                      {liveLoan.direction === 'borrowed' ? 'Debt-free in' : 'Paid back in full by'}
                    </Text>
                    <View style={styles.payoffHeading}>
                      <Text style={styles.payoffMonth}>{payoffMonth(payoff.lastDueDate)}</Text>
                    </View>
                    <View
                      style={styles.repaymentTrack}
                      accessible
                      accessibilityLabel={`${paidCount} of ${schedule.length} installments paid`}
                    >
                      <View
                        style={[
                          styles.repaymentFill,
                          {
                            width: `${schedule.length ? Math.min(100, (paidCount / schedule.length) * 100) : 0}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.forecastDisclosure}>
                      <InsightDisclosure title="Balance forecast">
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
                      </InsightDisclosure>
                    </View>
                  </View>
                )}

                <View style={[h.card, h.cardInSheet]}>
                  <SettingsRow
                    round
                    icon="bank"
                    label={liveLoan.direction === 'lent' ? 'Receiving account' : 'EMI account'}
                    sub={
                      !detailsLoaded
                        ? 'Loading account…'
                        : defaultAccount
                          ? defaultAccount.name
                          : 'Add an account first'
                    }
                    onPress={() => setAccountModalVisible(true)}
                  />
                  {liveLoan.direction === 'borrowed' && (
                    <SettingsRow
                      round
                      icon="home-outline"
                      label={liveLoan.assetLabel || 'What it paid for'}
                      sub={
                        liveLoan.assetValueMinor
                          ? `Worth ${formatMoney(dispAssetValue)} · ${formatMoney(dispEquity)} equity`
                          : liveLoan.assetLabel
                            ? 'No value set yet'
                            : 'Track a home or car this loan financed'
                      }
                      subColor={
                        liveLoan.assetValueMinor && dispEquity < 0 ? theme.colors.expenseText : undefined
                      }
                      onPress={() => setAssetModalVisible(true)}
                      divider
                    />
                  )}
                </View>

                {detailsLoaded && !defaultAccount && (
                  <Text style={styles.hintText}>
                    Add an account first to record payments against this loan.
                  </Text>
                )}
                {detailsLoaded && !!defaultAccount && !emiCategory && (
                  <Text style={styles.hintText}>
                    The built-in "{emiCategoryName}" category is missing — payments need it to record against.
                  </Text>
                )}
                {linkedAccountMissing && defaultAccount && (
                  <Text style={styles.hintText}>
                    This loan's original account is unavailable — payments will go through{' '}
                    {defaultAccount.name} instead.
                  </Text>
                )}
              </>
            ) : (
              <>
                {detailsLoaded ? (
                  <LoanSchedule schedule={schedule} direction={liveLoan.direction} />
                ) : (
                  <Text style={styles.hintText}>
                    {loadError ? 'Schedule unavailable. Try again.' : 'Loading schedule…'}
                  </Text>
                )}

                {rateHistory.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Rate history</Text>
                    {rateHistory.map((r) => (
                      <View key={r.id} style={[styles.scheduleRow, { flexWrap: 'wrap', gap: 8 }]}>
                        <View style={{ flexGrow: 1, flexBasis: 180, minWidth: 0 }}>
                          <Text style={styles.rowLabel}>
                            {(r.oldRateAnnualBp / 100).toFixed(2)}% → {(r.newRateAnnualBp / 100).toFixed(2)}%
                          </Text>
                          <Text style={styles.rowSub}>
                            From {dayMonthYear(r.effectiveDate)} ·{' '}
                            {r.mode === 'keepTenure' ? 'EMI changed' : 'tenure changed'}
                          </Text>
                        </View>
                        {r.mode === 'keepTenure' && (
                          <Text style={[styles.rowValue, { flexShrink: 1 }]}>
                            {formatMoney(r.oldEmiAmountMinor)} → {formatMoney(r.newEmiAmountMinor)}
                          </Text>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ModalSheet>

      {payment && (
        <PayInstallmentSheet
          backLabel="Back to loan"
          installment={payment.installment}
          direction={liveLoan.direction}
          account={payment.account}
          categoryId={payment.categoryId}
          linkedAccountMissing={payment.linkedAccountMissing}
          onClose={() => setPayment(null)}
          onPaid={async () => {
            await load();
            await onChanged();
          }}
        />
      )}

      {prepayVisible && defaultAccount && emiCategory && (
        <PrepayModal
          backLabel="Back to loan"
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
          backLabel="Back to loan"
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
          backLabel="Back to loan"
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
          backLabel="Back to loan"
          accounts={accounts}
          currentAccountId={defaultAccount?.id ?? null}
          direction={liveLoan.direction}
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
