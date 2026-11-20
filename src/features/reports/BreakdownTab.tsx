import { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Amount } from '@/components/Amount';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import type { AccountBreakdownItem, CategoryBreakdownItem, PeriodComparison } from '@/db/reports';
import { isCustomWindow, previousPeriodLabel, previousWindowRange, type ReportWindow } from '@/lib/period';
import { withPressed } from '@/lib/pressed';
import { roundedMinor } from '@/lib/round';
import { formatMoney } from '@/lib/money';
import type { Category, DateRange } from '@/types';
import { CategoryBar } from './CategoryBar';
import { CategoryList } from './CategoryList';
import { ComparisonNote, FlowSwitch, GroupPicker } from './ReportControls';
import { ExpenseLabelsReport } from './ExpenseLabelsReport';
import { accountRows, categoryDeltas } from './reportsInsights';
import type { CategoryGroup } from './useReportDetails';
import { styles } from './reports.styles';

// Each section compares its props by identity; the tab hands them values that keep theirs until what is in them changes.
const Bar = memo(CategoryBar);
const List = memo(CategoryList);

const NO_DELTAS = new Map<string, number | null>();

/**
 * Reports' "Breakdown": where the period's spending (or income) went, by category or by account, as one bar and a list
 * whose rows open to their subcategories. It compares its props by identity, so picking a row or the subcategories
 * arriving redraws the list, not the page.
 */
