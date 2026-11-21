import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { GrowFill } from '@/components/GrowFill';
import { Text } from '@/components/Text';
import { withPressed } from '@/lib/pressed';
import { useStacked } from '@/hooks/useStacked';
import { themedStyles } from '@/theme/themedStyles';
import { formatMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { PendingRefunds } from '@/features/transactions/PendingRefunds';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { PLAN_DAYS } from './planOverview';
import { planTiles } from './planTiles';
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
  const money = (minor: number) => formatMoney(minor, data.currency);
  const snapshot = planTiles(data);
  return (
    <>
      <Runway
        // Next payments below already opens the schedule; the link here is for when there are none to show.
        onViewPayments={next ? undefined : viewPayments}
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
          {snapshot.map(({ id, name, icon, subtitle, amount, progress, over }) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={[name, subtitle, amount].filter(Boolean).join('. ')}
              onPress={() => (id === 'debt' ? selectTab('debt') : selectTab('money', undefined, id))}
              style={withPressed([styles.tile, stacked && styles.tileFull])}
            >
              <View style={styles.tileHead}>
                <View style={[styles.disc, { backgroundColor: theme.colors.collection[id] }]}>
                  <CategoryGlyph name={icon} size={12} color={theme.colors.onFlat} />
                </View>
                <Text style={styles.metricName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
              {amount ? (
                <Text style={[styles.metricValue, over && styles.metricOver]} numberOfLines={1}>
                  {amount}
                </Text>
              ) : null}
              {progress != null && (
                <View style={styles.track}>
                  <GrowFill
                    animKey={`plan:tile:${id}`}
                    pct={progress * 100}
                    style={[
                      styles.fill,
                      { backgroundColor: over ? theme.colors.expense : theme.colors.collection[id] },
                    ]}
                  />
                </View>
              )}
              <Text style={[styles.metricSubtitle, over && styles.metricOver]} numberOfLines={1}>
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
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16 },
    tile: {
      flexGrow: 1,
      flexBasis: '44%',
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 2,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
    },
    tileFull: { flexBasis: '100%' },
    tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    disc: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    metricName: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontFamily: theme.font.bodyMedium,
      color: theme.colors.textPrimary,
    },
    track: {
      height: 5,
      borderRadius: 3,
      overflow: 'hidden',
      marginVertical: 3,
      backgroundColor: theme.colors.home.edge,
    },
    fill: { height: 5, borderRadius: 3 },
    metricOver: { color: theme.colors.expenseText },
    metricValue: {
      fontSize: 18,
      fontFamily: theme.font.bodyBold,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    metricSubtitle: { fontSize: 11, fontFamily: theme.font.body, color: theme.colors.home.secondaryText },
  })
);
