import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appear } from '@/components/Appear';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SCREEN } from '@/components/screenStyles';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { HeaderSummary, SkyHeader } from '@/features/home/SkyHeader';
import { PlanDebtTab } from '@/features/plan/PlanDebtTab';
import { PLAN_TABS as TABS, PlanNavigation, type PlanTab } from '@/features/plan/PlanNavigation';
import { PlanMoneyTab } from '@/features/plan/PlanMoneyTab';
import { PlanOverviewTab } from '@/features/plan/PlanOverviewTab';
import { PlanSheets } from '@/features/plan/PlanSheets';
import { PlanUpcomingTab } from '@/features/plan/PlanUpcomingTab';
import type { PlanActions } from '@/features/plan/planActions';
import { PLAN_DAYS } from '@/features/plan/planOverview';
import { createPlanSheets } from '@/features/plan/planSheetsStore';
import { usePlanData } from '@/features/plan/usePlanData';
import { CONTENT_ENTER } from '@/lib/animation';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { formatMoney } from '@/lib/money';
import { withPressedTint } from '@/lib/pressed';
import { useTabScrollPad } from '@/lib/uiScale';
import { useStacked } from '@/lib/useStacked';
import { useTabScrollToTop } from '@/lib/useTabScrollToTop';
import { useAccent } from '@/theme/AccentContext';

/**
 * The gap under the tabs, per tab. Each tab's first block carries its own top margin (the runway card 4, the Upcoming
 * section 8, the plan check 12, the debt card 4 here), so this makes up the rest: the first block starts 20 dp
 * under the tabs on every tab, and switching tabs does not shift the content.
 */
const TAB_GAP: Record<PlanTab, number> = { overview: 16, upcoming: 12, money: 8, debt: 16 };

/** Plan previews open item sheets directly; collection links keep the full-screen routes. */
export default function PlanScreen() {
  const stackTiles = useStacked();
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { accent, secondary } = useAccent();
  const [tab, setTab] = useState<PlanTab>('overview');
  // Which sheet is open is kept outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createPlanSheets);
  const { hideAmounts, data, scoped, version, loaded, loadError, reload } = usePlanData();
  // Home's "See all upcoming" arrives with ?tab=upcoming; the param is spent once it has picked the tab.
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (tabParam == null) return;
    const requested = tabParam === 'budgets' || tabParam === 'goals' ? 'money' : tabParam;
    const picked = TABS.find((t) => t.value === requested);
    if (picked) setTab(picked.value);
    router.setParams({ tab: undefined });
  }, [tabParam]);
  // Leaving Plan drops a payment lookup still in flight.
  useFocusEffect(useCallback(() => () => sheets.cancelPayment(), [sheets]));
  useEffect(() => () => sheets.cancelPayment(), [sheets]);

  // The header shrinks as the page scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  useTabScrollToTop(scrollRef);
  const selectTab = useCallback(
    (next: PlanTab) => {
      setTab(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [scrollRef]
  );
  // What the parts of the page can do, as one object that keeps its identity: they compare their props, and are drawn
  // again only for what they show.
  const actions = useMemo<PlanActions>(
    () => ({
      open: (route) => router.push(route),
      openDetail: sheets.openDetail,
      selectTab,
      payEmi: (loanId) => void sheets.payEmi(loanId),
      openRefund: sheets.openRefund,
      openComparison: sheets.openComparison,
    }),
    [sheets, selectTab]
  );
  // The pending refunds and the plan check read their own data again after each load of the page.
  const refreshToken = useMemo(() => ({ version }), [version]);

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: tabScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <Appear style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your plans</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <Text style={styles.errorDetail}>The forecast may be incomplete until this is resolved.</Text>
            <PrimaryButton title="Try again" onPress={() => void reload()} />
          </Appear>
        )}

        {/* The tabs are there from the first frame, as on Reports, so the page does not drop by their height when the
            data lands. After a failed first load only the notice above shows. */}
        {(!loadError || (loaded && data)) && (
          <View style={[styles.tabs, { marginBottom: TAB_GAP[tab] }]}>
            <PlanNavigation value={tab} onChange={selectTab} stacked={stackTiles} />
          </View>
        )}
        {!loaded || !scoped ? (
          loadError ? null : (
            <View style={{ gap: SCREEN.sectionGap }}>
              <CardRowsSkeleton rows={3} meter />
              <CardRowsSkeleton rows={2} subtitle />
            </View>
          )
        ) : (
          <ReanimatedAnimated.View key={tab} entering={CONTENT_ENTER}>
            {tab === 'overview' && (
              <PlanOverviewTab
                data={scoped}
                refreshToken={refreshToken}
                hideAmounts={hideAmounts}
                actions={actions}
              />
            )}
            {tab === 'upcoming' && <PlanUpcomingTab data={scoped} actions={actions} />}
            {tab === 'money' && (
              <PlanMoneyTab
                data={scoped}
                refreshToken={refreshToken}
                hideAmounts={hideAmounts}
                actions={actions}
              />
            )}
            {tab === 'debt' && <PlanDebtTab data={scoped} actions={actions} />}
          </ReanimatedAnimated.View>
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        title="Plan"
        actions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add to your plan"
            disabled={!scoped}
            accessibilityState={{ disabled: !scoped }}
            onPress={sheets.openMenu}
            style={withPressedTint(accent, styles.addPlan)}
          >
            <Feather name="plus" size={16} color={theme.colors.textPrimary} />
            <Text style={styles.headLinkText}>Add</Text>
          </Pressable>
        }
        collapse={collapse}
        wallpaper
        summary={
          scoped && scoped.dueSoon.count > 0 ? (
            <HeaderSummary
              figure={formatMoney(scoped.dueSoon.totalMinor)}
              rest={`due in ${PLAN_DAYS} days`}
              dot={theme.colors.slice.due}
            />
          ) : undefined
        }
      />
      <PlanSheets sheets={sheets} data={scoped} hideAmounts={hideAmounts} reload={reload} />
    </View>
  );
}

const styles = StyleSheet.create({
  addPlan: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tabs: { marginHorizontal: 16, marginTop: theme.layout.screenTopGap, marginBottom: SCREEN.sectionGap },
  headLinkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: SCREEN.gutter,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 12,
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
    lineHeight: 16,
  },
});
