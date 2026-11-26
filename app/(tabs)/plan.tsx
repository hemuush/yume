import { pullRefreshColors } from '@/components/pullRefreshColors';
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SolidFade } from '@/components/SolidFade';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Appear } from '@/components/Appear';
import { LoadFade } from '@/components/LoadFade';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SCREEN } from '@/components/screenStyles';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SkyHeader } from '@/features/home/SkyHeader';
import { PlanDebtTab } from '@/features/plan/PlanDebtTab';
import { PLAN_TABS as TABS, PlanNavigation, type PlanTab } from '@/features/plan/PlanNavigation';
import { PlanMoneyTab, type MoneySection } from '@/features/plan/PlanMoneyTab';
import { PlanOverviewTab } from '@/features/plan/PlanOverviewTab';
import { PlanSheets } from '@/features/plan/PlanSheets';
import { PlanUpcomingTab } from '@/features/plan/PlanUpcomingTab';
import type { PlanActions } from '@/features/plan/planActions';
import { createPlanSheets } from '@/features/plan/planSheetsStore';
import { upcomingSelection } from '@/features/plan/UpcomingDates';
import { usePlanData } from '@/features/plan/usePlanData';
import { withPressedTint } from '@/lib/pressed';
import { useTabScrollPad } from '@/lib/uiScale';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import { useSaveOnce } from '@/hooks/useSaveOnce';
import { useAccent } from '@/theme/AccentContext';
import { themedStyles } from '@/theme/themedStyles';
import { useKeptAcrossModeChange } from '@/theme/useKeptAcrossModeChange';

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const tabScrollPad = useTabScrollPad();
  const { accent } = useAccent();
  const [tab, setTab] = useKeptAcrossModeChange<PlanTab>('plan-tab', 'overview');
  const recurringRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const [scheduleSelection, setScheduleSelection] = useState(upcomingSelection);
  const [moneyFocus, setMoneyFocus] = useState<MoneySection>();
  // Which sheet is open is kept outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createPlanSheets);
  const { hideAmounts, data, scoped, version, loaded, loadError, reload } = usePlanData();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useSaveOnce(async () => {
    setRefreshing(true);
    try {
      await Promise.all([reload(), recurringRefreshRef.current?.()]);
    } finally {
      setRefreshing(false);
    }
  });
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // Home's "See all upcoming" arrives with ?tab=upcoming; the param is spent once it has picked the tab.
  const {
    tab: tabParam,
    collection,
    upcoming,
  } = useLocalSearchParams<{ tab?: string; collection?: string; upcoming?: string }>();
  useEffect(() => {
    if (tabParam == null) return;
    const requested = tabParam === 'budgets' || tabParam === 'goals' ? 'money' : tabParam;
    const picked = TABS.find((t) => t.value === requested);
    if (picked) {
      if (picked.value === 'upcoming' && upcoming === 'recurring') setScheduleSelection(upcomingSelection());
      setMoneyFocus(
        picked.value === 'money' &&
          (collection === 'budgets' || collection === 'goals' || collection === 'investments')
          ? collection
          : undefined
      );
      setTab(picked.value);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
    router.setParams({
      tab: undefined,
      ...(collection ? { collection: undefined } : {}),
      ...(upcoming ? { upcoming: undefined } : {}),
    });
  }, [tabParam, collection, upcoming, setTab]);
  // Leaving Plan drops a payment lookup still in flight.
  useFocusEffect(useCallback(() => () => sheets.cancelPayment(), [sheets]));
  useEffect(() => () => sheets.cancelPayment(), [sheets]);

  useTabScrollToTop(scrollRef);
  const selectTab = useCallback(
    (next: PlanTab, date?: string, section?: MoneySection) => {
      setMoneyFocus(next === 'money' ? section : undefined);
      if (next === 'upcoming' && date) {
        setScheduleSelection(upcomingSelection(date));
      }
      setTab(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    },
    [setTab]
  );
  const focusMoneySection = useCallback(
    (section: MoneySection, y: number) => {
      if (section !== moneyFocus) return;
      scrollRef.current?.scrollTo({ y, animated: false });
      setMoneyFocus(undefined);
    },
    [moneyFocus]
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
        expandedTitleSize={26}
        wallpaper
      />
      {(!loadError || (loaded && data)) && (
        <View style={styles.tabs}>
          <PlanNavigation value={tab} onChange={selectTab} />
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        testID="plan-content"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} {...pullRefreshColors()} />
        }
        contentContainerStyle={{
          paddingTop: tab === 'upcoming' ? 0 : theme.layout.screenTopGap,
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

        {!loaded || !scoped ? (
          loadError ? null : (
            <View style={{ gap: SCREEN.sectionGap }}>
              <CardRowsSkeleton rows={3} meter />
              <CardRowsSkeleton rows={2} subtitle />
            </View>
          )
        ) : (
          <LoadFade loaded>
            <SolidFade key={tab}>
              {tab === 'overview' && (
                <PlanOverviewTab data={scoped} refreshToken={refreshToken} actions={actions} />
              )}
              {tab === 'upcoming' && (
                <PlanUpcomingTab
                  data={scoped}
                  actions={actions}
                  reload={reload}
                  recurringRefreshRef={recurringRefreshRef}
                  selection={scheduleSelection}
                  onSelectionChange={setScheduleSelection}
                />
              )}
              {tab === 'money' && (
                <PlanMoneyTab
                  data={scoped}
                  refreshToken={refreshToken}
                  hideAmounts={hideAmounts}
                  actions={actions}
                  focusSection={moneyFocus}
                  onSectionLayout={focusMoneySection}
                  reload={reload}
                />
              )}
              {tab === 'debt' && (
                <PlanDebtTab data={scoped} actions={actions} refreshToken={refreshToken} reload={reload} />
              )}
            </SolidFade>
          </LoadFade>
        )}
      </ScrollView>
      <PlanSheets sheets={sheets} data={scoped} hideAmounts={hideAmounts} reload={reload} />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    addPlan: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 22,
      backgroundColor: theme.colors.home.control,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    tabs: { marginHorizontal: SCREEN.gutter, marginBottom: 4 },
    scroll: { flex: 1 },
    headLinkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
    container: { flex: 1, backgroundColor: theme.colors.home.background },
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
  })
);
