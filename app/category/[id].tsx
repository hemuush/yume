import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
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
import { EYEBROW } from '@/constants/textStyles';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import { Glass, GLASS } from '@/components/Glass';
import { frost } from '@/components/Frost';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { Section } from '@/components/Section';
import { PeriodRow } from '@/features/reports/PeriodRow';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { longMonthYear } from '@/lib/dateLabels';
import { useReturnOrPush } from '@/lib/useReturnOrPush';
import { timesLabel } from '@/features/reports/visits';
import { MonthBars, compactMoney } from '@/features/reports/MonthBars';
import { SplitBreakdown } from '@/features/reports/SplitBreakdown';
import { withPressed } from '@/lib/pressed';
import { usePrivacy } from '@/theme/PrivacyContext';
import { inParent } from '@/lib/categoryLabel';

const isThisMonth = (w: ReportWindow) => w.granularity === 'month' && w.offset === 0;

/** Subcategories shown by name; the smaller rest are grouped into one line. */
const SPLIT_SHOWN = 4;
/** Latest entries listed on the page; "See all in Activity" has the rest. */
const ENTRIES_SHOWN = 8;

const monthLong = (key: string) => longMonthYear(`${key}-01`);

/**
 * One category's whole story: period total, budget and pace, where the money went, six months of totals,
 * latest entries, links to What-if and Activity. Follows the incoming period (`g` month/year, `o` offset).
 */
