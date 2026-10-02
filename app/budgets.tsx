import { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { MovingRow } from '@/components/MovingRow';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listCategories } from '@/db/ledger';
import {
  listBudgetsForMonth,
  listLapsedBudgets,
  createBudget,
  deleteBudget,
  restoreBudget,
  periodMonthOf,
  BudgetProgress,
  LapsedBudget,
} from '@/db/budgets';
import { Category } from '@/types';
import { toLocalIsoDate } from '@/lib/date';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { useUndoToast } from '@/components/UndoToast';
import { Skeleton } from '@/components/Skeleton';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { haptics } from '@/lib/haptics';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { BudgetsHero } from '@/features/budgets/BudgetsHero';
import { LapsedBudgetsCard } from '@/features/budgets/LapsedBudgetsCard';
import { budgetsOverview } from '@/features/budgets/budgetsOverview';
import { AddBudgetModal } from '@/features/budgets/AddBudgetModal';
import { styles } from '@/features/budgets/budgets.styles';
import { errorMessage } from '@/lib/errorMessage';
import { useReturnOrPush } from '@/lib/useReturnOrPush';
import { showAlert } from '@/components/AppDialog';

export default function BudgetsScreen() {
  // A category's page and Budgets link to each other: return to that page
  // when it's already open below, rather than stacking another copy.
  const returnOrPush = useReturnOrPush();
  const insets = useSafeAreaInsets();
  const { show: showUndo } = useUndoToast();
  const { hideAmounts } = usePrivacy();
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [lapsed, setLapsed] = useState<LapsedBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetProgress | null>(null);
  const [manageTarget, setManageTarget] = useState<BudgetProgress | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  const [continuingAll, setContinuingAll] = useState(false);
  // Guards against a double-tap firing deleteBudget twice for the same row
  // before the ActionSheet finishes closing — same convention Categories'
  // manage sheet uses.
  const [deleteBusy, setDeleteBusy] = useState(false);

  const periodMonth = periodMonthOf();

  const loadBudgets = useCallback(async () => {
    const [list, lapsedList, cats] = await Promise.all([
      listBudgetsForMonth(periodMonth, hideAmounts),
      listLapsedBudgets(periodMonth, hideAmounts),
      listCategories(),
    ]);
    setBudgets(list);
    setLapsed(lapsedList);
    setCategories(cats);
  }, [periodMonth, hideAmounts]);
  const { loaded, loadError, reload: load } = useScreenLoad(loadBudgets);

  const hero = budgetsOverview(budgets, toLocalIsoDate(new Date()));

  // Every expense category, parents and subcategories alike, for the
  // AddBudgetModal's picker — see that component's own comment for why this
  // isn't pre-filtered down to "doesn't already have one this month".
  const expenseCategories = categories.filter((c) => c.kind === 'expense' && !(hideAmounts && c.isSensitive));

  const onContinue = async (item: LapsedBudget) => {
    setContinuingId(item.categoryId);
    try {
      await createBudget({
        categoryId: item.categoryId,
        limitAmountMinor: item.limitAmountMinor,
        rollover: item.rollover,
        periodMonth,
      });
      haptics.tap();
      await load();
    } catch {
      // A lapsed prompt failing to continue isn't worth a modal — the
      // category just stays in the list to try again, same as a retry.
    } finally {
      setContinuingId(null);
    }
  };

  const onContinueAll = async () => {
    setContinuingAll(true);
    try {
      // Each in its own try: one that can't be created doesn't stop the rest.
      for (const item of lapsed) {
        try {
          await createBudget({
            categoryId: item.categoryId,
            limitAmountMinor: item.limitAmountMinor,
            rollover: item.rollover,
            periodMonth,
          });
        } catch {
          // It stays in the list to try again.
        }
      }
      haptics.tap();
      await load();
    } finally {
      setContinuingAll(false);
    }
  };

  const onDelete = async (progress: BudgetProgress) => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      const snapshot = await deleteBudget(progress.budget.id);
      haptics.warn();
      await load();
      showUndo(`Deleted "${progress.categoryName}" budget`, async () => {
        await restoreBudget(snapshot);
        await load();
      });
    } catch (e) {
      showAlert("Couldn't delete budget", errorMessage(e));
    } finally {
      setDeleteBusy(false);
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

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Budgets" showBack />
        <View style={{ paddingTop: 14 }}>
          <Skeleton width={110} height={12} radius={4} style={{ marginHorizontal: 20 }} />
          <Skeleton width={220} height={26} radius={6} style={{ marginHorizontal: 20, marginTop: 8 }} />
          <Skeleton width={260} height={9} radius={4} style={{ marginHorizontal: 20, marginTop: 14 }} />
          <View style={{ marginTop: 20 }}>
            <CardRowsSkeleton rows={4} meter />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Budgets"
        showBack
        right={<AddButton onPress={() => setModalVisible(true)} label="+ Add" />}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your budgets</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
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
          />
        ) : (
          budgets.length > 0 && (
            <View style={styles.listCard}>
              {budgets.map((progress, i) => (
                <MovingRow key={progress.budget.id}>
                  <BudgetRow
                    progress={progress}
                    divider={i > 0}
                    showPerDay
                    // The row opens its category's page; Edit and Delete are in ⋯.
                    onPress={() =>
                      returnOrPush(
                        { name: 'category/[id]', params: { id: progress.budget.categoryId } },
                        `/category/${progress.budget.categoryId}`
                      )
                    }
                    onMore={() => setManageTarget(progress)}
                  />
                </MovingRow>
              ))}
            </View>
          )
        )}
      </ScrollView>

      <AddBudgetModal
        visible={modalVisible}
        editing={editingBudget}
        categories={expenseCategories}
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

      <ActionSheet
        visible={!!manageTarget}
        onClose={() => setManageTarget(null)}
        title={manageTarget?.categoryName}
        items={manageItems}
      />
    </View>
  );
}
