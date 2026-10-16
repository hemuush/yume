import { ScreenLoadError } from '@/components/ScreenLoadError';
import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDailySpendingGoal, setDailySpendingGoal } from '@/db/settings';
import { getDailyGoalStreakSeries, DailyGoalStreakPoint, getTodaySpend } from '@/db/reports';
import { stageForStreak, stageLabel, GrowthStage } from '@/lib/gardenGrowth';
import { parseLocalIsoDate, toLocalIsoDate } from '@/lib/date';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { SuuIllustration } from '@/components/SuuIllustration';
import { Glass } from '@/components/Glass';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { GardenMonthCard } from '@/features/garden/GardenMonthCard';
import { buildGardenMonth } from '@/features/garden/gardenMonth';
import { GardenPlant } from '@/features/garden/GardenPlant';
import { theme } from '@/constants/theme';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { AmountField, AmountPadDock } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { toMinor, formatMoney } from '@/lib/money';
import { styles } from '@/features/garden/garden.styles';
import { errorMessage } from '@/lib/errorMessage';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { router } from 'expo-router';
import { usePrivacy } from '@/theme/PrivacyContext';

const POT_COUNT = 5;
const LEGEND_STAGES: GrowthStage[] = ['seed', 'sprout', 'sapling', 'bloom'];

function noteFor(stage: GrowthStage, streak: number): string {
  // `stage === 'seed'` only happens at streak exactly 0 (stageForStreak's threshold); today's logged spend
  // resolves the streak at once, so there is no separate in-between state to word differently.
  if (stage === 'seed')
    return "No streak going right now â€” spend under today's goal to plant the first seed.";
  if (stage === 'sprout')
    return `${streak} day${streak === 1 ? '' : 's'} running. A couple more and it's a sapling.`;
  if (stage === 'sapling') return `${streak} days running â€” getting there. A full week and it blooms.`;
  return `${streak} days running â€” in full bloom. A day over the goal starts it again from a seed.`;
}

