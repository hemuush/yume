import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFadeIn } from '@/lib/useFadeIn';
import { router, useFocusEffect } from 'expo-router';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { listLoans, getNextDueInstallment, NextDueInstallment } from '@/db/loans';
import { listPeople, PersonWithBalance } from '@/db/people';
import {
  getRangeComparison,
  PeriodComparison,
  findTopGrowingCategory,
  computeTrackedBalance,
} from '@/db/reports';
import { getUserName, getDefaultCurrency } from '@/db/settings';
import { formatMoney } from '@/lib/money';
import { Account, Category, Transaction, Loan } from '@/types';
import { theme, ID_PALETTE } from '@/constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAccent } from '@/theme/AccentContext';
import { EmptyState } from '@/components/EmptyState';
import { SectionLabel } from '@/components/SectionLabel';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { FlatIconBadge } from '@/components/FlatIconBadge';
import { ScallopedEdge } from '@/components/ScallopedEdge';
import { InsightCard } from '@/components/InsightCard';
import { HeaderUserButton, HeaderIconButton } from '@/components/AppHeader';
import { PeriodNavigator } from '@/components/PeriodNavigator';
import {
  CURRENT_PERIOD,
  PeriodCursor,
  periodLabel,
  periodRange,
  previousPeriodLabel,
  previousPeriodRange,
} from '@/lib/period';
import { daysUntilIsoDate } from '@/lib/date';
import { formatPctChange } from '@/lib/format';
import { NeoTile } from '@/components/NeoTile';

const ACCOUNT_ICON: Record<Account['type'], string> = {
  bank: 'bank',
  cash: 'cash',
  wallet: 'wallet',
  credit_card: 'credit-card',
  savings: 'piggy-bank',
};

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/** "today" / "in N days" for a near due date; the actual calendar date once it's far enough out that a raw day-count reads as broken rather than useful (e.g. "due in 1157 days" from a loan whose entered numbers don't add up). */
function dueDateLabel(dateStr: string): string {
  const days = daysUntilIsoDate(dateStr);
  if (days <= 0) return 'today';
  if (days <= 90) return `in ${days} days`;
  return `on ${dateStr}`;
}

