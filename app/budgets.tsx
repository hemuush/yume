import { ScreenLoadError } from '@/components/ScreenLoadError';
import { PrimaryButton } from '@/components/PrimaryButton';
import { continueBudgets } from '@/features/budgets/continueBudgets';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { MovingRow } from '@/components/MovingRow';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listCategories } from '@/db/ledger';
import {
  listBudgetsForMonth,
  listLapsedBudgets,
  createBudget,
  deleteBudget,
  restoreBudget,
  BudgetProgress,
  LapsedBudget,
} from '@/db/budgets';
import { Account, Category } from '@/types';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { useUndoToast } from '@/components/UndoToast';
import { Skeleton } from '@/components/Skeleton';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { haptics } from '@/lib/haptics';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { categoryPath, categorySentence } from '@/lib/categoryLabel';
import { BudgetsHero } from '@/features/budgets/BudgetsHero';
import { LapsedBudgetsCard } from '@/features/budgets/LapsedBudgetsCard';
import { budgetsOverview } from '@/features/budgets/budgetsOverview';
import { AddBudgetModal } from '@/features/budgets/AddBudgetModal';
import { styles } from '@/features/budgets/budgets.styles';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { frost } from '@/components/Frost';
import { errorMessage } from '@/lib/errorMessage';
import { BudgetDetailModal } from '@/features/budgets/BudgetDetailModal';
import { useToday } from '@/features/budgets/useToday';
import { getCachedCurrency } from '@/db/settings';
import { showAlert } from '@/components/AppDialog';
import { SCREEN } from '@/components/screenStyles';
import { budgetCategories } from '@/features/budgets/budgetCategories';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { show: showUndo } = useUndoToast();
  const { hideAmounts } = usePrivacy();
  const { accent, secondary } = useAccent();
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [lapsed, setLapsed] = useState<LapsedBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetProgress | null>(null);
  const [manageTarget, setManageTarget] = useState<BudgetProgress | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [continuingAll, setContinuingAll] = useState(false);
  // Guards a double-tap firing deleteBudget twice for a row before the ActionSheet closes (same as
  // Categories' manage sheet).
  const [deleteBusy, setDeleteBusy] = useState(false);
  const continuing = useRef(false);
  const request = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current += 1;
    };
  }, []);

  const today = useToday();
  const periodMonth = today.slice(0, 7);
  useEffect(
    () => () => {
      request.current += 1;
    },
    [periodMonth, hideAmounts]
  );
  const mutationBusy = deleteBusy || continuingAll || continuingId !== null;

  const loadBudgets = useCallback(async () => {
    const id = ++request.current;
    const [list, lapsedList, cats, accs] = await Promise.all([
      listBudgetsForMonth(periodMonth, hideAmounts),
      listLapsedBudgets(periodMonth, hideAmounts),
      listCategories(true),
      listAccounts(true),
    ]);
    if (!active.current || request.current !== id) return;
    setBudgets(list);
    setLapsed(lapsedList);
    setCategories(cats);
    setAccounts(accs);
  }, [periodMonth, hideAmounts]);
  const { loaded, hasData, loadError, reload: load } = useScreenLoad(loadBudgets);
  const { budget: budgetId, add } = useLocalSearchParams<{ budget?: string; add?: string }>();
  useEffect(() => {
    if (!loaded || loadError || (!budgetId && add !== '1')) return;
    const selected = budgets.find((item) => item.budget.id === budgetId);
    if (add === '1' || selected) {
      if (add === '1') {
        setEditingBudget(null);
        setModalVisible(true);
      } else if (selected) setDetailId(selected.budget.id);
    } else if (budgetId) {
      showAlert(
        'Budget unavailable',
        'This budget is no longer available in the current month or privacy view.'
      );
    }
    router.setParams({ budget: undefined, add: undefined });
  }, [loaded, loadError, budgetId, add, budgets]);

  const hero = budgetsOverview(budgets, today);

  // Every expense category, parents and subcategories alike, for AddBudgetModal's picker; see that
  // component's comment for why it isn't pre-filtered to "no budget this month".
  const expenseCategories = useMemo(
    () => budgetCategories(categories, hideAmounts),
    [categories, hideAmounts]
  );

  const budgetedIds = useMemo(() => new Set(budgets.map((b) => b.budget.categoryId)), [budgets]);
  const detail = budgets.find((b) => b.budget.id === detailId);
  useEffect(() => {
    if (loaded && !loadError && detailId && !detail) setDetailId(null);
  }, [loaded, loadError, detailId, detail]);

  const onContinue = async (item: LapsedBudget) => {
    if (!active.current || continuing.current) return;
    continuing.current = true;
    setContinuingId(item.categoryId);
    try {
      await createBudget({
        categoryId: item.categoryId,
        limitAmountMinor: item.limitAmountMinor,
        rollover: item.rollover,
        periodMonth,
      });
      if (!active.current) return;
      haptics.tap();
      await load();
    } catch (e) {
      // The category stays in the list to try again; say why this attempt didn't take.
      if (active.current) showAlert("Couldn't continue budget", errorMessage(e));
    } finally {
      continuing.current = false;
      if (active.current) setContinuingId(null);
    }
  };

  const onContinueAll = async () => {
    if (!active.current || continuing.current) return;
    continuing.current = true;
    setContinuingAll(true);
    try {
      const failures = await continueBudgets(lapsed, periodMonth);
      if (!active.current) return;
      haptics.tap();
      await load();
      if (failures.length) showAlert("Some budgets couldn't continue", failures.join('\n'));
    } finally {
      continuing.current = false;
      if (active.current) setContinuingAll(false);
    }
  };

  const onDelete = async (progress: BudgetProgress) => {
    if (!active.current || continuing.current) return;
    continuing.current = true;
    setDeleteBusy(true);
    let deleted = false;
    try {
      const snapshot = await deleteBudget(progress.budget.id);
      deleted = true;
      if (!active.current) return;
      haptics.warn();
      showUndo(`Deleted "${categoryPath(progress.categoryName, progress.parentName)}" budget`, async () => {
        await restoreBudget(snapshot);
        if (active.current) {
          try {
            await load();
          } catch {
            showAlert(
              'Budget restored',
              'The budget was restored, but the list could not refresh. Reopen Budgets to see it.'
            );
          }
        }
      });
      await load();
    } catch (e) {
      if (active.current)
        showAlert(
          deleted ? 'Budget deleted' : "Couldn't delete budget",
          deleted
            ? 'The budget was deleted, but the list could not refresh. Reopen Budgets to see it.'
            : errorMessage(e)
        );
    } finally {
      continuing.current = false;
      if (active.current) setDeleteBusy(false);
    }
  };

  const manageItems: ActionSheetItem[] = manageTarget
    ? [
        {
          key: 'edit',
          label: 'Edit limit',
          icon: 'edit-2',
          onPress: () => {
            setEditingBudget(manageTarget);
            setModalVisible(true);
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: 'trash-2',
          destructive: true,
          onPress: () => onDelete(manageTarget),
        },
      ]
    : [];

  if (!hasData && loadError)
    return <ScreenLoadError title="Budgets" message={loadError} onRetry={() => void load()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} plain />
        <SkyHeader title="Budgets" showBack hideUser wallpaper />
        <View style={{ paddingTop: 14 }}>
          <Skeleton width={110} height={12} radius={4} style={{ marginHorizontal: SCREEN.gutter }} />
          <Skeleton
            width={220}
            height={26}
            radius={6}
            style={{ marginHorizontal: SCREEN.gutter, marginTop: 8 }}
          />
          <Skeleton
            width={260}
            height={9}
            radius={4}
            style={{ marginHorizontal: SCREEN.gutter, marginTop: 14 }}
          />
          <View style={{ marginTop: 20 }}>
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
            <Text style={styles.errorTitle}>Couldn't load your budgets</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
          </View>
        )}

        {budgets.length > 0 && <BudgetsHero figures={hero} />}

        {lapsed.length > 0 && (
          <LapsedBudgetsCard
            items={lapsed}
            continuingId={continuingId}
            continuingAll={continuingAll}
            onContinue={onContinue}
            onContinueAll={onContinueAll}
            style={budgets.length === 0 && { marginTop: theme.layout.screenTopGap }}
          />
        )}

        {budgets.length === 0 && lapsed.length === 0 ? (
          <EmptyState
            title="No budgets yet"
            subtitle="Set a monthly limit for a category to see how close you are, right from Home."
          >
            <PrimaryButton title="Create a budget" onPress={() => setModalVisible(true)} />
          </EmptyState>
        ) : (
          budgets.length > 0 && (
            <>
              <Text style={styles.listTitle}>This month</Text>
              <Glass style={[frost.list, cardSurface.neutral]}>
                {budgets.map((progress, i) => (
                  <MovingRow key={progress.budget.id}>
                    <BudgetRow
                      progress={progress}
                      divider={i > 0}
                      showPerDay
                      onPress={() => {
                        if (!continuing.current) setDetailId(progress.budget.id);
                      }}
                      onMore={() => {
                        if (!continuing.current) setManageTarget(progress);
                      }}
                    />
                  </MovingRow>
                ))}
              </Glass>
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
        actions={
          <AddButton
            disabled={mutationBusy}
            onPress={() => {
              setEditingBudget(null);
              setModalVisible(true);
            }}
            label="+ Add"
          />
        }
      />

      <AddBudgetModal
        visible={modalVisible}
        editing={editingBudget}
        categories={expenseCategories}
        budgetedCategoryIds={budgetedIds}
        onClose={() => {
          setModalVisible(false);
          setEditingBudget(null);
        }}
        onSaved={async () => {
          setModalVisible(false);
          setEditingBudget(null);
          await load();
        }}
      />
      {detail && (
        <BudgetDetailModal
          key={detail.budget.id}
          progress={detail}
          categories={categories}
          accounts={accounts}
          currency={getCachedCurrency()}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}

      <ActionSheet
        visible={!!manageTarget}
        onClose={() => setManageTarget(null)}
        title={
          manageTarget ? categorySentence(manageTarget.categoryName, manageTarget.parentName) : undefined
        }
        items={manageItems}
      />
    </View>
  );
}
