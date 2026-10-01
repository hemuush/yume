import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { getCategoryOverview, usualMonthly, CategoryOverview } from '@/db/reports';
import { listBudgetsForMonth, BudgetProgress } from '@/db/budgets';
import { Account, Category, Transaction } from '@/types';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate, parseLocalIsoDate, isIsoDate } from '@/lib/date';
import { ReportWindow, windowRange, windowLabel } from '@/lib/period';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { theme } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { GrowFill } from '@/components/GrowFill';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h } from '@/features/home/homeStyles';
import { PeriodRow } from '@/features/reports/PeriodRow';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { longMonthYear, shortMonth } from '@/lib/dateLabels';
import { useReturnOrPush } from '@/lib/useReturnOrPush';
import { timesLabel, visitsLine } from '@/features/reports/visits';
import { withPressed } from '@/lib/pressed';
import { usePrivacy } from '@/theme/PrivacyContext';

const isThisMonth = (w: ReportWindow) => w.granularity === 'month' && w.offset === 0;

/** Subcategories shown by name; the smaller rest are grouped into one line. */
const SPLIT_SHOWN = 4;
/** Latest entries listed on the page; "See all in Activity" has the rest. */
const ENTRIES_SHOWN = 8;

const monthLong = (key: string) => longMonthYear(`${key}-01`);
const monthShort = (key: string) => shortMonth(`${key}-01`);

/**
 * One category's whole story in one place — what it came to this period,
 * its budget and pace, where within it the money went, six months of
 * totals, its latest entries, and a way into What-if and Activity. Opened
 * from Reports, a budget row, or an entry's detail; it follows the period
 * you came from (`g` month/year, `o` offset) and has its own period bar.
 */