export default function DashboardScreen() {
  const { accent, onAccent } = useAccent();
  const insets = useSafeAreaInsets();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [nextDue, setNextDue] = useState<NextDueInstallment | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [cursor, setCursor] = useState<PeriodCursor>(CURRENT_PERIOD);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (c: PeriodCursor) => {
    const range = periodRange(c);
    try {
      const [accs, cats, tx, ln, ppl, cmp, due, name, currency] = await Promise.all([
        listAccounts(),
        listCategories(),
        // Scoped to the same period as the navigator above it — showing the
        // single most-recent transactions regardless of period previously
        // made "Recent Activity" contradict whatever month/year was selected.
        listTransactions({ fromDate: range.start, toDate: range.end, limit: 30 }),
        listLoans(),
        listPeople(),
        getRangeComparison(range, previousPeriodRange(c), c.granularity),
        getNextDueInstallment(),
        getUserName(),
        getDefaultCurrency(),
      ]);
      setAccounts(accs);
      setCategories(cats);
      setRecent(tx);
      // A defaulted loan is still real money owed (or owed to you) — only a
      // 'closed' loan (fully paid off) should ever drop out of these totals.
      // Filtering on 'active' alone silently zeroed out a defaulted loan's
      // liability everywhere on this screen.
      setLoans(ln.filter((l) => l.status !== 'closed'));
      setPeople(ppl);
      setComparison(cmp);
      setNextDue(due);
      setUserNameState(name);
      setDefaultCurrency(currency);
      setLoadError(null);
    } catch (e: any) {
      // Previously an unguarded throw here (e.g. a transient DB error) left
      // the dashboard showing stale data forever with no signal anything was
      // wrong, and left pull-to-refresh's spinner stuck since onRefresh's
      // own `await load(cursor)` never reached its `setRefreshing(false)`.
      setLoadError(String(e?.message ?? e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(cursor);
    }, [load, cursor])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(cursor);
    setRefreshing(false);
  };

  const categoryFor = (id: string | null) => categories.find((c) => c.id === id);

  const totalOutstandingLoans = loans
    .filter((l) => l.direction === 'borrowed')
    .reduce((sum, l) => sum + l.outstandingPrincipalMinor, 0);
  // Same asset-value-aware formula Profile uses — see computeTrackedBalance.
  // Accounts in a non-default currency are excluded (their face values can't
  // be summed against the default currency's).
  const netWorth = computeTrackedBalance({ accounts, loans, people, defaultCurrency });

  const expenseInPeriod = comparison?.current.expenseMinor ?? 0;
  const incomeInPeriod = comparison?.current.incomeMinor ?? 0;
  const savingsInPeriod = comparison?.current.savingsContributionMinor ?? 0;
  // Income − expense − whatever was already moved into savings this period —
  // money you've deliberately parked in savings is spoken for, not still
  // sitting free to allocate, so it no longer counts as "surplus". Withdrawing
  // from savings works the other way: savingsInPeriod goes negative, adding
  // that money back into surplus.
  const surplusInPeriod = incomeInPeriod - expenseInPeriod - savingsInPeriod;
  const expenseChangePct = comparison?.expenseChangePct;
  const comparisonLabel = previousPeriodLabel(cursor);
  const periodName = periodLabel(cursor).toUpperCase();

  const prevSurplus = comparison
    ? comparison.previous.incomeMinor -
      comparison.previous.expenseMinor -
      comparison.previous.savingsContributionMinor
    : 0;
  const surplusChangePct =
    !comparison || prevSurplus === 0
      ? surplusInPeriod === 0
        ? 0
        : null
      : ((surplusInPeriod - prevSurplus) / Math.abs(prevSurplus)) * 100;

  const incomeChangePct = comparison?.incomeChangePct;

  const flynnMessage =
    expenseChangePct == null
      ? {
          icon: '🐦',
          text: "Log a few days of spending and I'll start spotting trends for you.",
          tone: 'default' as const,
        }
      : expenseChangePct <= 0
        ? {
            icon: '🐦',
            text: `you're spending ${formatPctChange(expenseChangePct)} less than ${comparisonLabel} — nice pace.`,
            tone: 'default' as const,
          }
        : {
            icon: '⚠️',
            text: `you're spending ${formatPctChange(expenseChangePct)} more than ${comparisonLabel} — worth a look.`,
            tone: 'warn' as const,
          };

  const hasAlerts =
    nextDue !== null ||
    !!(
      comparison &&
      findTopGrowingCategory(comparison.current.categoryBreakdown, comparison.previous.categoryBreakdown)
    );

  const recentFadeStyle = useFadeIn([recent]);

  return (
    <View style={styles.container}>
      {/* Pinned outside the ScrollView: the identity band and the
          profile/settings pair stay put while the content below scrolls —
          the balance itself now lives in the bento hero tile below, not
          duplicated up here too. */}
      <View style={[styles.headerBand, { backgroundColor: accent, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.brand, { color: onAccent }]}>Flynse</Text>
          <View style={styles.headerActions}>
            <HeaderIconButton
              icon="bell"
              onPress={() => router.push('/notifications')}
              label="Notifications"
              badge={hasAlerts}
            />
            <HeaderUserButton />
            <HeaderIconButton icon="settings" onPress={() => router.push('/settings')} label="Settings" />
          </View>
        </View>
        <Text style={[styles.greet, { color: onAccent, opacity: 0.75 }]} numberOfLines={1}>
          Good {greetingWord()}
          {userName ? `, ${userName}` : ''}
        </Text>
      </View>
      <ScallopedEdge color={accent} height={16} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 60 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PeriodNavigator cursor={cursor} onChange={setCursor} />

        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        {/* Bento grid: the tall hero tile carries the number that matters
            most (Tracked Balance), sized and colored to lead — the small
            tiles beside and below it are supporting detail, not equals. */}
        <View style={styles.bentoRow}>
          <NeoTile backgroundColor={theme.colors.ink} borderRadius={theme.radius.xl} style={styles.heroTile}>
            <Text style={styles.heroLabel}>TRACKED BALANCE</Text>
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(netWorth)}
            </Text>
            <Text style={styles.heroSub}>Cash + loans + people</Text>
          </NeoTile>
          <View style={styles.bentoCol}>
            {/* Teal/sage read as "good news" (income, surplus); coral/gold
                read as "worth a look" (spend, debt) — two related pairs
                instead of four unrelated hues, so the grid reads as one
                considered combination rather than an assortment. */}
            <NeoTile backgroundColor={theme.colors.idCoral} style={styles.smallTile}>
              <View style={[styles.tileIcon, { backgroundColor: theme.colors.idCoralDeep }]}>
                <MaterialCommunityIcons name="cart-outline" size={13} color={theme.colors.white} />
              </View>
              <Text style={styles.smallLabel} numberOfLines={1}>
                SPENT · {periodName}
              </Text>
              <Text style={styles.smallValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(expenseInPeriod)}
              </Text>
              {expenseChangePct != null && (
                <Text style={styles.smallTrend}>
                  {expenseChangePct >= 0 ? '↑' : '↓'} {formatPctChange(expenseChangePct)}
                </Text>
              )}
            </NeoTile>
            <NeoTile backgroundColor={theme.colors.idTeal} style={styles.smallTile}>
              <View style={[styles.tileIcon, { backgroundColor: theme.colors.idTealDeep }]}>
                <MaterialCommunityIcons name="wallet-outline" size={13} color={theme.colors.white} />
              </View>
              <Text style={styles.smallLabel}>INCOME</Text>
              <Text style={styles.smallValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(incomeInPeriod)}
              </Text>
              {incomeChangePct != null && (
                <Text style={styles.smallTrend}>
                  {incomeChangePct >= 0 ? '↑' : '↓'} {formatPctChange(incomeChangePct)}
                </Text>
              )}
            </NeoTile>
          </View>
        </View>
        <View style={styles.bentoRow}>
          <NeoTile backgroundColor={theme.colors.idSage} style={styles.wideTile}>
            <View style={[styles.tileIcon, { backgroundColor: theme.colors.idSageDeep }]}>
              <MaterialCommunityIcons name="chart-donut" size={13} color={theme.colors.white} />
            </View>
            <Text style={styles.smallLabel}>SURPLUS</Text>
            <Text style={styles.smallValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(surplusInPeriod)}
            </Text>
            {surplusChangePct != null && (
              <Text style={styles.smallTrend}>
                {surplusChangePct >= 0 ? '↑' : '↓'} {formatPctChange(surplusChangePct)}
              </Text>
            )}
          </NeoTile>
          <NeoTile backgroundColor={theme.colors.idGold} style={styles.wideTile}>
            <View style={[styles.tileIcon, { backgroundColor: theme.colors.idGoldDeep }]}>
              <MaterialCommunityIcons
                name={totalOutstandingLoans === 0 ? 'weather-sunny' : 'credit-card-outline'}
                size={13}
                color={theme.colors.white}
              />
            </View>
            <Text style={styles.smallLabel}>DEBT LEFT</Text>
            <Text style={styles.smallValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(totalOutstandingLoans)}
            </Text>
            <Text style={styles.smallTrend}>{totalOutstandingLoans === 0 ? '✓ All clear!' : ' '}</Text>
          </NeoTile>
        </View>

        <InsightCard
          icon={flynnMessage.icon}
          boldPrefix="Flynn says:"
          text={flynnMessage.text}
          tone={flynnMessage.tone}
        />

        {nextDue && (
          <NeoTile
            backgroundColor={theme.colors.idGold}
            borderRadius={theme.radius.md}
            style={styles.reminderStrip}
          >
            <Pressable style={styles.reminderInner} onPress={() => router.push('/loans')}>
              <Text style={styles.reminderText} numberOfLines={1}>
                ⏰ {nextDue.counterparty} EMI due {dueDateLabel(nextDue.dueDate)}
              </Text>
              <Text style={styles.reminderAmt}>{formatMoney(nextDue.emiAmountMinor)} ›</Text>
            </Pressable>
          </NeoTile>
        )}

        <SectionLabel color={theme.colors.secondary} tint={theme.colors.secondaryTint}>
          ACCOUNTS
        </SectionLabel>
        {accounts.length === 0 ? (
          <EmptyState title="No accounts yet" subtitle="Add one from the Accounts tab." />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountStrip}
          >
            {accounts.map((acc, i) => {
              const flat = ID_PALETTE[i % ID_PALETTE.length];
              return (
                <NeoTile key={acc.id} backgroundColor={flat} style={styles.accountCard}>
                  <FlatIconBadge name={ACCOUNT_ICON[acc.type] ?? 'credit-card'} />
                  <Text style={styles.accountName} numberOfLines={1}>
                    {acc.name}
                  </Text>
                  <Amount
                    minor={acc.currentBalanceMinor}
                    currency={acc.currency}
                    sensitive={acc.type === 'savings'}
                    style={styles.accountBalance}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text style={styles.accountType}>{acc.type.replace('_', ' ')}</Text>
                </NeoTile>
              );
            })}
          </ScrollView>
        )}

        <SectionLabel color={theme.colors.accent} tint={theme.colors.accentTint}>
          {`ACTIVITY · ${periodName}`}
        </SectionLabel>
        {recent.length === 0 ? (
          <EmptyState
            title="Nothing logged in this period"
            subtitle="Use ‹ › above to check another month."
          />
        ) : (
          <Animated.View style={recentFadeStyle}>
            <NeoTile style={styles.txCard}>
              {recent.map((tx, i) => {
                const cat = categoryFor(tx.categoryId);
                return (
                  <View key={tx.id} style={[styles.txRow, i > 0 && styles.txRowDivider]}>
                    <CategoryIcon
                      name={tx.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
                      color={
                        tx.type === 'transfer'
                          ? theme.colors.secondary
                          : (cat?.color ?? theme.colors.textMuted)
                      }
                    />
                    <View style={styles.txContent}>
                      <Text style={styles.rowLabel} numberOfLines={1}>
                        {cat?.name ?? (tx.type === 'transfer' ? 'Transfer' : tx.note || tx.type)}
                      </Text>
                      <Text style={styles.rowSub}>{tx.date}</Text>
                    </View>
                    <Text
                      style={[
                        styles.rowValue,
                        tx.type === 'income'
                          ? styles.income
                          : tx.type === 'expense'
                            ? styles.expense
                            : undefined,
                      ]}
                    >
                      {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                      <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive} />
                    </Text>
                  </View>
                );
              })}
            </NeoTile>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },

  headerBand: {
    backgroundColor: theme.colors.primary,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: theme.font.display, fontSize: 18, color: theme.colors.ink },
  headerActions: { flexDirection: 'row', gap: 8 },
  greet: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.ink,
    opacity: 0.7,
    marginTop: 14,
  },

  // Bento grid: a tall hero tile (flex 1.4) beside a stacked pair of small
  // tiles (flex 1), then a second row of two equal wide tiles — tile size
  // itself signals which numbers matter most, instead of four equal boxes.
  bentoRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, gap: 10 },
  heroTile: { flex: 1.4, padding: 16, justifyContent: 'center' },
  heroLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.colors.background,
    opacity: 0.6,
  },
  heroValue: { fontFamily: theme.font.monoBold, fontSize: 24, color: theme.colors.background, marginTop: 8 },
  heroSub: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 10.5,
    color: theme.colors.background,
    opacity: 0.55,
    marginTop: 6,
  },
  bentoCol: { flex: 1, gap: 10 },
  smallTile: { flex: 1, padding: 12, justifyContent: 'center' },
  wideTile: { flex: 1, padding: 14 },
  tileIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  smallLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: theme.colors.onFlat,
    opacity: 0.6,
  },
  smallValue: { fontFamily: theme.font.bodyBold, fontSize: 16, color: theme.colors.onFlat, marginTop: 6 },
  smallTrend: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.onFlat,
    opacity: 0.7,
    marginTop: 4,
  },

  reminderStrip: { marginHorizontal: 20, marginTop: 14 },
  reminderInner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderText: {
    flex: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.ink,
    marginRight: 8,
  },
  reminderAmt: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.ink },

  accountStrip: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  accountCard: { width: 150, padding: 14 },
  accountName: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.onFlat, marginTop: 10 },
  accountBalance: { fontFamily: theme.font.bodyBold, fontSize: 16, color: theme.colors.onFlat, marginTop: 8 },
  accountType: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.onFlat,
    opacity: 0.6,
    marginTop: 6,
    textTransform: 'capitalize',
  },

  txCard: { marginHorizontal: 20 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  txRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  txContent: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: theme.font.bodyMedium, fontSize: 14.5, color: theme.colors.textPrimary },
  rowSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowValue: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  income: { color: theme.colors.income },
  expense: { color: theme.colors.expense },
});
