import { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCategoryMonthlyAverages, CategoryBreakdownItem } from '@/db/reports';
import { listSavingsGoals } from '@/db/savingsGoals';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { projectedMonthlySpend, projectGoalPace } from '@/lib/whatIf';
import { parseLocalIsoDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
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

const CUT_OPTIONS = [10, 20, 30, 40, 50];
const DEFAULT_CUT_PCT = 20;

function formatShortDate(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function soonerLabel(days: number): string {
  if (days >= 14) return `${Math.round(days / 7)} weeks sooner`;
  if (days >= 7) return '1 week sooner';
  return `${days} day${days === 1 ? '' : 's'} sooner`;
}

/**
 * A non-destructive sandbox: pick a category, try cutting its spend by a
 * percentage, see how much sooner a savings goal lands. Nothing here is
 * saved — every number is recomputed client-side from data the app
 * already has (src/lib/whatIf.ts), the same way the slider in the design
 * sign-off never touched the database.
 */
export default function WhatIfScreen() {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<CategoryBreakdownItem[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [cutPct, setCutPct] = useState(DEFAULT_CUT_PCT);

  const load = useCallback(async () => {
    const [avgs, goalList] = await Promise.all([getCategoryMonthlyAverages(3), listSavingsGoals()]);
    const spendable = avgs.filter((c) => c.totalMinor > 0);
    const openGoals = goalList.filter((g) => !g.archived && !goalProgress(g.currentAmountMinor, g.targetAmountMinor).done);
    setCategories(spendable);
    setGoals(openGoals);
    // Falls back to the first item both when nothing's picked yet AND when
    // the previously-picked one dropped out of this fresh list (its spend
    // went to 0, or the goal it pointed at was just finished/archived) —
    // otherwise a stale id survives with nothing in the list to match it,
    // and every chip below renders with none of them active.
    setCategoryId((prev) => (prev && spendable.some((c) => c.categoryId === prev) ? prev : (spendable[0]?.categoryId ?? null)));
    setGoalId((prev) => (prev && openGoals.some((g) => g.id === prev) ? prev : (openGoals[0]?.id ?? null)));
  }, []);
  const { loaded, loadError } = useScreenLoad(load);

  const selectedCategory = categories.find((c) => c.categoryId === categoryId) ?? null;
  const selectedGoal = goals.find((g) => g.id === goalId) ?? null;
  const cut = selectedCategory ? projectedMonthlySpend(selectedCategory.totalMinor, cutPct) : null;
  const pace = selectedGoal && cut ? projectGoalPace(selectedGoal, cut.extraMinor) : null;

  const reset = () => setCutPct(DEFAULT_CUT_PCT);

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="What if...?" showBack />
        <View style={styles.card}>
          <Skeleton width={120} height={12} radius={4} />
          <Skeleton width={200} height={10} radius={4} style={{ marginTop: 10 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="What if...?" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}

        <Text style={styles.intro}>Try a change, see where it lands. Nothing here is saved until you act on it.</Text>

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
                    <Amount minor={selectedCategory.totalMinor} sensitive={selectedCategory.isSensitive} /> / month
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
                  Set a savings goal from the Savings goals section to see how much sooner this change could get
                  you there.
                </Text>
              </View>
            ) : cut ? (
              <View style={styles.goalCard}>
                <Text style={styles.extraLabel}>
                  Extra <Amount minor={cut.extraMinor} sensitive={selectedCategory?.isSensitive} /> / month toward
                </Text>
                <View style={[styles.chipRow, { marginTop: 10 }]}>
                  {goals.map((g) => (
                    <Chip key={g.id} label={g.name} active={g.id === goalId} onPress={() => setGoalId(g.id)} />
                  ))}
                </View>

                {pace && !pace.alreadyDone && (
                  <View style={styles.paceRow}>
                    <View>
                      <View style={styles.paceHeadRow}>
                        <Text style={styles.paceLabel}>Current pace</Text>
                        <Text style={styles.paceDate}>{pace.currentEtaDate ? formatShortDate(pace.currentEtaDate) : '—'}</Text>
                      </View>
                      <View style={styles.paceTrack}>
                        <View
                          style={[styles.paceFill, { width: pace.currentEtaDate ? '80%' : '0%', backgroundColor: theme.colors.textMuted }]}
                        />
                      </View>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <View style={styles.paceHeadRow}>
                        <Text style={styles.paceLabelStrong}>With this change</Text>
                        <Text style={styles.paceDateStrong}>{pace.newEtaDate ? formatShortDate(pace.newEtaDate) : '—'}</Text>
                      </View>
                      <View style={styles.paceTrack}>
                        <View
                          style={[
                            styles.paceFill,
                            {
                              width: pace.newEtaDate ? `${Math.max(20, 80 - Math.min(60, pace.daysSooner / 3))}%` : '0%',
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
