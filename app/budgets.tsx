import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Appear } from '@/components/Appear';
import { CONTENT_ENTER } from '@/lib/animation';
import { PrimaryButton } from '@/components/PrimaryButton';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BudgetProgress } from '@/db/budgets';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { CardRowsSkeleton, SummarySkeleton } from '@/components/ListSkeleton';
import { BudgetListRow } from '@/features/budgets/BudgetListRow';
import { BudgetsHero } from '@/features/budgets/BudgetsHero';
import { BudgetsSheets } from '@/features/budgets/BudgetsSheets';
import { LapsedBudgetsCard } from '@/features/budgets/LapsedBudgetsCard';
import { budgetsOverview } from '@/features/budgets/budgetsOverview';
import { createBudgetsSheets } from '@/features/budgets/budgetsSheetsStore';
import { styles } from '@/features/budgets/budgets.styles';
import { useBudgetActions } from '@/features/budgets/useBudgetActions';
import { useBudgetsData } from '@/features/budgets/useBudgetsData';
import { useToday } from '@/features/budgets/useToday';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { ListCard } from '@/components/SummaryCard';
import { showAlert } from '@/components/AppDialog';

// The hero and the lapsed card compare their props by identity, so a reload that changed neither leaves them be.
const Hero = memo(BudgetsHero);
const Lapsed = memo(LapsedBudgetsCard);
const NO_BUDGETS_STYLE = { marginTop: theme.layout.screenTopGap };

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  // Which sheet is open is kept outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createBudgetsSheets);

  const today = useToday();
  const periodMonth = today.slice(0, 7);
  const {
    budgets,
    lapsed,
    categories,
    accounts,
    loaded,
    hasData,
    loadError,
    reload: load,
  } = useBudgetsData(periodMonth, hideAmounts);
  const { busy, continuingId, continuingAll, onContinue, onContinueAll, onDelete, isBusy } = useBudgetActions(
    {
      periodMonth,
      lapsed,
      reload: load,
    }
  );

  const { budget: budgetId, add } = useLocalSearchParams<{ budget?: string; add?: string }>();
  useEffect(() => {
    if (!loaded || loadError || (!budgetId && add !== '1')) return;
    const selected = budgets.find((item) => item.budget.id === budgetId);
    if (add === '1' || selected) {
      if (add === '1') sheets.openForm(null);
      else if (selected) sheets.openDetail(selected.budget.id);
    } else if (budgetId) {
      showAlert(
        'Budget unavailable',
        'This budget is no longer available in the current month or privacy view.'
      );
    }
    router.setParams({ budget: undefined, add: undefined });
  }, [loaded, loadError, budgetId, add, budgets, sheets]);

  const hero = useMemo(() => budgetsOverview(budgets, today), [budgets, today]);
  const openBudget = useCallback(
    (id: string) => {
      if (!isBusy()) sheets.openDetail(id);
    },
    [isBusy, sheets]
  );
  const openManage = useCallback(
    (progress: BudgetProgress) => {
      if (!isBusy()) sheets.openManage(progress);
    },
    [isBusy, sheets]
  );
  const openForm = useCallback(() => sheets.openForm(null), [sheets]);

  if (!hasData && loadError)
    return <ScreenLoadError title="Budgets" message={loadError} onRetry={() => void load()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
        <SkyHeader title="Budgets" showBack hideUser wallpaper />
        <View style={{ paddingTop: 8 }}>
          <SummarySkeleton />
          <View style={{ marginTop: 16 }}>
            <CardRowsSkeleton rows={4} meter />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} plain />
      <ReanimatedAnimated.ScrollView
        // The data arriving after the placeholders: one short fade, the header and wallpaper stay solid.
        entering={CONTENT_ENTER}
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <Appear style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn’t load your budgets</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
          </Appear>
        )}

        {budgets.length > 0 && <Hero figures={hero} />}

        {lapsed.length > 0 && (
          <Lapsed
            items={lapsed}
            continuingId={continuingId}
            continuingAll={continuingAll}
            onContinue={onContinue}
            onContinueAll={onContinueAll}
            style={budgets.length === 0 ? NO_BUDGETS_STYLE : undefined}
          />
        )}

        {budgets.length === 0 && lapsed.length === 0 ? (
          <EmptyState
            title="No budgets yet"
            subtitle="Set a monthly limit for a category to see how close you are, right from Home."
          >
            <PrimaryButton title="Create a budget" onPress={openForm} />
          </EmptyState>
        ) : (
          budgets.length > 0 && (
            <>
              <Text style={styles.listTitle}>This month</Text>
              <ListCard>
                {budgets.map((progress, i) => (
                  <BudgetListRow
                    key={progress.budget.id}
                    progress={progress}
                    divider={i > 0}
                    onOpen={openBudget}
                    onMore={openManage}
                  />
                ))}
              </ListCard>
            </>
          )
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          budgets.length > 0 ? (
            <HeaderSummary
              figure={formatMoney(hero.spentMinor > hero.limitMinor ? hero.overMinor : hero.leftMinor)}
              rest={hero.spentMinor > hero.limitMinor ? 'over this month' : 'left this month'}
              dot={hero.spentMinor > hero.limitMinor ? theme.colors.expense : theme.colors.slice.saved}
            />
          ) : undefined
        }
        title="Budgets"
        showBack
        hideUser
        wallpaper
        actions={<AddButton disabled={busy} onPress={openForm} label="+ Add" />}
      />
      <BudgetsSheets
        sheets={sheets}
        budgets={budgets}
        categories={categories}
        accounts={accounts}
        hideAmounts={hideAmounts}
        ready={loaded && !loadError}
        reload={load}
        onDelete={onDelete}
      />
    </View>
  );
}
