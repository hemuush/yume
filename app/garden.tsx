import { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDailySpendingGoal } from '@/db/settings';
import { getDailyGoalStreakSeries, DailyGoalStreakPoint } from '@/db/reports';
import { listSavingsGoals } from '@/db/savingsGoals';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { stageForStreak, stageLabel, GrowthStage } from '@/lib/gardenGrowth';
import { parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { SavingsGoal } from '@/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { SuuIllustration } from '@/components/SuuIllustration';
import { GardenPlant } from '@/features/garden/GardenPlant';
import { theme } from '@/constants/theme';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from '@/features/garden/garden.styles';

const POT_COUNT = 5;
const LEGEND_STAGES: GrowthStage[] = ['seed', 'sprout', 'sapling', 'bloom'];

function noteFor(stage: GrowthStage, streak: number): string {
  // `stage === 'seed'` only ever happens when `streak` is exactly 0
  // (stageForStreak's own threshold) — today's own spend, once logged,
  // resolves the streak immediately rather than leaving it "pending", so
  // there's no separate in-between state to word differently here.
  if (stage === 'seed') return "No streak going right now — spend under today's goal to plant the first seed.";
  if (stage === 'sprout') return `${streak} day${streak === 1 ? '' : 's'} running. A couple more and it's a sapling.`;
  if (stage === 'sapling') return `${streak} days running — getting there. A full week and it blooms.`;
  return `${streak} days running. Miss a day and it just pauses — it never wilts back to a seed.`;
}

/**
 * A daily-goal streak and a bit of savings-goal context, drawn as
 * something growing rather than another number — see the "Suu's Garden"
 * design sign-off. Deliberately reuses only data the app already tracks:
 * there's no contribution ledger for savings goals (see DATA_MODEL.md), so
 * this shows their overall funded% as supporting context, not a per-day
 * signal the way the daily-goal streak is.
 */
export default function GardenScreen() {
  const insets = useSafeAreaInsets();
  const [dailyGoalMinor, setDailyGoalMinor] = useState<number | null>(null);
  const [series, setSeries] = useState<DailyGoalStreakPoint[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  const load = useCallback(async () => {
    const goal = await getDailySpendingGoal();
    setDailyGoalMinor(goal);
    const [streakSeries, goalList] = await Promise.all([
      goal != null ? getDailyGoalStreakSeries(goal, POT_COUNT) : Promise.resolve([]),
      listSavingsGoals(),
    ]);
    setSeries(streakSeries);
    setGoals(goalList.filter((g) => !g.archived));
  }, []);
  const { loaded, loadError } = useScreenLoad(load);

  const today = toLocalIsoDate(new Date());
  const streakToday = series.length > 0 ? series[series.length - 1].streakDays : 0;
  const stageToday = stageForStreak(streakToday);

  const fundedGoals = goals.filter((g) => g.currentAmountMinor > 0);
  const avgFundedPct =
    fundedGoals.length > 0
      ? Math.round(
          fundedGoals.reduce((sum, g) => sum + goalProgress(g.currentAmountMinor, g.targetAmountMinor).percent, 0) /
            fundedGoals.length
        )
      : 0;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Suu's Garden" showBack />
        <View style={{ paddingTop: 20 }}>
          <View style={[styles.bed, { marginTop: 0 }]}>
            {Array.from({ length: POT_COUNT }, (_, i) => (
              <View key={i} style={styles.pot}>
                <View style={styles.plantSlot}>
                  <Skeleton width={30} height={40} radius={8} />
                </View>
                <Skeleton width={36} height={11} radius={6} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Suu's Garden" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your garden</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <Text style={styles.intro}>Grows with every day you keep, and every rupee you save.</Text>

        {dailyGoalMinor == null ? (
          <EmptyState
            title="Set a daily spending goal to start"
            subtitle="Profile → Settings → Money → Daily spending goal. Once it's set, every day you keep to it plants something here."
          />
        ) : (
          <>
            <View style={styles.streakPill}>
              <SuuIllustration size={16} pose={streakToday > 0 ? 'default' : 'sleepy'} />
              <Text style={styles.streakPillText}>
                {streakToday > 0 ? `${streakToday}-day streak` : 'No streak yet'}
              </Text>
            </View>

            <View style={styles.bed}>
              {series.map((point) => {
                const isToday = point.date === today;
                const stage = stageForStreak(point.streakDays);
                const label = isToday
                  ? 'Today'
                  : parseLocalIsoDate(point.date).toLocaleDateString(undefined, { weekday: 'short' });
                return (
                  <View key={point.date} style={[styles.pot, isToday && styles.potToday]}>
                    <View style={styles.plantSlot}>
                      <GardenPlant stage={stage} size={isToday ? 40 : 32} />
                    </View>
                    <View style={styles.soil} />
                    <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.legend}>
              {LEGEND_STAGES.map((stage) => (
                <View key={stage} style={styles.legendItem}>
                  <GardenPlant stage={stage} size={20} />
                  <Text style={styles.legendLabel}>{stageLabel(stage)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.note}>
              <Text style={styles.noteLabel}>Suu says</Text>
              <Text style={styles.noteText}>{noteFor(stageToday, streakToday)}</Text>
            </View>
          </>
        )}

        {fundedGoals.length > 0 && (
          <View style={styles.goalsSummary}>
            <SuuIllustration size={16} />
            <Text style={styles.goalsSummaryText}>
              {fundedGoals.length} savings goal{fundedGoals.length === 1 ? '' : 's'} with real progress — {avgFundedPct}% funded on average.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
