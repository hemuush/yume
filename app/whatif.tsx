import { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getCategoryMonthlyAverages, CategoryBreakdownItem } from '@/db/reports';
import { listSavingsGoals } from '@/db/savingsGoals';
import { getAccountMonthlyGrowth } from '@/db/ledger';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { projectedMonthlySpend, projectGoalPace } from '@/lib/whatIf';
import { SavingsGoal } from '@/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { Chip } from '@/components/Chip';
import { Amount } from '@/components/Amount';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from '@/features/whatif/whatif.styles';
import { dayMonth } from '@/lib/dateLabels';
import { daysUntilIsoDate } from '@/lib/date';

const CUT_OPTIONS = [10, 20, 30, 40, 50];
const DEFAULT_CUT_PCT = 20;

function soonerLabel(days: number): string {
  if (days >= 14) return `${Math.round(days / 7)} weeks sooner`;
  if (days >= 7) return '1 week sooner';
  return `${days} day${days === 1 ? '' : 's'} sooner`;
}

/**
 * How full each pace bar is: the current pace fills the track, and the new date is the same fraction of it as
 * its days-to-go are of the current ones, so a bigger cut visibly shortens the bar. The floor keeps a tiny
 * bar visible. With no current date to compare against, the new bar is simply full.
 */
function paceBarWidths(pace: {
  currentEtaDate: string | null;
  newEtaDate: string | null;
  daysSooner: number;
}): { current: `${number}%`; next: `${number}%` } {
  const currentDays = pace.currentEtaDate ? Math.max(1, daysUntilIsoDate(pace.currentEtaDate)) : 0;
  const newShare =
    currentDays > 0 ? Math.min(1, Math.max(0.06, (currentDays - pace.daysSooner) / currentDays)) : 1;
  return {
    current: pace.currentEtaDate ? '100%' : '0%',
    next: pace.newEtaDate ? `${Math.round(newShare * 100)}%` : '0%',
  };
}

/**
 * Non-destructive sandbox: pick a category, cut its spend by a percentage, see how much sooner a savings
 * goal lands. Nothing is saved; numbers are recomputed client-side from existing data (src/lib/whatIf.ts).
 */
