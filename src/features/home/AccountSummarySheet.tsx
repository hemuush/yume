import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { investRole, investmentIdsOf } from '@/lib/investment';
import { View, StyleSheet, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { getAccountFlow, listTransactions, AccountFlow } from '@/db/ledger';
import { Account, Category, Transaction } from '@/types';
import { theme } from '@/constants/theme';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetFlow } from '@/components/SheetFlow';
import { AccountReservations } from '@/features/goals/AccountReservations';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DraftCard } from '@/components/DraftCard';
import { SheetTabs } from '@/components/SheetTabs';
import { accountHue, accountIcon, accountTypeLabel } from '@/lib/account';
import { useAccent } from '@/theme/AccentContext';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION, timing } from '@/lib/animation';
import { PeriodCursor, periodLabel, periodRange } from '@/lib/period';
import { RecentTransactionRow } from './RecentTransactionRow';
import { parentNameOf } from '@/lib/categoryLabel';
import { withPressed } from '@/lib/pressed';
import { getCardCycle, AccountCardCycle } from '@/db/cardCycles';
import { cardUsage, HIGH_USE_PCT } from '@/lib/cardUsage';
import { PaceBar } from '@/components/Frost';
import { dayMonth } from '@/lib/dateLabels';
import { EYEBROW } from '@/constants/textStyles';
import { listValuations, Valuation } from '@/db/valuations';
import { listRecurringRules } from '@/db/recurring';
import { InvestmentPanel, NextSip } from '@/features/investments/InvestmentPanel';
import { UpdateValueSheet } from '@/features/investments/UpdateValueSheet';
import { toLocalIsoDate } from '@/lib/date';

/**
 * Read-only peek at one account: balance, in/out bars (real vs own-account transfers), net, bill, entries.
 * Editing lives in AccountDetailModal. Hide-amounts masks a savings balance and its in/out too.
 */
