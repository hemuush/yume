import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { themedStyles } from '@/theme/themedStyles';
import BudgetsWorkspace from '@/features/budgets/BudgetsWorkspace';
import GoalsWorkspace from '@/features/goals/GoalsWorkspace';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import InvestmentsWorkspace from '@/features/investments/InvestmentsWorkspace';
import { MonthlyPlanCheck } from './MonthlyPlanCheck';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { WHAT_IF_CUTS } from './planOverview';
import { projectedMonthlySpend } from '@/lib/whatIf';
import { formatMoney } from '@/lib/money';
import { goalProgress } from '@/lib/savingsGoalProgress';

/**
 * Plan's "Money plan": the check of the month's commitments, budgets, goals, and investments with the what-if. It
 * compares its props by identity, so it is drawn again only when what it shows, or the reload that refreshes the
 * check (`refreshToken`), changes.
 */
// The sections compare their props by identity; the tab hands them values that keep theirs until what is in them changes.
const Check = memo(MonthlyPlanCheck);
export type MoneySection = 'budgets' | 'goals' | 'investments';

export const PlanMoneyTab = memo(function PlanMoneyTab({
  data,
  refreshToken,
  hideAmounts,
  actions,
  focusSection,
  onSectionLayout,
  reload,
}: {
  data: PlanData;
  /** Changes with each load of the page: the check reads its own data again. */
  refreshToken: object;
  hideAmounts: boolean;
  actions: PlanActions;
  focusSection?: MoneySection;
  onSectionLayout: (section: MoneySection, y: number) => void;
  reload: () => Promise<void>;
}) {
  const { open } = actions;
  const checkInput = useMemo(
    () => ({
      categories: data.categories,
      accounts: data.accounts,
      rules: data.ruleDetails,
      budgets: data.budgetDetails.map((b) => ({
        categoryId: b.budget.categoryId,
        limitMinor: b.effectiveLimitMinor,
      })),
      goals: data.goals,
      loans: data.loans.rows,
      today: data.today,
    }),
    [data]
  );
  const { whatIf } = data;
  const openWhatIf = useCallback(
    (cut: number) =>
      whatIf
        ? router.push({
            pathname: '/whatif',
            params: { category: whatIf.categoryId, cut: String(cut) },
          })
        : open('/whatif'),
    [whatIf, open]
  );
  const cut = WHAT_IF_CUTS[1];
  const savings = whatIf ? projectedMonthlySpend(whatIf.avgMonthlyMinor, cut).extraMinor : 0;
  const { overCount, rows: budgets } = data.budgets;
  const openGoals = data.goals.filter((goal) => !goal.archived);
  const reached = hideAmounts
    ? 0
    : openGoals.filter((goal) => goalProgress(goal.currentAmountMinor, goal.targetAmountMinor).done).length;
  return (
    <>
      <Check refreshToken={refreshToken} currency={data.currency} hidden={hideAmounts} input={checkInput} />
      <View
        onLayout={
          focusSection === 'budgets'
            ? (event) => onSectionLayout('budgets', event.nativeEvent.layout.y)
            : undefined
        }
      >
        <Section
          compact
          title="Budgets"
          heading={
            <View style={styles.ledgerHeading}>
              <Text accessibilityRole="header" style={styles.ledgerTitle}>
                Budgets
              </Text>
              {budgets.length > 0 && (
                <Text style={[styles.ledgerNote, overCount > 0 && styles.ledgerWarning]}>
                  {overCount > 0 ? `${overCount} over budget` : 'Within limits'}
                </Text>
              )}
            </View>
          }
        >
          <BudgetsWorkspace
            embedded
            refreshToken={refreshToken}
            onChanged={reload}
            fallback={<CardRowsSkeleton rows={Math.max(1, Math.min(3, data.budgets.rows.length))} subtitle />}
          />
        </Section>
      </View>
      <View
        onLayout={
          focusSection === 'goals'
            ? (event) => onSectionLayout('goals', event.nativeEvent.layout.y)
            : undefined
        }
      >
        <Section
          compact
          title="Goals"
          heading={
            <View style={styles.ledgerHeading}>
              <Text accessibilityRole="header" style={styles.ledgerTitle}>
                Goals
              </Text>
              {reached > 0 && (
                <Text style={styles.ledgerNote}>
                  {reached} of {openGoals.length} reached
                </Text>
              )}
            </View>
          }
        >
          <GoalsWorkspace
            embedded
            refreshToken={refreshToken}
            onChanged={reload}
            fallback={<CardRowsSkeleton rows={Math.max(1, Math.min(3, data.goals.length))} subtitle />}
          />
        </Section>
      </View>
      <View
        onLayout={
          focusSection === 'investments'
            ? (event) => onSectionLayout('investments', event.nativeEvent.layout.y)
            : undefined
        }
      >
        <Section
          compact
          title="Investments"
          heading={
            <View style={styles.ledgerHeading}>
              <Text accessibilityRole="header" style={styles.ledgerTitle}>
                Investments
              </Text>
            </View>
          }
        >
          <InvestmentsWorkspace embedded refreshToken={refreshToken} onChanged={reload} />
        </Section>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the what-if sandbox"
        accessibilityHint={
          whatIf ? `${whatIf.categoryName}, save ${formatMoney(savings)} a month` : undefined
        }
        onPress={() => openWhatIf(cut)}
        style={withPressed(styles.tools)}
      >
        <Feather name="sliders" size={16} color={theme.colors.link} />
        <View style={styles.toolCopy}>
          <Text style={styles.toolsText}>Savings ideas</Text>
          {whatIf && (
            <Text style={styles.toolNote}>
              {`${whatIf.categoryName} −${cut}% saves ${formatMoney(savings)} a\u00A0month`}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={theme.colors.link} />
      </Pressable>
    </>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    ledgerHeading: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      columnGap: 8,
      rowGap: 3,
    },
    ledgerNote: {
      flexShrink: 1,
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.home.secondaryText,
    },
    ledgerWarning: { color: theme.colors.expenseText },
    ledgerTitle: {
      flexShrink: 1,
      fontFamily: theme.font.bodyBold,
      fontSize: 12,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
    tools: {
      marginHorizontal: 16,
      marginTop: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toolCopy: { flex: 1, minWidth: 0, gap: 2 },
    toolNote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
    toolsText: {
      flexShrink: 1,
      fontFamily: theme.font.bodyBold,
      fontSize: 15,
      color: theme.colors.textPrimary,
    },
  })
);