export default function CategoryScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
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
  const { loaded, hasData, loadError, reload } = useScreenLoad(load);

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
  const split = overview?.split ?? [];
  const splitRest = split.slice(SPLIT_SHOWN);
  const splitShown = split.slice(0, splitRest.length === 1 ? SPLIT_SHOWN + 1 : SPLIT_SHOWN);
  // Activity shows one month at a time: a year or a longer custom range
  // opens its latest month (up to today), and the link says which.
  const activityMonth = (range.end < today ? range.end : today).slice(0, 7);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';
  const parent = category?.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
  const openParent = () => {
    if (!parent) return;
    const period =
      cursor.granularity === 'custom'
        ? `g=custom&from=${cursor.start}&to=${cursor.end}`
        : `g=${cursor.granularity}&o=${cursor.offset}`;
    router.push(`/category/${parent.id}?${period}`);
  };

  if (!hasData && loadError)
    return <ScreenLoadError title="Category" message={loadError} onRetry={() => void reload()} />;

  if (loaded && !category) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        <SkyHeader title="Category" showBack hideUser wallpaper />
        <EmptyState title="This category no longer exists" />
      </View>
    );
  }

  // A savings or investment category has nothing to show while those amounts are hidden.
  if (hideAmounts && category?.isSensitive) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        <SkyHeader title={category.name} showBack hideUser wallpaper />
        <EmptyState
          title="Hidden for now"
          subtitle="Savings and investment amounts are hidden. You can show them again from Profile."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load this category</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
          </View>
        )}

        {!overview || !category ? (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={3} />
          </View>
        ) : (
          <>
            {/* Frosted glass, as on Home and Plan; the category's colour is in its icon, bars and split. */}
            <Glass radius={28} tone="strong" style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroText}>
                  <Text style={styles.heroLabel}>
                    {spend ? 'Spent' : 'Received'} in {periodName}
                  </Text>
                  <Text style={frost.bigValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(overview.totalMinor)}
                  </Text>
                  {parent && (
                    <Pressable
                      onPress={openParent}
                      hitSlop={8}
                      style={withPressed(styles.parentPill)}
                      accessibilityRole="link"
                      accessibilityLabel={`In ${parent.name}. Open ${parent.name}`}
                    >
                      <Text style={styles.parentPillText} numberOfLines={1}>
                        {inParent(parent.name)}
                      </Text>
                      <Feather name="chevron-right" size={13} color={theme.colors.textMuted} />
                    </Pressable>
                  )}
                </View>
                <CategoryIcon name={category.icon} color={category.color} />
              </View>
              <View style={styles.chips}>
                <Chip>
                  {overview.count} {overview.count === 1 ? 'entry' : 'entries'}
                </Chip>
                {overview.count > 1 && <Chip>{formatMoney(overview.totalMinor / overview.count)} each</Chip>}
                {overview.totalMinor > 0 && <Chip>{formatMoney(overview.totalMinor / daysSoFar)} a day</Chip>}
                {usual != null && <Chip>usually {formatMoney(usual)} a month</Chip>}
              </View>
              {overview.refundMinor > 0 && (
                // What it cost is already net of refunds; this says how much came back.
                <Text style={styles.heroRefund}>
                  {formatMoney(overview.spentMinor)} spent, {formatMoney(overview.refundMinor)} came back
                </Text>
              )}

              <View style={styles.rule} />
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Last 6 months</Text>
                {usual != null && usual > 0 && (
                  <View style={styles.legend}>
                    <View style={styles.legendLine} />
                    <Text style={styles.legendText}>usually {compactMoney(usual)}</Text>
                  </View>
                )}
              </View>
              <MonthBars months={overview.months} color={category.color} usualMinor={usual} />

              {split.length > 1 && (
                <>
                  <View style={styles.rule} />
                  <Text style={[styles.cardTitle, styles.cardHead]}>Where it went</Text>
                  <SplitBreakdown
                    color={category.color}
                    totalMinor={overview.totalMinor}
                    items={[
                      ...splitShown.map((s) => ({
                        key: s.categoryId,
                        name: s.name,
                        minor: s.totalMinor,
                        count: s.count,
                      })),
                      ...(splitRest.length > 1
                        ? [
                            {
                              key: `rest:${params.id}`,
                              name: splitRest.map((s) => s.name).join(' · '),
                              minor: splitRest.reduce((sum, s) => sum + s.totalMinor, 0),
                              visits: timesLabel(splitRest.reduce((sum, s) => sum + (s.count ?? 0), 0)),
                            },
                          ]
                        : []),
                    ]}
                  />
                </>
              )}
            </Glass>

            {spend && isThisMonth(cursor) && (
              <Section title="Budget">
                {budget ? (
                  <Glass style={styles.glassList}>
                    <BudgetRow progress={budget} divider={false} onPress={openBudgets} jar />
                  </Glass>
                ) : (
                  <Pressable
                    style={withPressed(styles.noLimit)}
                    onPress={openBudgets}
                    accessibilityRole="button"
                  >
                    <Feather name="pie-chart" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.noLimitText}>Set a monthly limit</Text>
                    <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                )}
              </Section>
            )}

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

            <Section title="Latest entries">
              {entries.length === 0 ? (
                <Text style={styles.empty}>Nothing in {periodName} yet.</Text>
              ) : (
                <Glass style={styles.glassList}>
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
                </Glass>
              )}
            </Section>
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      {/* Over the page, with the period control in its band; it shrinks as the page scrolls. */}
      <SkyHeader
        title={category?.name ?? 'Category'}
        showBack
        hideUser
        wallpaper
        collapse={collapse}
        summary={
          overview ? (
            <HeaderSummary
              figure={formatMoney(overview.totalMinor)}
              rest={category?.kind === 'income' ? 'received' : 'spent'}
              dot={category?.kind === 'income' ? theme.colors.slice.saved : theme.colors.slice.spent}
            />
          ) : undefined
        }
      >
        <PeriodRow cursor={cursor} onChange={setCursor} />
      </SkyHeader>

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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{children}</Text>
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
  hero: { marginHorizontal: 20, marginTop: theme.layout.screenTopGap, padding: 16 },
  glassList: { marginHorizontal: 20, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroText: { flex: 1, minWidth: 0 },
  heroLabel: { ...EYEBROW },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
  heroRefund: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12.5,
    color: theme.colors.incomeText,
    marginTop: 8,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderSoft,
    marginTop: 14,
  },
  cardHead: { marginTop: 12, marginBottom: 8 },
  cardTitle: { ...EYEBROW },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 14, height: 1.5, backgroundColor: theme.colors.ink, opacity: 0.3 },
  legendText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  noLimit: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
  },
  noLimitText: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20, marginTop: 18 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fillStrong,
  },
  parentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginTop: 8,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fillStrong,
    maxWidth: '100%',
  },
  parentPillText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
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