export function AccountSummarySheet({
  account: accountProp,
  cursor,
  accounts,
  categories,
  onClose,
  onAdd,
  onEdit,
  onSeeAll,
  onPayBill,
  onAddCharge,
  onChanged,
  onInvest,
  onWithdraw,
  onAddSip,
}: {
  account: Account | null;
  cursor: PeriodCursor;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  /** "Add expense here" (or "Transfer from here" for a savings account). */
  onAdd: (account: Account) => void;
  onEdit: (account: Account) => void;
  /** Opens Activity filtered to this account, on the same period. */
  onSeeAll: (account: Account) => void;
  /** A credit card's "Pay bill": opens Add as a transfer into the card for what's left to pay. */
  onPayBill?: (account: Account, amountMinor: number) => void;
  /** A credit card's "Add a card charge": opens Add as an expense on the card, in Fees & Charges when it exists. */
  onAddCharge?: (account: Account, categoryId: string | null) => void;
  /** A value update was saved or deleted — the caller reloads its accounts. */
  onChanged?: () => void;
  /** An investment's "Invest": Add opened as a transfer into it. Without it the footer keeps its old action. */
  onInvest?: (account: Account) => void;
  onWithdraw?: (account: Account) => void;
  /** Opens the recurring-entry sheet for a SIP into this investment. */
  onAddSip?: (account: Account) => void;
}) {
  // Home reloads `accounts` after a value update; follow it so this sheet shows the new figures.
  const account = (accountProp && accounts.find((a) => a.id === accountProp.id)) || accountProp;
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const { hideAmounts } = usePrivacy();
  const { accent } = useAccent();
  const tracked = !!account?.investment;
  const [tab, setTab] = useState<'value' | 'flow' | 'latest'>(tracked ? 'value' : 'flow');
  const [valuations, setValuations] = useState<Valuation[] | null>(null);
  const [nextSip, setNextSip] = useState<NextSip | null>(null);
  const [valueSheet, setValueSheet] = useState<{ valuation: Valuation | null } | null>(null);
  const [flow, setFlow] = useState<AccountFlow | null>(null);
  const [latest, setLatest] = useState<Transaction[] | null>(null);
  // A credit card's bill, when it has a statement day and a due day set.
  const [cycle, setCycle] = useState<AccountCardCycle | null>(null);
  // The figures (flow / latest / bill) couldn't be read — said as such rather than shown as an empty month.
  const [loadError, setLoadError] = useState(false);
  const [cycleError, setCycleError] = useState(false);
  const loadSeq = useRef(0);
  const cycleSeq = useRef(0);

  const accountId = account?.id;
  const valueKey = account?.investment ? `${account.investment.valuedAt}|${account.currentBalanceMinor}` : '';
  const { start, end } = periodRange(cursor);

  // A different account starts on its own first tab; stepping the period keeps the tab you're on.
  const [tabFor, setTabFor] = useState(accountId);
  if (tabFor !== accountId) {
    setTabFor(accountId);
    setTab(tracked ? 'value' : 'flow');
    setCycle(null);
  }

  useEffect(() => {
    if (!accountId) return;
    const seq = ++loadSeq.current;
    setFlow(null);
    setLatest(null);
    setLoadError(false);
    Promise.all([getAccountFlow(accountId, { start, end }), listTransactions({ accountId, limit: 3 })])
      .then(([fl, tx]) => {
        if (seq !== loadSeq.current) return;
        setFlow(fl);
        setLatest(tx);
      })
      .catch(() => {
        if (seq === loadSeq.current) setLoadError(true);
      });
  }, [accountId, start, end]);

  // The bill depends on the card's own statement and due days (and what was spent or paid since), not on the
  // period being browsed — so it reloads when those change, e.g. after the days are edited.
  useEffect(() => {
    if (!account) return;
    const seq = ++cycleSeq.current;
    setCycleError(false);
    getCardCycle(account)
      .then((cy) => {
        if (seq === cycleSeq.current) setCycle(cy);
      })
      .catch(() => {
        if (seq !== cycleSeq.current) return;
        setCycle(null);
        setCycleError(true);
      });
  }, [account]);

  // `accounts` only names the source account of the next SIP, so it is read without re-running the load.
  const accountName = useEffectEvent((id: string) => accounts.find((a) => a.id === id)?.name);
  useEffect(() => {
    if (!accountId || !valueKey) {
      setValuations(null);
      setNextSip(null);
      return;
    }
    let cancelled = false;
    const today = toLocalIsoDate(new Date());
    Promise.all([listValuations(accountId), listRecurringRules()])
      .then(([vals, rules]) => {
        if (cancelled) return;
        setValuations(vals);
        const next = rules
          .filter(
            (r) =>
              r.active &&
              r.type === 'transfer' &&
              r.toAccountId === accountId &&
              !(r.endDate && r.endDate < today)
          )
          .sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate))[0];
        setNextSip(
          next
            ? {
                amountMinor: next.amountMinor,
                date: next.nextRunDate,
                fromName: accountName(next.accountId),
              }
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setValuations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, valueKey]);

  if (!account) return null;
  const inv = account.investment;

  const masked = hideAmounts && account.type === 'savings';
  const money = (minor: number) => formatMaskableMoney(minor, { currency: account.currency, masked });
  const maxFlow = Math.max(flow?.inMinor ?? 0, flow?.outMinor ?? 0);
  const isSavings = account.type === 'savings';
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const unit = cursor.granularity === 'year' ? 'year' : 'month';
  const parts = (own: number, ownLabel: string, moved: number, movedLabel: string) =>
    [own > 0 ? `${ownLabel} ${money(own)}` : null, moved > 0 ? `${movedLabel} ${money(moved)}` : null]
      .filter(Boolean)
      .join(' · ');
  // What a bar was made of, said only when it adds to the amount beside it: both parts when they are mixed, the
  // transfer's name alone when it is all a transfer, and nothing for a plain "Income" or "Spent".
  const detail = (own: number, ownLabel: string, moved: number, movedLabel: string) =>
    own > 0 && moved > 0 ? parts(own, ownLabel, moved, movedLabel) : moved > 0 ? movedLabel : '';
  const net = flow ? flow.inMinor - flow.outMinor : 0;
  const netLine = !flow
    ? ''
    : flow.inMinor === 0 && flow.outMinor === 0
      ? `Nothing moved in or out this ${unit}.`
      : net === 0
        ? 'Everything that came in went out.'
        : net > 0
          ? 'more came in than went out'
          : 'more went out than came in';
  const usage = cardUsage(account);
  const feesCategoryId =
    categories.find((c) => c.kind === 'expense' && !c.archived && c.name === 'Fees & Charges')?.id ?? null;
  const typeLabel = ((t) => t.charAt(0).toUpperCase() + t.slice(1))(accountTypeLabel(account));

  return (
    <SheetFlow key={account.id}>
      <ModalSheet
        flowPage
        size="expanded"
        title="Account details"
        visible={!(valueSheet && inv)}
        onClose={onClose}
        footer={
          <View style={styles.footerRow}>
            <PrimaryButton
              title="Edit account"
              variant="secondary"
              onPress={() => onEdit(account)}
              style={styles.footerBtn}
            />
            <PrimaryButton
              title={inv && onInvest ? 'Invest' : isSavings ? 'Transfer from here' : 'Add expense here'}
              onPress={() => (inv && onInvest ? onInvest(account) : onAdd(account))}
              style={styles.footerBtn}
            />
          </View>
        }
      >
        <DraftCard
          hue={accountHue(account.type, accent)}
          icon={accountIcon(account.type)}
          title={account.name}
          kicker={typeLabel}
          figure={money(account.currentBalanceMinor)}
          per={inv ? 'value' : 'balance'}
          meta={
            inv
              ? inv.valuedAt
                ? `Value · updated ${dayMonth(inv.valuedAt)}${
                    inv.lastValueMinor != null && account.currentBalanceMinor !== inv.lastValueMinor
                      ? `, ${account.currentBalanceMinor > inv.lastValueMinor ? 'plus' : 'minus'} ${money(Math.abs(account.currentBalanceMinor - inv.lastValueMinor))} since`
                      : ''
                  }`
                : 'Value · not updated yet'
              : undefined
          }
        />
        {usage && (
          <View style={styles.usage}>
            <PaceBar
              animKey={`card:${account.id}`}
              pct={Math.min(100, usage.pct)}
              color={
                usage.availableMinor < 0
                  ? theme.colors.expense
                  : usage.high
                    ? theme.colors.slice.due
                    : theme.colors.slice.saved
              }
              accessibilityLabel={`${Math.round(usage.pct)} percent of the credit limit used`}
            />
            <Text style={styles.usageLine}>
              <Text style={styles.usageBold}>{Math.round(usage.pct)}%</Text> of {money(usage.limitMinor)} used
              ·{' '}
              {usage.availableMinor < 0
                ? `${money(-usage.availableMinor)} over the limit`
                : `${money(usage.availableMinor)} available`}
            </Text>
            {usage.high && (
              <Text style={styles.empty}>
                Using more than {HIGH_USE_PCT}% of the limit can lower your credit score.
              </Text>
            )}
          </View>
        )}
        <AccountReservations account={account} onNavigate={onClose} />
        <SheetTabs
          options={[
            ...(inv ? [{ label: 'Value', value: 'value' as const }] : []),
            { label: periodLabel(cursor), value: 'flow' as const },
            { label: 'Latest', value: 'latest' as const },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'value' && inv && (
          <InvestmentPanel
            account={account}
            valuations={valuations}
            nextSip={nextSip}
            masked={masked}
            onUpdate={() => setValueSheet({ valuation: null })}
            onEdit={(v) => setValueSheet({ valuation: v })}
            onWithdraw={onWithdraw ? () => onWithdraw(account) : undefined}
            onAddSip={onAddSip ? () => onAddSip(account) : undefined}
          />
        )}

        {tab === 'flow' && cycleError && <Text style={styles.empty}>Couldn't load this card's bill.</Text>}

        {tab === 'flow' && cycle && (
          <>
            <Text style={styles.label}>Bill</Text>
            <View style={styles.latest}>
              <BillLine
                label={`This cycle · ${dayMonth(cycle.cycleStart)} – ${dayMonth(cycle.cycleEnd)}`}
                value={money(cycle.spentThisCycleMinor)}
              />
              <BillLine
                divider
                label={`Last statement · ${dayMonth(cycle.statementDate)}`}
                value={money(cycle.statementMinor)}
              />
              {cycle.minimumMinor != null && (
                <BillLine divider label="Minimum due" value={money(cycle.minimumMinor)} />
              )}
              <BillLine
                divider
                label="Paid since"
                value={money(cycle.paidSinceMinor)}
                valueColor={theme.colors.incomeText}
              />
              <BillLine
                divider
                label={
                  cycle.leftToPayMinor === 0
                    ? 'Paid in full'
                    : cycle.daysUntilDue < 0
                      ? `Left to pay · was due ${dayMonth(cycle.dueDate)}`
                      : `Left to pay by ${dayMonth(cycle.dueDate)}`
                }
                value={money(cycle.leftToPayMinor)}
                strong
                valueColor={
                  cycle.daysUntilDue < 0 && cycle.leftToPayMinor > 0 ? theme.colors.expenseText : undefined
                }
              />
            </View>
            {cycle.leftToPayMinor > 0 && onPayBill && (
              <PrimaryButton
                title={`Pay bill · ${money(cycle.leftToPayMinor)}`}
                variant="secondary"
                onPress={() => onPayBill(account, cycle.leftToPayMinor)}
                style={styles.payBill}
              />
            )}
            {cycle.leftToPayMinor > 0 &&
              onPayBill &&
              cycle.leftMinimumMinor != null &&
              cycle.leftMinimumMinor > 0 &&
              cycle.leftMinimumMinor < cycle.leftToPayMinor && (
                <>
                  <PrimaryButton
                    title={`Pay minimum · ${money(cycle.leftMinimumMinor)}`}
                    variant="secondary"
                    onPress={() => onPayBill(account, cycle.leftMinimumMinor!)}
                    style={styles.payBill}
                  />
                  <Text style={styles.empty}>
                    Paying only the minimum avoids a late fee, but interest starts on the rest and the
                    interest-free days are lost.
                  </Text>
                </>
              )}
          </>
        )}

        {tab === 'flow' && account.type === 'credit_card' && onAddCharge && (
          <PrimaryButton
            title="Add a card charge"
            variant="secondary"
            onPress={() => onAddCharge(account, feesCategoryId)}
            style={styles.payBill}
          />
        )}

        {tab === 'flow' && loadError && (
          <Text style={styles.empty}>Couldn't load this account's figures.</Text>
        )}

        {tab === 'flow' && !loadError && (
          <>
            <Text style={[styles.label, cycle && styles.sectionGap]}>Money in and out</Text>
            <View style={styles.flows}>
              <FlowRow
                label="In"
                value={flow ? `+${money(flow.inMinor)}` : '…'}
                fraction={flow && maxFlow > 0 ? flow.inMinor / maxFlow : 0}
                ownShare={flow && flow.inMinor > 0 ? flow.incomeMinor / flow.inMinor : 1}
                detail={
                  flow ? detail(flow.incomeMinor, 'Income', flow.transferInMinor, 'from your accounts') : ''
                }
                color={theme.colors.incomeText}
                fillColor={theme.colors.secondary}
              />
              <FlowRow
                label="Out"
                value={flow ? `−${money(flow.outMinor)}` : '…'}
                fraction={flow && maxFlow > 0 ? flow.outMinor / maxFlow : 0}
                ownShare={flow && flow.outMinor > 0 ? flow.expenseMinor / flow.outMinor : 1}
                detail={
                  flow ? detail(flow.expenseMinor, 'Spent', flow.transferOutMinor, 'to your accounts') : ''
                }
                color={theme.colors.expenseText}
                fillColor={theme.colors.idCoralDeep}
              />
            </View>
            {!!netLine && (
              <View style={styles.netRow}>
                <Text style={styles.netLabel}>Net</Text>
                <Text
                  style={[
                    styles.netValue,
                    net > 0 && { color: theme.colors.incomeText },
                    net < 0 && { color: theme.colors.expenseText },
                  ]}
                >
                  {net > 0 ? '+' : net < 0 ? '−' : ''}
                  {money(Math.abs(net))}
                </Text>
                <Text style={styles.netText}>{netLine}</Text>
              </View>
            )}
          </>
        )}

        {tab === 'latest' && loadError && (
          <Text style={styles.empty}>Couldn't load this account's entries.</Text>
        )}
        {tab === 'latest' &&
          !loadError &&
          (latest === null ? null : latest.length === 0 ? (
            <Text style={styles.empty}>Nothing recorded against this account yet.</Text>
          ) : (
            <View style={styles.latest}>
              {latest.map((tx, i) => (
                <RecentTransactionRow
                  key={tx.id}
                  tx={tx}
                  category={categories.find((c) => c.id === tx.categoryId)}
                  parentName={parentNameOf(tx.categoryId, categoriesById)}
                  accountName={nameOf(tx.accountId)}
                  toAccountName={nameOf(tx.toAccountId)}
                  savingsTransfer={
                    tx.type === 'transfer' &&
                    [tx.accountId, tx.toAccountId].some(
                      (id) => accounts.find((a) => a.id === id)?.type === 'savings'
                    )
                  }
                  investRole={investRole(tx, investmentIdsOf(accounts))}
                  divider={i > 0}
                />
              ))}
            </View>
          ))}
        {tab === 'latest' && latest !== null && latest.length > 0 && (
          <Pressable
            onPress={() => onSeeAll(account)}
            style={withPressed(styles.seeAll)}
            accessibilityRole="button"
            accessibilityLabel={`See everything in ${account.name} in Activity`}
          >
            <Text style={styles.seeAllText}>See all in Activity</Text>
            <Feather name="chevron-right" size={14} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </ModalSheet>
      {valueSheet && inv && (
        <UpdateValueSheet
          backLabel="Back to account"
          visible
          account={account}
          valuation={valueSheet.valuation}
          onClose={() => setValueSheet(null)}
          onSaved={() => {
            setValueSheet(null);
            onChanged?.();
          }}
          onDeleted={() => {
            setValueSheet(null);
            onChanged?.();
            onClose();
          }}
        />
      )}
    </SheetFlow>
  );
}

/** One line of a card's bill: what it is on the left, the amount on the right. */
function BillLine({
  label,
  value,
  strong,
  valueColor,
  divider,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueColor?: string;
  /** A hairline above — every line but the first. */
  divider?: boolean;
}) {
  return (
    <View style={[styles.billLine, divider && styles.billDivider]}>
      <Text style={[styles.billLabel, strong && styles.billLabelStrong]}>{label}</Text>
      <Text style={[styles.billValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/**
 * One in/out line: label, bar sized against the larger of the two sides, amount, and what it was made of.
 * Bar is full colour for real income/spending, pale for transfers between your own accounts (pass-through).
 */
function FlowRow({
  label,
  value,
  fraction,
  ownShare,
  detail,
  color,
  fillColor,
}: {
  label: string;
  value: string;
  fraction: number;
  /** 0–1: how much of this bar is real income/spending rather than transfers. */
  ownShare: number;
  detail: string;
  color: string;
  fillColor: string;
}) {
  const reduce = useReduceMotion();
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = reduce ? fraction : withTiming(fraction, timing(MOTION.draw));
  }, [fraction, reduce, grow]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));

  return (
    <View>
      <View style={styles.flowRow}>
        <Text style={styles.flowLabel}>{label}</Text>
        <View style={styles.track}>
          <ReanimatedAnimated.View style={[styles.fill, fillStyle]}>
            <View style={{ flex: ownShare, backgroundColor: fillColor }} />
            <View style={{ flex: 1 - ownShare, backgroundColor: fillColor, opacity: 0.35 }} />
          </ReanimatedAnimated.View>
        </View>
        <Text style={[styles.flowValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {!!detail && <Text style={styles.flowDetail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footerBtn: { flexGrow: 1, flexBasis: 140 },
  label: EYEBROW,
  billLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  billDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  billLabel: {
    flexGrow: 1,
    flexBasis: 140,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  billLabelStrong: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  billValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  payBill: { marginTop: 10 },
  usage: { gap: 6, marginTop: 4 },
  usageLine: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  usageBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  sectionGap: { marginTop: 18 },
  flows: { gap: 8, marginTop: 8 },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flowLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    width: 30,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkWash,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    transformOrigin: 'left',
  },
  flowDetail: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 40,
    marginTop: 2,
  },
  netRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  netLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    width: 30,
  },
  netValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  netText: {
    flexGrow: 1,
    flexBasis: 120,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  flowValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    minWidth: 92,
    textAlign: 'right',
  },
  latest: {
    marginTop: 8,
    marginHorizontal: -4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  empty: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  seeAll: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 8,
  },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
});