export const BreakdownTab = memo(function BreakdownTab({
  cursor,
  range,
  periodName,
  custom,
  today,
  flow,
  group,
  current,
  previous,
  catById,
  startingBalanceNames,
  selectedCat,
  selectedAccount,
  expanded,
  split,
  splitError,
  accounts,
  accountsKey,
  accountsError,
  labelsOpen,
  onFlow,
  onGroup,
  onOpenLabels,
  onCloseLabels,
  onToggleExpanded,
  onSelectCategory,
  onSelectAccount,
  onRetrySplit,
  onOpenCategory,
  onShowDays,
}: {
  cursor: ReportWindow;
  range: DateRange;
  periodName: string;
  custom: boolean;
  /** Today's date (ISO). */
  today: string;
  flow: 'expense' | 'income';
  group: CategoryGroup;
  current: PeriodComparison['current'];
  previous: PeriodComparison['previous'];
  catById: Map<string, Category>;
  startingBalanceNames: string[];
  selectedCat: string | null;
  selectedAccount: string | null;
  /** The list shows every row, not the first few. */
  expanded: boolean;
  /** The picked category's subcategories; null while they load. */
  split: { id: string; items: CategoryBreakdownItem[] } | null;
  splitError: string | undefined;
  accounts: { key: string; items: AccountBreakdownItem[] } | null;
  accountsKey: string;
  accountsError: string | undefined;
  labelsOpen: boolean;
  onFlow: (flow: 'expense' | 'income') => void;
  onGroup: (group: CategoryGroup) => void;
  onOpenLabels: () => void;
  onCloseLabels: () => void;
  onToggleExpanded: () => void;
  onSelectCategory: (category: CategoryBreakdownItem) => void;
  onSelectAccount: (account: CategoryBreakdownItem) => void;
  onRetrySplit: () => void;
  onOpenCategory: (category: CategoryBreakdownItem) => void;
  /** "Show days": narrows the heatmap on Overview to the category (spending only). */
  onShowDays: (category: CategoryBreakdownItem) => void;
}) {
  const income = flow === 'income';
  const shownBreakdown = income ? current.incomeBreakdown : current.categoryBreakdown;
  // The rows' own sum, not the period's spending: a category whose refunds outweigh its spending has no row
  // but still lowers that total, and the rows (whose rounded amounts and shares are made to add up to this)
  // would each be shaved to fit.
  const shownTotal = useMemo(
    () => roundedMinor(shownBreakdown.reduce((sum, c) => sum + c.totalMinor, 0)),
    [shownBreakdown]
  );
  const deltas = useMemo(
    () =>
      income
        ? categoryDeltas(current.incomeBreakdown, previous.incomeBreakdown)
        : categoryDeltas(current.categoryBreakdown, previous.categoryBreakdown),
    [income, current, previous]
  );
  // A starting balance logged as income, making up over half of it: worth tidying.
  const startingHeavy = income
    ? current.incomeBreakdown.find(
        (c) => startingBalanceNames.includes(c.name) && c.totalMinor * 2 > current.incomeMinor
      )
    : undefined;
  // By account: the same bar and rows, one per account; an opened account lists its top categories.
  const accountItems = accounts?.key === accountsKey ? accounts.items : null;
  const byAccount = group === 'account';
  // The rows do not add up to the period's spending when a refund outweighs a category: say so, so this total and the
  // Overview figure can be read together.
  const refundedMinor = income || byAccount ? 0 : shownTotal - roundedMinor(current.expenseMinor);
  const accountBreakdown = useMemo(() => (accountItems ? accountRows(accountItems) : []), [accountItems]);
  const accountTotal = useMemo(
    () => roundedMinor(accountBreakdown.reduce((sum, a) => sum + a.totalMinor, 0)),
    [accountBreakdown]
  );
  const accountSplit = useMemo(
    () => accountItems?.find((a) => a.accountId === selectedAccount)?.topCategories ?? [],
    [accountItems, selectedAccount]
  );
  // An account opens Activity on the month; other periods have no single Activity view to land on.
  const onPressAccount = useMemo(
    () =>
      !isCustomWindow(cursor) && cursor.granularity === 'month'
        ? (a: CategoryBreakdownItem) =>
            router.navigate(`/transactions?account=${a.categoryId}&month=${range.start.slice(0, 7)}`)
        : undefined,
    [cursor, range.start]
  );
  const previousRange = useMemo(() => previousWindowRange(cursor), [cursor]);
  const iconOf = useMemo(() => (id: string) => catById.get(id)?.icon, [catById]);
  const inProgress = range.end >= today;

  return (
    <View>
      <View style={styles.sumCard}>
        <View style={styles.sumHead}>
          <FlowSwitch flow={flow} onFlow={onFlow} />
          <GroupPicker flow={flow} group={group} onLabels={onOpenLabels} onGroup={onGroup} />
        </View>
        <Text style={styles.sumKicker} accessibilityRole="header">
          {income ? 'Where it came from' : 'Where it went'}
        </Text>
        {(byAccount ? accountItems !== null : shownBreakdown.length > 0) && (
          <View style={styles.breakdownContext}>
            <Amount minor={byAccount ? accountTotal : shownTotal} style={styles.breakdownAmount} />
            <Text style={styles.stripSub}>{income ? 'received' : 'spent'}</Text>
          </View>
        )}
        {refundedMinor > 0 && shownBreakdown.length > 0 && (
          <Text style={styles.stripSub}>
            {`Net ${formatMoney(roundedMinor(current.expenseMinor))} after ${formatMoney(refundedMinor)} refunded`}
          </Text>
        )}
        {byAccount
          ? accountItems !== null &&
            accountBreakdown.length > 0 && <Bar breakdown={accountBreakdown} selectedId={selectedAccount} />
          : shownBreakdown.length > 0 && <Bar breakdown={shownBreakdown} selectedId={selectedCat} />}
        {!byAccount && shownBreakdown.length > 0 && (
          <ComparisonNote
            label={
              inProgress
                ? `So far vs ${custom ? 'the whole previous period' : cursor.granularity === 'year' ? 'all of last year' : 'the whole month before'}`
                : `Vs ${isCustomWindow(cursor) ? 'previous period' : previousPeriodLabel(cursor)}`
            }
            partial={inProgress}
          />
        )}
      </View>
      <ExpenseLabelsReport visible={labelsOpen} range={range} onClose={onCloseLabels} />
      {byAccount ? (
        accountsError ? null : accountItems === null ? (
          <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
        ) : accountBreakdown.length === 0 ? (
          <Text style={styles.empty}>
            No {income ? 'income' : 'spending'} in {periodName}.
          </Text>
        ) : (
          <List
            breakdown={accountBreakdown}
            spentMinor={accountTotal}
            deltas={NO_DELTAS}
            expanded={expanded}
            onToggleExpanded={onToggleExpanded}
            selectedId={selectedAccount}
            onSelect={onSelectAccount}
            split={accountSplit}
            splitCaption="Top categories"
            onOpen={onPressAccount}
            kind={flow}
          />
        )
      ) : shownBreakdown.length === 0 ? (
        <Text style={styles.empty}>
          No {income ? 'income' : 'spending'} in {periodName}.
        </Text>
      ) : (
        <List
          breakdown={shownBreakdown}
          spentMinor={shownTotal}
          deltas={deltas}
          splitError={splitError}
          onRetrySplit={onRetrySplit}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          currentRange={range}
          previousRange={previousRange}
          selectedId={selectedCat}
          onSelect={onSelectCategory}
          split={splitError ? [] : split?.id === selectedCat ? split.items : null}
          onOpen={onOpenCategory}
          onShowDays={income ? undefined : onShowDays}
          kind={flow}
          iconOf={iconOf}
        />
      )}
      {startingHeavy && (
        <Pressable
          onPress={() => router.push('/tidy-up')}
          style={withPressed(styles.tidyNudge)}
          accessibilityRole="button"
        >
          <Text style={styles.tidyNudgeText}>
            {startingHeavy.name} is over half of this income, and looks like starting balances.{' '}
            <Text style={styles.tidyNudgeLink}>Tidy up</Text>
          </Text>
        </Pressable>
      )}
    </View>
  );
});