export default function WhatIfScreen() {
  const insets = useSafeAreaInsets();
  // `category` opens What-if with that category already chosen (from its category page).
  const { category: askedCategoryId } = useLocalSearchParams<{ category?: string }>();
  const [categories, setCategories] = useState<CategoryBreakdownItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [cutPct, setCutPct] = useState(DEFAULT_CUT_PCT);
  // Monthly growth of the account each following goal tracks, by goal id.
  const [growth, setGrowth] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [avgs, goalList] = await Promise.all([getCategoryMonthlyAverages(3), listSavingsGoals()]);
    const spendable = avgs.filter((c) => c.totalMinor > 0);
    const openGoals = goalList.filter(
      (g) => !g.archived && !goalProgress(g.currentAmountMinor, g.targetAmountMinor).done
    );
    const followed = await Promise.all(
      openGoals
        .filter((g) => g.tracksAccount && g.linkedAccountId)
        .map(async (g) => [g.id, await getAccountMonthlyGrowth(g.linkedAccountId!)] as const)
    );
    setGrowth(Object.fromEntries(followed));
    setCategories(spendable);
    setGoals(openGoals);
    // Falls back to the first item when nothing is picked or the picked one left the list (spend went to 0,
    // goal finished/archived); otherwise a stale id survives and no chip renders active.
    setCategoryId((prev) => {
      if (prev && spendable.some((c) => c.categoryId === prev)) return prev;
      if (askedCategoryId && spendable.some((c) => c.categoryId === askedCategoryId)) return askedCategoryId;
      return spendable[0]?.categoryId ?? null;
    });
    setGoalId((prev) => (prev && openGoals.some((g) => g.id === prev) ? prev : (openGoals[0]?.id ?? null)));
  }, [askedCategoryId]);
  const { loaded, loadError } = useScreenLoad(load);

  const selectedCategory = categories.find((c) => c.categoryId === categoryId) ?? null;
  const selectedGoal = goals.find((g) => g.id === goalId) ?? null;
  const cut = selectedCategory ? projectedMonthlySpend(selectedCategory.totalMinor, cutPct) : null;
  const pace =
    selectedGoal && cut
      ? projectGoalPace(
          selectedGoal,
          cut.extraMinor,
          undefined,
          selectedGoal.tracksAccount ? (growth[selectedGoal.id] ?? 0) : undefined
        )
      : null;

  const reset = () => setCutPct(DEFAULT_CUT_PCT);

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="What if…?" showBack />
        <View style={styles.card}>
          <Skeleton width={120} height={12} radius={4} />
          <Skeleton width={200} height={10} radius={4} style={{ marginTop: 10 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="What if…?" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <Text style={styles.intro}>
          Try a change, see where it lands. Nothing here is saved until you act on it.
        </Text>

        {categories.length === 0 ? (
          <EmptyState
            title="Nothing to try yet"
            subtitle="Log a few expenses first — this needs some real spending to project from."
          />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Cut spending on</Text>
              <View style={styles.chipRow}>
                {categories.map((c) => (
                  <Chip
                    key={c.categoryId}
                    label={c.name}
                    active={c.categoryId === categoryId}
                    activeBorderColor={c.color}
                    onPress={() => setCategoryId(c.categoryId)}
                  />
                ))}
              </View>

              {selectedCategory && (
                <View style={styles.avgRow}>
                  <Text style={styles.avgLabel}>currently</Text>
                  <Text style={styles.avgValue}>
                    <Amount minor={selectedCategory.totalMinor} sensitive={selectedCategory.isSensitive} /> /
                    month
                  </Text>
                </View>
              )}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>By how much</Text>
              <View style={styles.chipRow}>
                {CUT_OPTIONS.map((pct) => (
                  <Chip key={pct} label={`-${pct}%`} active={pct === cutPct} onPress={() => setCutPct(pct)} />
                ))}
              </View>

              {cut && selectedCategory && (
                <>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>New monthly spend:</Text>
                    <Amount
                      minor={cut.newMonthlyMinor}
                      sensitive={selectedCategory.isSensitive}
                      style={styles.resultValue}
                    />
                  </View>
                </>
              )}
            </View>

            {goals.length === 0 ? (
              <View style={styles.goalCard}>
                <Text style={styles.extraLabel}>No open savings goals</Text>
                <Text style={[styles.avgLabel, { marginTop: 6 }]}>
                  Set a savings goal from the Savings goals section to see how much sooner this change could
                  get you there.
                </Text>
              </View>
            ) : cut ? (
              <View style={styles.goalCard}>
                <Text style={styles.extraLabel}>
                  Extra <Amount minor={cut.extraMinor} sensitive={selectedCategory?.isSensitive} /> / month
                  toward
                </Text>
                <View style={[styles.chipRow, { marginTop: 10 }]}>
                  {goals.map((g) => (
                    <Chip
                      key={g.id}
                      label={g.name}
                      active={g.id === goalId}
                      onPress={() => setGoalId(g.id)}
                    />
                  ))}
                </View>

                {pace && !pace.alreadyDone && (
                  <View style={styles.paceRow}>
                    <View>
                      <View style={styles.paceHeadRow}>
                        <Text style={styles.paceLabel}>Current pace</Text>
                        <Text style={styles.paceDate}>
                          {pace.currentEtaDate ? dayMonth(pace.currentEtaDate) : '—'}
                        </Text>
                      </View>
                      <View style={styles.paceTrack}>
                        <View
                          style={[
                            styles.paceFill,
                            {
                              width: paceBarWidths(pace).current,
                              backgroundColor: theme.colors.textMuted,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <View style={styles.paceHeadRow}>
                        <Text style={styles.paceLabelStrong}>With this change</Text>
                        <Text style={styles.paceDateStrong}>
                          {pace.newEtaDate ? dayMonth(pace.newEtaDate) : '—'}
                        </Text>
                      </View>
                      <View style={styles.paceTrack}>
                        <View
                          style={[
                            styles.paceFill,
                            {
                              width: paceBarWidths(pace).next,
                              backgroundColor: theme.colors.income,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {pace.daysSooner > 0 ? (
                      <Text style={styles.soonerText}>{soonerLabel(pace.daysSooner)}</Text>
                    ) : (
                      <Text style={styles.neutralText}>
                        {pace.currentEtaDate
                          ? "This change doesn't move the date — try a bigger cut."
                          : selectedGoal?.tracksAccount
                            ? "Its account hasn't grown in the last 3 months, so there's no date to compare yet."
                            : 'Add a bit more progress to this goal first to project a date.'}
                      </Text>
                    )}
                  </View>
                )}
                {pace?.alreadyDone && <Text style={styles.soonerText}>Already reached — nice work.</Text>}
              </View>
            ) : null}

            <View style={styles.footer}>
              <PrimaryButton title="Reset" variant="secondary" onPress={reset} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
