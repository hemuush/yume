import { View, Pressable, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { softTint } from '@/components/softTint';
import { hueFor } from '@/lib/hueFor';
import { usePressScale } from '@/lib/usePressScale';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { projectedMonthlySpend } from '@/lib/whatIf';
import { usePrivacy } from '@/theme/PrivacyContext';
import { Account, SavingsGoal } from '@/types';
import { WHAT_IF_CUTS } from './planOverview';
import { styles } from './plan.styles';
import { PlanSummaryRow, PlanListAdd, summaryListStyle } from './PlanSummaryRow';
import { TileGrid } from './PlanGrid';
import { compactMoney } from '@/lib/compactMoney';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Saving toward: readable goal summaries with a separate progress track, then a card to start another.
 * With savings amounts hidden the progress and saved figure are withheld; only the target shows. No goals yet: one card saying how to start.
 */
export function GoalsStrip({
  goals,
  savingsAccounts,
  onOpen,
  onGoal,
  onAdd,
  limit,
  compact = false,
  showAdd = false,
  hideAdd = false,
}: {
  goals: SavingsGoal[];
  /** Savings accounts a new goal could follow, with their balances. */
  savingsAccounts: Account[];
  onOpen: () => void;
  onGoal?: (id: string) => void;
  onAdd?: () => void;
  /** Tiles shown at most (default: two rows). */
  limit?: number;
  /** Flat goal rows; privacy hides both progress and saved amount. */
  compact?: boolean;
  showAdd?: boolean;
  hideAdd?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const active = goals.filter((g) => !g.archived);
  if (active.length === 0) {
    return (
      <Pressable
        onPress={onAdd ?? onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel={onAdd ? 'Create a savings goal' : 'Open savings goals'}
      >
        <Glass style={[styles.card, cardSurface.neutral]}>
          <Text style={styles.title}>Start a goal that fills up by itself</Text>
          <Text style={styles.sub}>
            {savingsAccounts.length > 0
              ? `Follow ${savingsAccounts
                  .slice(0, 2)
                  .map(
                    (a) =>
                      `${a.name} (${formatMaskableMoney(a.currentBalanceMinor, { masked: hideAmounts })})`
                  )
                  .join(' or ')}, or add money yourself`
              : 'A trip, a fund, a gadget. Track it here.'}
          </Text>
        </Glass>
      </Pressable>
    );
  }
  if (compact) {
    return (
      <View style={summaryListStyle}>
        {active.slice(0, limit ?? active.length).map((goal) => {
          const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
          const pct = Math.round(Math.min(100, percent));
          return (
            <PlanSummaryRow
              key={goal.id}
              name={goal.name}
              subtitle={
                hideAmounts
                  ? `Target ${formatMoney(goal.targetAmountMinor)}`
                  : `${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}`
              }
              amount={hideAmounts ? 'Saved amount hidden' : done ? 'Completed' : `${pct}%`}
              icon={goal.linkedAccountId ? 'bank-outline' : 'flag-variant-outline'}
              progress={hideAmounts ? undefined : pct}
              color={theme.colors.incomeText}
              accessibilityLabel={
                hideAmounts
                  ? `${goal.name}, saved amount hidden, target ${formatMoney(goal.targetAmountMinor)}. Open savings goals`
                  : `${goal.name}, ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}, ${done ? 'reached' : `${pct} percent`}. Open savings goals`
              }
              onPress={() => (onGoal ? onGoal(goal.id) : onOpen())}
            />
          );
        })}
        {showAdd && <PlanListAdd label="Add goal" onPress={onAdd ?? onOpen} />}
      </View>
    );
  }
  return (
    <TileGrid
      showAdd={!hideAdd}
      tiles={active.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          masked={hideAmounts}
          onPress={() => (onGoal ? onGoal(g.id) : onOpen())}
        />
      ))}
      label="New goal"
      accessibilityLabel="Open savings goals to start a new one"
      onAdd={onAdd ?? onOpen}
      limit={limit}
    />
  );
}

function GoalCard({ goal, masked, onPress }: { goal: SavingsGoal; masked: boolean; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const hue = hueFor(goal.id);
  const pct = Math.round(Math.min(100, percent));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.tileWrap, animatedStyle]}
      accessibilityRole="button"
      accessibilityLabel={
        masked
          ? `${goal.name}, saved amount hidden, target ${formatMoney(goal.targetAmountMinor)}. Open savings goals`
          : `${goal.name}, ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}, ${
              done ? 'reached' : `${pct} percent`
            }. Open savings goals`
      }
    >
      <Glass radius={16} style={[styles.tileFill, cardSurface.neutral]}>
        <View style={styles.tileHead}>
          <View style={[styles.tileIcon, { backgroundColor: softTint(hue, 0.75) }]}>
            <MaterialCommunityIcons
              name={goal.linkedAccountId ? 'bank-outline' : 'flag-variant-outline'}
              size={14}
              color={theme.colors.ink}
            />
          </View>
          {masked ? (
            <Feather name="eye-off" size={16} color={theme.colors.textMuted} />
          ) : done ? (
            <StatusBadge label="Completed" tone="complete" />
          ) : (
            <Text style={styles.tilePct}>
              {pct}
              <Text style={styles.tilePctSign}>%</Text>
            </Text>
          )}
        </View>
        <Text style={styles.tileName} numberOfLines={2}>
          {goal.name}
        </Text>
        {!masked && (
          <View style={styles.tileTrack} pointerEvents="none">
            <View style={[styles.tileProgress, { width: `${pct}%`, backgroundColor: hue }]} />
          </View>
        )}
        <Text style={styles.tileAmt} numberOfLines={2}>
          {masked
            ? `Target ${compactMoney(goal.targetAmountMinor)}`
            : `${compactMoney(goal.currentAmountMinor)} of ${compactMoney(goal.targetAmountMinor)}`}
        </Text>
      </Glass>
    </AnimatedPressable>
  );
}

/**
 * What-if as a tile: your biggest spending category and what a 10% cut would free up a month. The tile opens
 * the sandbox with that cut picked, where the sizes can be changed. Too little spending to project from: one
 * line saying so.
 */
export function WhatIfCard({
  whatIf,
  onOpen,
}: {
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  onOpen: (cut: number) => void;
}) {
  const cut = WHAT_IF_CUTS[1];
  const extra = whatIf ? projectedMonthlySpend(whatIf.avgMonthlyMinor, cut).extraMinor : 0;
  return (
    <Pressable
      onPress={() => onOpen(cut)}
      style={withPressed(styles.tileWrap)}
      accessibilityRole="button"
      accessibilityLabel="Open the what-if sandbox"
    >
      <Glass radius={16} style={[styles.tileFill, cardSurface.neutral]}>
        <View style={styles.tileHead}>
          <View style={[styles.tileIcon, { backgroundColor: theme.colors.dueTint }]}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color={theme.colors.dueInk} />
          </View>
          {whatIf && (
            <Text style={styles.tilePct} numberOfLines={1}>
              {compactMoney(extra)}
            </Text>
          )}
        </View>
        <Text style={styles.tileName} numberOfLines={2}>
          {whatIf ? 'Spend a little less' : 'What if you spent less?'}
        </Text>
        {/* Three lines: on a 360 dp phone this tile is about 100 dp wide and the sentence needs them all. */}
        <Text style={styles.tileAmt} numberOfLines={3}>
          {whatIf
            ? `${whatIf.categoryName} −${cut}% saves ${formatMoney(extra)} a\u00A0month`
            : 'Try a cut once you have logged a few expenses'}
        </Text>
      </Glass>
    </Pressable>
  );
}
