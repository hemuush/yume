import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { listAccounts, listCategories, listTransactions } from '@/db/ledger';
import { getDefaultCurrency } from '@/db/settings';
import { getCategoryOverview, usualMonthly, CategoryOverview } from '@/db/reports';
import { listBudgetsForMonth, BudgetProgress } from '@/db/budgets';
import { Account, Category, Transaction } from '@/types';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate, parseLocalIsoDate, isIsoDate } from '@/lib/date';
import { ReportWindow, windowRange, windowLabel } from '@/lib/period';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { theme } from '@/constants/theme';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import { ListCard, SummaryCard, SummaryFacts, SummaryTop, summaryFigure } from '@/components/SummaryCard';
import { SCREEN } from '@/components/screenStyles';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { EmptyState } from '@/components/EmptyState';
import { CardRowsSkeleton, SummarySkeleton } from '@/components/ListSkeleton';
import { Section } from '@/components/Section';
import { PeriodRow } from '@/features/reports/PeriodRow';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import { longMonthYear } from '@/lib/dateLabels';
import { useReturnOrPush } from '@/lib/useReturnOrPush';
import { timesLabel } from '@/features/reports/visits';
import { MonthBars } from '@/features/reports/MonthBars';
import { compactMoney } from '@/lib/compactMoney';
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
  const request = useRef(0);
  const scopeKey = `${params.id}|${JSON.stringify(cursor)}|${hideAmounts}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadingScope = loadedKey !== scopeKey;
  useEffect(
    () => () => {
      request.current++;
    },
    []
  );

  const load = useCallback(async () => {
    const call = ++request.current;
    const range = windowRange(cursor);
    const [cats, accs, currency] = await Promise.all([
      listCategories(true),
      listAccounts(true),
      getDefaultCurrency(),
    ]);
    const cat = cats.find((c) => c.id === params.id) ?? null;
    const isCurrentMonth = isThisMonth(cursor);
    const [ov, list, budgets] = await Promise.all([
      cat ? getCategoryOverview(cat.id, cat.kind, range) : Promise.resolve(null),
      cat
        ? listTransactions({
            currency,
            categoryId: cat.id,
            includeSubcategories: true,
            fromDate: range.start,
            toDate: range.end,
            limit: ENTRIES_SHOWN,
          })
        : Promise.resolve([]),
      cat?.kind === 'expense' && isCurrentMonth
        ? listBudgetsForMonth(undefined, hideAmounts)
        : Promise.resolve([]),
    ]);
    if (call !== request.current) return;
    setCategories(cats);
    setAccounts(accs);
    setCategory(cat);
    setOverview(ov);
    setEntries(list);
    setBudget(budgets.find((b) => b.budget.categoryId === cat?.id) ?? null);
    setLoadedKey(scopeKey);
  }, [cursor, params.id, hideAmounts, scopeKey]);
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
  const rootCategory = parent ?? category;
  const loanRepayments = !!rootCategory?.isSystem && rootCategory.name === 'Loan EMI';
  const singleActivityMonth =
    activityMonth === range.start.slice(0, 7) && activityMonth === range.end.slice(0, 7);
  const openActivity = () => router.navigate(`/transactions?category=${params.id}&month=${activityMonth}`);
  const openParent = () => {
    if (!parent) return;
    const period =
      cursor.granularity === 'custom'
        ? `g=custom&from=${cursor.start}&to=${cursor.end}`
        : `g=${cursor.granularity}&o=${cursor.offset}`;
    router.push(`/category/${parent.id}?${period}`);
  };

  if ((!hasData || loadingScope) && loadError)
    return <ScreenLoadError title="Category" message={loadError} onRetry={() => void reload()} />;

  if (loaded && !loadingScope && !category) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        <SkyHeader title="Category" showBack hideUser wallpaper />
        <EmptyState title="This category no longer exists" />
      </View>
    );
  }

  // A savings or investment category has nothing to show while those amounts are hidden.
  const privateFamily =
    !!rootCategory &&
    categories.some((c) => c.isSensitive && (c.id === rootCategory.id || c.parentId === rootCategory.id));
  if (!loadingScope && hideAmounts && category && privateFamily) {
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
          paddingBottom: Math.max(48, theme.layout.screenScrollPad) + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load this category</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
          </View>
        )}

        {loadingScope || !overview || !category ? (
          <>
            <SummarySkeleton />
            <View style={{ marginTop: 16 }}>
              <CardRowsSkeleton rows={3} />
            </View>
          </>
        ) : (
          <>
            <SummaryCard>
              <SummaryTop
                label={`${spend ? 'Spent' : 'Received'} in ${periodName}`}
                figure={
                  <Text style={summaryFigure} numberOfLines={1} adjustsFontSizeToFit>
                    {formatMoney(overview.totalMinor)}
                  </Text>
                }
                side={
                  parent ? (
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
                  ) : undefined
                }
              />
              <SummaryFacts
                facts={[
                  { label: overview.count === 1 ? 'Entry' : 'Entries', value: String(overview.count) },
                  ...(overview.count > 1
                    ? [{ label: 'Each', value: formatMoney(overview.totalMinor / overview.count) }]
                    : []),
                  ...(overview.totalMinor > 0 && !loanRepayments
                    ? [{ label: 'A day', value: formatMoney(overview.totalMinor / daysSoFar) }]
                    : []),
                ]}
              />
              {overview.refundMinor > 0 && (
                // What it cost is already net of refunds; this says how much came back.
                <Text style={styles.heroRefund}>
                  {formatMoney(overview.spentMinor)} spent, {formatMoney(overview.refundMinor)} came back
                </Text>
              )}
            </SummaryCard>

            <Section
              title="Last 6 months"
              subtitle={usual != null && usual > 0 ? `usually ${compactMoney(usual)}` : undefined}
            >
              <ListCard style={styles.chartCard}>
                <MonthBars months={overview.months} color={category.color} usualMinor={usual} />
              </ListCard>
            </Section>

            {split.length > 1 && (
              <Section title="Where it went">
                <ListCard style={styles.chartCard}>
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
                </ListCard>
              </Section>
            )}

            {spend && (
              <View style={styles.heroAction}>
                {loanRepayments ? (
                  <PrimaryButton
                    title="View loans"
                    variant="secondary"
                    onPress={() => router.push('/loans')}
                  />
                ) : (
                  <PrimaryButton
                    title="What if I cut this?"
                    variant="secondary"
                    onPress={() => router.push(`/whatif?category=${category.id}`)}
                  />
                )}
              </View>
            )}

            {spend && isThisMonth(cursor) && (!loanRepayments || budget) && (
              <Section title="Budget">
                {budget ? (
                  <ListCard>
                    <BudgetRow progress={budget} divider={false} onPress={openBudgets} />
                  </ListCard>
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

            <Section
              title="Latest entries"
              onSeeAll={singleActivityMonth ? openActivity : undefined}
              right={
                !singleActivityMonth ? (
                  <Pressable
                    onPress={openActivity}
                    style={withPressed(styles.activityLink)}
                    accessibilityRole="button"
                    accessibilityLabel={`See ${monthLong(activityMonth)} in Activity`}
                  >
                    <Text style={styles.activityLinkText}>See {monthLong(activityMonth)} in Activity</Text>
                    <Feather name="arrow-right" size={14} color={theme.colors.link} />
                  </Pressable>
                ) : undefined
              }
            >
              {entries.length === 0 ? (
                <Text style={styles.empty}>Nothing in {periodName} yet.</Text>
              ) : (
                <ListCard>
                  {entries.map((tx, i) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      contextCategoryId={category.id}
                      currency={accounts.find((a) => a.id === tx.accountId)?.currency}
                      cat={categories.find((c) => c.id === tx.categoryId)}
                      accountName={accountName}
                      categoryName={categoryName}
                      divider={i > 0}
                      onPress={() => setDetailTx(tx)}
                    />
                  ))}
                </ListCard>
              )}
            </Section>
          </>
        )}
      </ReanimatedAnimated.ScrollView>
      {/* Over the page, with the period control in its band; it shrinks as the page scrolls. */}
      <SkyHeader
        title={category && category.id === params.id ? category.name : 'Category'}
        showBack
        hideUser
        wallpaper
        collapse={collapse}
        summary={
          !loadingScope && overview ? (
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  chartCard: { padding: 14 },
  heroRefund: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.incomeText,
    paddingHorizontal: 2,
  },
  heroAction: { marginHorizontal: SCREEN.gutter, marginTop: 12 },
  noLimit: {
    marginHorizontal: SCREEN.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  noLimitText: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  activityLink: { minHeight: 44, maxWidth: '55%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityLinkText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.link,
  },
  parentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    maxWidth: '100%',
  },
  parentPillText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  empty: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginHorizontal: SCREEN.gutter,
  },
  errorBanner: {
    marginHorizontal: SCREEN.gutter,
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
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
});
