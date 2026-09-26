import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { listBudgetsForMonth } from '@/db/budgets';
import { listSavingsGoals } from '@/db/savingsGoals';
import { listRecurringRules } from '@/db/recurring';
import { listLoans, getNextDueInstallment } from '@/db/loans';
import { listPeople } from '@/db/people';
import { listAccounts, listCategories } from '@/db/ledger';
import { getDailyGoalStreakSeries } from '@/db/reports';
import { getDailySpendingGoal } from '@/db/settings';
import { theme } from '@/constants/theme';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Skeleton } from '@/components/Skeleton';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { usePressScale } from '@/lib/usePressScale';
import { buildPlanTiles, PlanInput, PlanTile } from '@/features/plan/planTiles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Icon + pastel per tile — all existing theme swatches, inside the app's pastel band. */
const TILE_LOOK: Record<string, { icon: string; color: string }> = {
  budgets: { icon: 'chart-donut', color: theme.colors.flatLime },
  goals: { icon: 'flag-checkered', color: theme.colors.secondary },
  recurring: { icon: 'sync', color: theme.colors.primary },
  whatif: { icon: 'lightbulb-on-outline', color: theme.colors.accent },
  loans: { icon: 'handshake-outline', color: theme.colors.gold },
  people: { icon: 'account-heart-outline', color: theme.colors.idCoral },
  garden: { icon: 'sprout', color: theme.colors.flatPink },
};

/**
 * One place for everything you're planning: budgets, goals, recurring, the
 * What-if sandbox, loans, friends & family, and Suu's Garden. Each tile
 * carries one live line (see planTiles.ts) so the page is worth a glance,
 * not just a menu.
 */
export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState<PlanInput | null>(null);

  const loadPlan = useCallback(async () => {
    const [budgets, goals, rules, loans, people, nextDue, categories, accounts, dailyGoal] =
      await Promise.all([
        listBudgetsForMonth(),
        listSavingsGoals(),
        listRecurringRules(),
        listLoans(),
        listPeople(),
        getNextDueInstallment(),
        listCategories(),
        listAccounts(),
        getDailySpendingGoal(),
      ]);
    const streak = dailyGoal != null ? await getDailyGoalStreakSeries(dailyGoal, 1) : null;
    const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';
    setInput({
      budgets,
      goals,
      // Same label Home's Upcoming list uses for a rule.
      recurring: rules.map((r) => ({
        active: r.active,
        nextRunDate: r.nextRunDate,
        label:
          r.type === 'transfer'
            ? `${accountName(r.accountId)} → ${accountName(r.toAccountId)}`
            : r.note || categories.find((c) => c.id === r.categoryId)?.name || 'Recurring',
      })),
      nextEmiDueDate: nextDue?.dueDate ?? null,
      activeLoanCount: loans.filter((l) => l.status !== 'closed').length,
      people,
      gardenStreakDays: streak ? (streak[streak.length - 1]?.streakDays ?? 0) : null,
    });
  }, []);
  const { loaded, loadError } = useScreenLoad(loadPlan);

  const tiles = buildPlanTiles(
    input ?? {
      budgets: [],
      goals: [],
      recurring: [],
      nextEmiDueDate: null,
      activeLoanCount: 0,
      people: [],
      gardenStreakDays: null,
    }
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Plan" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn&rsquo;t load your plans</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <PlanTileCard key={tile.key} tile={tile} loading={!loaded} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PlanTileCard({ tile, loading }: { tile: PlanTile; loading: boolean }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const look = TILE_LOOK[tile.key];
  const chevron = <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />;
  return (
    <AnimatedPressable
      onPress={() => router.push(tile.route)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={loading ? tile.title : `${tile.title}, ${tile.line}`}
      style={[styles.tile, tile.wide && styles.tileWide, animatedStyle]}
    >
      <View style={tile.wide ? styles.wideIcon : styles.tileTop}>
        <CategoryIcon name={look.icon} color={look.color} size={17} square={36} />
        {!tile.wide && chevron}
      </View>
      <View style={tile.wide && styles.wideText}>
        <Text style={styles.tileTitle} numberOfLines={1}>
          {tile.title}
        </Text>
        {loading ? (
          <Skeleton width={96} height={10} radius={4} style={{ marginTop: 6 }} />
        ) : (
          <Text style={styles.tileLine} numberOfLines={2}>
            {tile.line}
          </Text>
        )}
      </View>
      {tile.wide && chevron}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 },
  // Two per row: each takes just under half, the 12px gap takes the rest.
  tile: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 118,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 14,
  },
  // The last, odd tile: one row across — icon, text, chevron.
  tileWide: { flexBasis: '100%', minHeight: 0, flexDirection: 'row', alignItems: 'center' },
  wideIcon: { marginRight: 12 },
  wideText: { flex: 1, minWidth: 0 },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tileTitle: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  tileLine: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
});
