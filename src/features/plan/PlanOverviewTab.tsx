import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Text } from '@/components/Text';
import { withPressed } from '@/lib/pressed';
import { useStacked } from '@/lib/useStacked';
import { themedStyles } from '@/theme/themedStyles';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { PendingRefunds } from '@/features/transactions/PendingRefunds';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { PLAN_DAYS } from './planOverview';
import { PlanOverviewPanels } from './PlanOverviewPanels';
import { PlanPeopleHabit } from './PlanPeopleHabit';
import { ComingUpSection } from './ComingUpSection';
import { RunwayCard } from './RunwayCard';

/** Overview brings the next cash decisions and collection summaries together. */
const Runway = memo(RunwayCard);
const Panels = memo(PlanOverviewPanels);
const PeopleHabit = memo(PlanPeopleHabit);

export const PlanOverviewTab = memo(function PlanOverviewTab({
  data,
  refreshToken,
  actions,
}: {
  data: PlanData;
  /** Changes with each load of the page: the pending refunds read their own data again. */
  refreshToken: object;
  actions: PlanActions;
}) {
  const stacked = useStacked('late');
  const { open, openDetail, selectTab, openRefund, payEmi } = actions;
  const viewPayments = useCallback(() => selectTab('upcoming', 'all'), [selectTab]);
  const viewDay = useCallback((date: string) => selectTab('upcoming', date), [selectTab]);
  const addAccount = useCallback(() => openDetail('new-account', ''), [openDetail]);
  const openBudget = useCallback((id: string) => openDetail('budget', id), [openDetail]);
  const openPeople = useCallback(() => open('/people'), [open]);
  const openPerson = useCallback((id: string) => openDetail('person', id), [openDetail]);
  const openGarden = useCallback(() => open('/garden'), [open]);
  const openLoan = useCallback((id: string) => openDetail('loan', id), [openDetail]);
  const openRule = useCallback((id: string) => openDetail('rule', id), [openDetail]);
  const next = useMemo(
    () =>
      data.schedule.days
        .filter((day) => day.outMinor > 0)
        .map((day) => {
          const items = day.items.filter(
            (item) =>
              item.dueDate >= data.today &&
              (item.kind === 'bill' || item.kind === 'emi' || item.transfer?.flow === 'out')
          );
          return { date: day.date, items, outMinor: items.reduce((sum, item) => sum + item.amountMinor, 0) };
        })
        .find((day) => day.items.length > 0),
    [data.schedule.days, data.today]
  );
  const activeGoals = data.goals.filter((goal) => !goal.archived);
  const openGoals = activeGoals.filter((goal) => goal.currentAmountMinor < goal.targetAmountMinor);
  const budgetLeft = data.budgets.budgetedMinor - data.budgets.usedMinor;
  const holdings = data.investments.holdings.length + data.investments.otherCurrency.length;
  const money = (minor: number) => formatMoney(minor, data.currency);
  const snapshot = [
    {
      name: 'Budgets',
      icon: 'chart-donut',
      id: 'budgets' as const,
      subtitle: data.budgets.rows.length
        ? budgetLeft < 0
          ? 'Over planned limits'
          : 'Remaining this month'
        : 'No budgets this month',
      amount: data.budgets.rows.length ? money(Math.abs(budgetLeft)) : '',
    },
    {
      name: 'Goals',
      icon: 'flag-outline',
      id: 'goals' as const,
      subtitle: !activeGoals.length
        ? 'No active goals'
        : data.hideAmounts
          ? 'Savings hidden'
          : 'Goals in progress',
      amount: !activeGoals.length || data.hideAmounts ? '' : String(openGoals.length),
    },
    {
      name: 'Investments',
      icon: 'chart-line',
      id: 'investments' as const,
      subtitle: !holdings
        ? 'No holdings'
        : data.hideAmounts
          ? 'Values hidden'
          : data.investments.otherCurrency.length
            ? 'Holdings across currencies'
            : 'Portfolio value',
      amount:
        !holdings || data.hideAmounts
          ? ''
          : data.investments.otherCurrency.length
            ? String(holdings)
            : formatMaskableMoney(data.investments.valueMinor, { currency: data.investments.currency }),
    },
    {
      name: 'Debt',
      icon: 'credit-card-outline',
      id: 'debt' as const,
      subtitle: data.loans.borrowedCount
        ? 'Principal remaining'
        : data.loans.rows.length
          ? 'Money lent'
          : 'No open loans',
      amount: data.loans.rows.length
        ? money(data.loans.borrowedCount ? data.loans.debtLeftMinor : data.loans.lentLeftMinor)
        : '',
    },
  ];
  return (
    <>
      <Runway
        onViewPayments={viewPayments}
        onViewDay={viewDay}
        dueSoon={data.dueSoon}
        runway={data.runway}
        hasAccounts={data.hasAccounts}
        days={PLAN_DAYS}
        onAddAccount={addAccount}
      />
      <Panels
        budgets={data.budgets}
        groups={data.dueGroups}
        today={data.today}
        onTab={selectTab}
        onBudget={openBudget}
      />
      {next && (
        <Section
          compact
          title="Next payments"
          subtitle={`${weekdayDayMonth(next.date)} · ${next.items.length} ${next.items.length === 1 ? 'payment' : 'payments'} · ${money(next.outMinor)} due`}
          actionLabel="View day"
          onSeeAll={() => viewDay(next.date)}
        >
          <ComingUpSection
            preview
            limit={2}
            groups={[next]}
            today={data.today}
            onOpen={open}
            onLoan={openLoan}
            onRule={openRule}
            onPay={payEmi}
          />
        </Section>
      )}
      <Section compact title="Plan at a glance">
        <View style={styles.tiles}>
          {snapshot.map(({ id, name, icon, subtitle, amount }) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={[name, subtitle, amount].filter(Boolean).join('. ')}
              onPress={() => (id === 'debt' ? selectTab('debt') : selectTab('money', undefined, id))}
              style={withPressed([styles.tile, stacked && styles.tileFull])}
            >
              <View style={styles.tileHead}>
                <View style={[styles.disc, { backgroundColor: theme.colors.collection[id] }]}>
                  <CategoryGlyph name={icon} size={14} color={theme.colors.onFlat} />
                </View>
                <Text style={styles.metricName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
              {amount ? <Text style={styles.metricValue}>{amount}</Text> : null}
              <Text style={styles.metricSubtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>
      <View style={{ marginHorizontal: 16 }}>
        <PendingRefunds summaryOnly refreshToken={refreshToken} onOpen={openRefund} />
      </View>
      <Section compact title="People & habit">
        <PeopleHabit
          people={data.people}
          topPeople={data.topPeople}
          habit={data.habit}
          goalMinor={data.dailyGoalMinor}
          onPeople={openPeople}
          onPerson={openPerson}
          onGarden={openGarden}
        />
      </Section>
    </>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16 },
    tile: {
      flexGrow: 1,
      flexBasis: '44%',
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
    },
    tileFull: { flexBasis: '100%' },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    disc: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    metricName: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontFamily: theme.font.bodyMedium,
      color: theme.colors.textPrimary,
    },
    metricValue: {
      fontSize: 17,
      fontFamily: theme.font.bodyBold,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    metricSubtitle: { fontSize: 12, fontFamily: theme.font.body, color: theme.colors.home.secondaryText },
  })
);
