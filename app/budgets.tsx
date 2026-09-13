import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
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
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';
import { AddButton } from '@/components/AddButton';
import { EmptyState } from '@/components/EmptyState';
import { ActionSheet, ActionSheetItem } from '@/components/ActionSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useUndoToast } from '@/components/UndoToast';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { haptics } from '@/lib/haptics';
import { BudgetRow } from '@/features/budgets/BudgetRow';
import { AddBudgetModal } from '@/features/budgets/AddBudgetModal';
import { styles } from '@/features/budgets/budgets.styles';

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const { show: showUndo } = useUndoToast();
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [lapsed, setLapsed] = useState<LapsedBudget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetProgress | null>(null);
  const [manageTarget, setManageTarget] = useState<BudgetProgress | null>(null);
  const [continuingId, setContinuingId] = useState<string | null>(null);
  // Guards against a double-tap firing deleteBudget twice for the same row
  // before the ActionSheet finishes closing — same convention Categories'
  // manage sheet uses.
  const [deleteBusy, setDeleteBusy] = useState(false);

  const periodMonth = periodMonthOf();

  const loadBudgets = useCallback(async () => {
    const [list, lapsedList, cats] = await Promise.all([
      listBudgetsForMonth(periodMonth),
      listLapsedBudgets(periodMonth),
      listCategories(),
    ]);
    setBudgets(list);
    setLapsed(lapsedList);
    setCategories(cats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadBudgets);

  const totalLimit = budgets.reduce((sum, b) => sum + b.effectiveLimitMinor, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentMinor, 0);
  const overallOver = totalSpent > totalLimit && totalLimit > 0;

  // Every expense category, parents and subcategories alike, for the
  // AddBudgetModal's picker — see that component's own comment for why this
  // isn't pre-filtered down to "doesn't already have one this month".
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

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
    } catch (e: any) {
      Alert.alert('Could not delete budget', String(e?.message ?? e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const manageItems: ActionSheetItem[] = manageTarget
    ? [
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
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.ink} />
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

        {budgets.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Budgeted this month</Text>
            <View style={styles.summaryAmountRow}>
              <Text style={styles.summaryAmount}>{formatMoney(totalSpent)}</Text>
              <Text style={styles.summaryOf}>
                / {formatMoney(totalLimit)} across {budgets.length} categor
                {budgets.length === 1 ? 'y' : 'ies'}
              </Text>
            </View>
            <View style={styles.summaryTrack}>
              <View
                style={[
                  styles.summaryFill,
                  {
                    width: `${totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0}%`,
                    backgroundColor: overallOver ? theme.colors.expense : theme.colors.secondary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {lapsed.length > 0 && (
          <View style={styles.lapsedCard}>
            <Text style={styles.lapsedTitle}>Continue from last month?</Text>
            {lapsed.map((item) => (
              <View key={item.categoryId} style={styles.lapsedRow}>
                <CategoryIcon name={item.categoryIcon} color={item.categoryColor} square={30} size={14} />
                <Text style={styles.lapsedName} numberOfLines={1}>
                  {item.categoryName}
                </Text>
                <Text style={styles.lapsedAmount}>{formatMoney(item.limitAmountMinor)}/mo</Text>
                <Pressable
                  style={styles.continueBtn}
                  onPress={() => onContinue(item)}
                  disabled={continuingId === item.categoryId}
                  accessibilityRole="button"
                >
                  <Text style={styles.continueBtnText}>
                    {continuingId === item.categoryId ? '…' : 'Continue'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
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
                <BudgetRow
                  key={progress.budget.id}
                  progress={progress}
                  divider={i > 0}
                  onPress={() => {
                    setEditingBudget(progress);
                    setModalVisible(true);
                  }}
                  onLongPress={() => setManageTarget(progress)}
                />
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