/** Daily spending-goal progress and streak history, with provisional results for today. */
export default function GardenScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls; the amount pad's scroll tracking feeds it.
  const { collapse, headerHeight, onJsScroll, settleJs } = useCollapsingHeader();
  const [dailyGoalMinor, setDailyGoalMinor] = useState<number | null>(null);
  const [series, setSeries] = useState<DailyGoalStreakPoint[]>([]);
  const [todaySpend, setTodaySpend] = useState<{ minor: number; private: boolean } | null>(null);
  const todaySpentMinor = todaySpend?.minor ?? 0;
  const { hideAmounts } = usePrivacy();
  // The first-run goal form, right in the empty garden rather than directions to Settings.
  const [goalInput, setGoalInput] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalSaving, setGoalSaving] = useState(false);

  const load = useCallback(async () => {
    const goal = await getDailySpendingGoal();
    setDailyGoalMinor(goal);
    const [streakSeries, todaySpend] = await Promise.all([
      // Back to the 1st (or the last five days, early in a month) for the bed and the month calendar.
      goal != null
        ? getDailyGoalStreakSeries(goal, Math.max(POT_COUNT, new Date().getDate()))
        : Promise.resolve([]),
      goal != null ? getTodaySpend(undefined, hideAmounts) : Promise.resolve(0),
    ]);
    setSeries(streakSeries);
    setTodaySpend({ minor: todaySpend, private: hideAmounts });
  }, [hideAmounts]);
  const { loaded, hasData, loadError, reload } = useScreenLoad(load);

  // Same rule Settings' daily goal uses: a positive amount, saved as the same setting.
  const startGoal = async () => {
    setGoalError(null);
    const minor = toMinor(parseFloat(goalInput || '0'));
    if (!Number.isFinite(minor) || minor <= 0) {
      setGoalError('Enter a valid daily amount');
      return;
    }
    setGoalSaving(true);
    try {
      await setDailySpendingGoal(minor);
      await reload();
    } catch (e) {
      setGoalError(errorMessage(e));
    } finally {
      setGoalSaving(false);
    }
  };

  const today = toLocalIsoDate(new Date());
  const streakToday = series.length > 0 ? series[series.length - 1].streakDays : 0;
  // The bed shows the last five days; the calendar the whole month so far.
  const potDays = series.slice(-POT_COUNT);
  const month = buildGardenMonth(series, today);
  const stageToday = stageForStreak(streakToday);

  if (!hasData && loadError)
    return <ScreenLoadError title="Suuâ€™s garden" message={loadError} onRetry={() => void reload()} />;

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        <SkyHeader title="Suu's garden" showBack hideUser wallpaper />
        <View style={{ paddingTop: 20 }}>
          <Glass radius={28} style={[styles.bed, { marginTop: 0 }]}>
            {Array.from({ length: POT_COUNT }, (_, i) => (
              <View key={i} style={styles.pot}>
                <View style={styles.plantSlot}>
                  <Skeleton width={30} height={40} radius={8} />
                </View>
                <Skeleton width={36} height={11} radius={6} />
              </View>
            ))}
          </Glass>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <AmountPadDock>
        {(scrollProps) => (
          <>
            <ScrollView
              {...scrollProps}
              onScroll={(e) => {
                scrollProps.onScroll(e);
                onJsScroll(e.nativeEvent.contentOffset.y);
              }}
              // A slow release settles the header open or closed; a fling carries on and settles at its end.
              onScrollEndDrag={(e) => {
                if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.2)
                  settleJs(e.nativeEvent.contentOffset.y, (y) =>
                    scrollProps.ref.current?.scrollTo({ y, animated: true })
                  );
              }}
              onMomentumScrollEnd={(e) =>
                settleJs(e.nativeEvent.contentOffset.y, (y) =>
                  scrollProps.ref.current?.scrollTo({ y, animated: true })
                )
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingTop: headerHeight,
                paddingBottom: theme.layout.screenScrollPad + insets.bottom,
              }}
            >
              {loadError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorTitle}>Couldn't load your garden</Text>
                  <Text style={styles.errorDetail}>{loadError}</Text>
                  <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void reload()} />
                </View>
              )}

              <Text style={styles.intro}>Keep spending under your daily goal to grow your streak.</Text>

              {dailyGoalMinor == null ? (
                <EmptyState
                  title="Set a daily spending goal to start"
                  subtitle="Every day you keep under it plants something here. You can change it later in Settings."
                >
                  <AmountField
                    label="Amount per day"
                    value={goalInput}
                    onChangeText={setGoalInput}
                    placeholder="e.g. 800"
                  />
                  {goalError && <Text style={styles.goalError}>{goalError}</Text>}
                  <PrimaryButton
                    title={goalSaving ? 'Savingâ€¦' : 'Start growing'}
                    onPress={startGoal}
                    disabled={goalSaving}
                  />
                </EmptyState>
              ) : (
                <>
                  <Glass
                    radius={24}
                    tone="strong"
                    style={[
                      styles.streakSummary,
                      { backgroundColor: shade(secondary, 94), borderColor: secondary },
                    ]}
                  >
                    <View style={styles.summaryHead}>
                      <SuuIllustration size={16} pose={streakToday > 0 ? 'default' : 'sleepy'} />
                      <Text style={styles.streakValue}>
                        {streakToday > 0 ? `${streakToday}-day streak` : 'No streak yet'}
                      </Text>
                    </View>
                    <View style={styles.goalRow}>
                      <Text style={styles.summaryGoal}>
                        Daily goal Â· under {formatMoney(dailyGoalMinor)}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change daily goal"
                        style={styles.editGoal}
                        onPress={() => router.push({ pathname: '/profile', params: { tab: 'settings' } })}
                      >
                        <Text style={styles.editGoalText}>Edit goal</Text>
                      </Pressable>
                    </View>
                    {todaySpend?.private === hideAmounts && (
                      <Text style={styles.summaryGoal}>
                        {todaySpentMinor <= dailyGoalMinor
                          ? `${formatMoney(dailyGoalMinor - todaySpentMinor)} left today`
                          : `${formatMoney(todaySpentMinor - dailyGoalMinor)} over today's goal`}
                      </Text>
                    )}
                    <Text style={styles.introHint}>
                      {hideAmounts ? 'Sensitive spending excluded from the amount above. ' : ''}Today's result
                      can change until the day ends.
                    </Text>
                  </Glass>
                  <Glass radius={28} tone="strong" style={styles.bed}>
                    {potDays.map((point) => {
                      const isToday = point.date === today;
                      const stage = stageForStreak(point.streakDays);
                      const label = isToday
                        ? 'Today'
                        : parseLocalIsoDate(point.date).toLocaleDateString(undefined, { weekday: 'short' });
                      return (
                        <View key={point.date} style={[styles.pot, isToday && styles.potToday]}>
                          <View style={styles.plantSlot}>
                            <GardenPlant
                              stage={stage}
                              size={isToday ? 48 : 40}
                              animKey={isToday ? `garden:${point.date}` : undefined}
                            />
                          </View>
                          <View style={styles.soil} />
                          <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
                        </View>
                      );
                    })}
                  </Glass>

                  <Glass radius={22} style={styles.note}>
                    <View style={styles.legend}>
                      {LEGEND_STAGES.map((stage) => (
                        <View key={stage} style={styles.legendItem}>
                          <GardenPlant stage={stage} size={30} decorative />
                          <Text style={styles.legendLabel}>{stageLabel(stage)}</Text>
                        </View>
                      ))}
                    </View>

                    <Text style={styles.noteLabel}>Suu says</Text>
                    <Text style={styles.noteText}>{noteFor(stageToday, streakToday)}</Text>
                  </Glass>

                  <GardenMonthCard month={month} today={today} />
                </>
              )}
            </ScrollView>
            <SkyHeader
              title="Suu's garden"
              showBack
              hideUser
              wallpaper
              collapse={collapse}
              summary={
                streakToday > 0 ? (
                  <HeaderSummary
                    figure={`${streakToday}-day`}
                    rest="streak"
                    dot={theme.colors.secondaryDeep}
                  />
                ) : undefined
              }
            />
          </>
        )}
      </AmountPadDock>
    </View>
  );
}