export default function CategoryScreen() {
  const insets = useSafeAreaInsets();
  // Budgets and this page link to each other: go back to Budgets when it's
  // already open below, rather than stacking another copy.
  const returnOrPush = useReturnOrPush();
  const openBudgets = () => returnOrPush({ name: 'budgets' }, '/budgets');
  const params = useLocalSearchParams<{ id: string; g?: string; o?: string; from?: string; to?: string }>();
  const [cursor, setCursor] = useState<ReportWindow>(() =>
    params.g === 'custom' && isIsoDate(params.from) && isIsoDate(params.to) && params.from <= params.to
      ? { granularity: 'custom', start: params.from, end: params.to }
      : {
          granularity: params.g === 'year' ? 'year' : 'month',
          offset: Math.min(0, Math.trunc(Number(params.o) || 0)),
        }
  );
  const { hideAmounts } = usePrivacy();
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [overview, setOverview] = useState<CategoryOverview | null>(null);
  const [budget, setBudget] = useState<BudgetProgress | null>(null);
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    const range = windowRange(cursor);
    const [cats, accs] = await Promise.all([listCategories(true), listAccounts(true)]);
    const cat = cats.find((c) => c.id === params.id) ?? null;
    setCategories(cats);
    setAccounts(accs);
    setCategory(cat);
    if (!cat) return;
    const isCurrentMonth = isThisMonth(cursor);
    const [ov, list, budgets] = await Promise.all([
      getCategoryOverview(cat.id, cat.kind, range),
      listTransactions({
        categoryId: cat.id,
        includeSubcategories: true,
        fromDate: range.start,
        toDate: range.end,
        limit: ENTRIES_SHOWN,
      }),
      cat.kind === 'expense' && isCurrentMonth
        ? listBudgetsForMonth(undefined, hideAmounts)
        : Promise.resolve([]),
    ]);
    setOverview(ov);
    setEntries(list);
    setBudget(budgets.find((b) => b.budget.categoryId === cat.id) ?? null);
  }, [cursor, params.id, hideAmounts]);
  const { loaded, loadError, reload } = useScreenLoad(load);

  const range = windowRange(cursor);
  const periodName = windowLabel(cursor);
  const spend = category?.kind !== 'income';
  // Days the period has run so far, for the per-day figure.
  const today = toLocalIsoDate(new Date());
  const lastCountedDay = today < range.end ? today : range.end;
  const daysSoFar = Math.max(
    1,
    Math.round(
      (parseLocalIsoDate(lastCountedDay).getTime() - parseLocalIsoDate(range.start).getTime()) / 86400000
    ) + 1
  );
  const usual = overview && cursor.granularity === 'month' ? usualMonthly(overview.months) : null;
  const peak = overview ? Math.max(1, ...overview.months.map((m) => m.totalMinor)) : 1;
  const split = overview?.split ?? [];
  const splitRest = split.slice(SPLIT_SHOWN);
  const splitShown = split.slice(0, splitRest.length === 1 ? SPLIT_SHOWN + 1 : SPLIT_SHOWN);
  // Activity shows one month at a time: a year or a longer custom range
  // opens its latest month (up to today), and the link says which.
  const activityMonth = (range.end < today ? range.end : today).slice(0, 7);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  if (loaded && !category) {
    return (
      <View style={styles.container}>
        <AppHeader title="Category" showBack />
        <EmptyState title="This category no longer exists" />
      </View>
    );
  }

  // A savings or investment category has nothing to show while those amounts are hidden.
  if (hideAmounts && category?.isSensitive) {
    return (
      <View style={styles.container}>
        <AppHeader title={category.name} showBack />
        <EmptyState
          title="Hidden for now"
          subtitle="Savings and investment amounts are hidden. Tap the eye in the header to show them."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title={category?.name ?? 'Category'} showBack />
      <PeriodRow cursor={cursor} onChange={setCursor} />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load this category</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        {!overview || !category ? (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={3} />
          </View>
        ) : (
          <>
            <View style={[h.card, styles.hero]}>
              <View style={styles.heroTop}>
                <CategoryIcon name={category.icon} color={category.color} />
                <Text style={styles.heroLabel}>
                  {spend ? 'Spent' : 'Received'} in {periodName}
                </Text>
              </View>
              <Text style={styles.heroValue}>{formatMoney(overview.totalMinor)}</Text>
              <Text style={styles.heroSub}>
                {overview.count} {overview.count === 1 ? 'entry' : 'entries'}
                {overview.count > 1
                  ? `, about ${formatMoney(overview.totalMinor / overview.count)} each`
                  : ''}
                {overview.totalMinor > 0
                  ? ` · about ${formatMoney(overview.totalMinor / daysSoFar)} a day`
                  : ''}
                {usual != null ? ` · usually ${formatMoney(usual)} a month` : ''}
              </Text>
              {overview.refundMinor > 0 && (
                // What it cost is already net of refunds; this says how much came back.
                <Text style={styles.heroRefund}>
                  {formatMoney(overview.spentMinor)} spent, {formatMoney(overview.refundMinor)} came back
                </Text>
              )}
            </View>

            {spend && isThisMonth(cursor) && (
              <HomeSection title="Budget">
                {budget ? (
                  <View style={h.card}>
                    <BudgetRow progress={budget} divider={false} onPress={openBudgets} />
                  </View>
                ) : (
                  <Pressable
                    style={withPressed([h.card, h.row])}
                    onPress={openBudgets}
                    accessibilityRole="button"
                  >
                    <View style={[h.iconTile, { backgroundColor: theme.colors.primaryTint }]}>
                      <Feather name="pie-chart" size={17} color={theme.colors.ink} />
                    </View>
                    <View style={h.mid}>
                      <Text style={h.title}>Set a monthly limit</Text>
                      <Text style={h.sub}>See how close {category.name} gets, as you go</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </HomeSection>
            )}

            {split.length > 1 && (
              <HomeSection title="Where it went">
                <View style={h.card}>
                  {splitShown.map((s, i) => (
                    <SplitRow
                      key={s.categoryId}
                      animKey={`split:${s.categoryId}`}
                      name={s.name}
                      visits={visitsLine(s.count, s.totalMinor)}
                      minor={s.totalMinor}
                      share={overview.totalMinor > 0 ? s.totalMinor / overview.totalMinor : 0}
                      color={category.color}
                      divider={i > 0}
                    />
                  ))}
                  {splitRest.length > 1 && (
                    <SplitRow
                      animKey={`split-rest:${params.id}`}
                      name={splitRest.map((s) => s.name).join(' · ')}
                      visits={timesLabel(splitRest.reduce((sum, s) => sum + (s.count ?? 0), 0))}
                      minor={splitRest.reduce((sum, s) => sum + s.totalMinor, 0)}
                      share={
                        overview.totalMinor > 0
                          ? splitRest.reduce((sum, s) => sum + s.totalMinor, 0) / overview.totalMinor
                          : 0
                      }
                      color={category.color}
                      divider
                    />
                  )}
                </View>
              </HomeSection>
            )}

            <HomeSection title="By month">
              <View style={[h.card, styles.months]}>
                {overview.months.map((m) => (
                  <View
                    key={m.month}
                    style={styles.monthCol}
                    accessibilityLabel={`${monthShort(m.month)}: ${formatMoney(m.totalMinor)}`}
                  >
                    <View style={styles.monthTrack}>
                      <View
                        style={[
                          styles.monthBar,
                          { height: `${(m.totalMinor / peak) * 100}%`, backgroundColor: category.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.monthLabel}>{monthShort(m.month)}</Text>
                  </View>
                ))}
              </View>
            </HomeSection>

            <View style={styles.actions}>
              {spend && (
                <ActionChip
                  icon="scissors"
                  label="What if I cut this?"
                  onPress={() => router.push(`/whatif?category=${category.id}`)}
                />
              )}
              <ActionChip
                icon="list"
                label={
                  activityMonth === range.start.slice(0, 7) && activityMonth === range.end.slice(0, 7)
                    ? 'See all in Activity'
                    : `See ${monthLong(activityMonth)} in Activity`
                }
                onPress={() =>
                  router.navigate(`/transactions?category=${category.id}&month=${activityMonth}`)
                }
              />
            </View>

            <HomeSection title="Latest entries">
              {entries.length === 0 ? (
                <Text style={styles.empty}>Nothing in {periodName} yet.</Text>
              ) : (
                <View style={h.card}>
                  {entries.map((tx, i) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      cat={categories.find((c) => c.id === tx.categoryId)}
                      accountName={accountName}
                      categoryName={categoryName}
                      divider={i > 0}
                      onPress={() => setDetailTx(tx)}
                    />
                  ))}
                </View>
              )}
            </HomeSection>
          </>
        )}
      </ScrollView>

      <TransactionDetailModal
        tx={detailTx}
        accounts={accounts}
        categories={categories}
        onClose={() => setDetailTx(null)}
        onEdit={(tx) => {
          setDetailTx(null);
          router.push(`/add-transaction?id=${tx.id}`);
        }}
        onChanged={async () => {
          setDetailTx(null);
          await reload();
        }}
      />
    </View>
  );
}

function SplitRow({
  animKey,
  name,
  visits,
  minor,
  share,
  color,
  divider,
}: {
  /** Remembers the bar's last width across visits (useGrowFrom). */
  animKey: string;
  name: string;
  /** How often and the usual amount each time — see visitsLine. */
  visits?: string;
  minor: number;
  share: number;
  color: string;
  divider: boolean;
}) {
  return (
    <View style={[styles.split, divider && h.divider]}>
      <View style={styles.splitTop}>
        <View style={styles.splitNames}>
          <Text style={styles.splitName} numberOfLines={1}>
            {name}
          </Text>
          {!!visits && <Text style={styles.splitVisits}>{visits}</Text>}
        </View>
        <Text style={styles.splitValue}>{formatMoney(minor)}</Text>
      </View>
      <View style={styles.splitTrack}>
        <GrowFill
          animKey={animKey}
          pct={Math.round(share * 100)}
          style={[styles.splitFill, { backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={withPressed(styles.actionChip)} accessibilityRole="button">
      <Feather name={icon} size={14} color={theme.colors.ink} />
      <Text style={styles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  hero: { marginTop: theme.layout.screenTopGap, padding: 16, gap: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  heroValue: { fontFamily: theme.font.monoBold, fontSize: 27, color: theme.colors.textPrimary, marginTop: 6 },
  heroSub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
  heroRefund: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12.5,
    color: theme.colors.incomeText,
    marginTop: 2,
  },
  split: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  splitTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  splitNames: { flex: 1, minWidth: 0 },
  splitName: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  splitVisits: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 1 },
  splitValue: { fontFamily: theme.font.monoBold, fontSize: 12.5, color: theme.colors.textPrimary },
  splitTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  splitFill: { height: '100%', borderRadius: theme.radius.pill },
  months: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 16, height: 150 },
  monthCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  monthTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  monthBar: { width: '100%', borderRadius: 6, minHeight: 2 },
  monthLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginTop: 18 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  actionChipText: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textPrimary },
  empty: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginHorizontal: 20 },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
});
