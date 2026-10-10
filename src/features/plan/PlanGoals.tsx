import { useState } from 'react';
import { View, Pressable, ScrollView, Animated, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { haptics } from '@/lib/haptics';
import { hueFor } from '@/lib/hueFor';
import { usePressScale } from '@/lib/usePressScale';
import { goalProgress } from '@/lib/savingsGoalProgress';
import { projectedMonthlySpend } from '@/lib/whatIf';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';
import { Account, SavingsGoal } from '@/types';
import { WHAT_IF_CUTS } from './planOverview';
import { styles } from './plan.styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Saving toward: each goal as a card that fills from the bottom to how far along it is, in its own colour
 * ("a goal that fills up by itself"), then a dashed card to start another. With savings amounts hidden the
 * fill and the saved figure are withheld; only the target shows. No goals yet: one card saying how to start.
 */
export function GoalsStrip({
  goals,
  savingsAccounts,
  onOpen,
  onGoal,
  onAdd,
}: {
  goals: SavingsGoal[];
  /** Savings accounts a new goal could follow, with their balances. */
  savingsAccounts: Account[];
  onOpen: () => void;
  onGoal?: (id: string) => void;
  onAdd?: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const { width, fontScale } = useWindowDimensions();
  const cardWidth = Math.max(112 * Math.min(fontScale, 1.3), Math.min(160, (width - 60) / 3));
  const cardHeight = 184 * Math.min(Math.max(fontScale, 1), 1.3);
  const active = goals.filter((g) => !g.archived);
  if (active.length === 0) {
    return (
      <Pressable
        onPress={onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel="Open savings goals"
      >
        <Glass style={styles.card}>
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
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goals}>
      {active.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          masked={hideAmounts}
          width={cardWidth}
          height={cardHeight}
          onPress={() => (onGoal ? onGoal(g.id) : onOpen())}
        />
      ))}
      <Pressable
        onPress={onAdd ?? onOpen}
        style={withPressed([styles.goal, styles.goalNew, { width: cardWidth, height: cardHeight }])}
        accessibilityRole="button"
        accessibilityLabel="Open savings goals to start a new one"
      >
        <View style={styles.goalNewDisc}>
          <Feather name="plus" size={17} color={theme.colors.ink} />
        </View>
        <Text style={styles.goalNewText}>New goal</Text>
      </Pressable>
    </ScrollView>
  );
}

function GoalCard({
  goal,
  masked,
  onPress,
  width,
  height,
}: {
  goal: SavingsGoal;
  masked: boolean;
  onPress: () => void;
  width: number;
  height: number;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { percent, done } = goalProgress(goal.currentAmountMinor, goal.targetAmountMinor);
  const hue = done ? theme.colors.income : hueFor(goal.id);
  const pct = Math.round(Math.min(100, percent));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={
        masked
          ? `${goal.name}, saved amount hidden, target ${formatMoney(goal.targetAmountMinor)}. Open savings goals`
          : `${goal.name}, ${formatMoney(goal.currentAmountMinor)} of ${formatMoney(goal.targetAmountMinor)}, ${
              done ? 'reached' : `${pct} percent`
            }. Open savings goals`
      }
    >
      <Glass radius={24} style={[styles.goal, { width, height }]}>
        {!masked && pct > 0 && (
          <View style={styles.goalReservoir} pointerEvents="none">
            <View style={[styles.goalFill, { height: `${pct}%`, backgroundColor: hue }]}>
              <View style={[styles.goalFillEdge, { backgroundColor: hue }]} />
            </View>
          </View>
        )}
        {masked ? (
          <Feather name="eye-off" size={20} color={theme.colors.textMuted} />
        ) : done ? (
          <Feather name="check-circle" size={26} color={theme.colors.incomeText} />
        ) : (
          <Text style={styles.goalPct}>
            {pct}
            <Text style={styles.goalPctSign}>%</Text>
          </Text>
        )}
        {!masked && (
          <Text style={styles.goalRemaining}>
            {formatMoney(Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor))} left
          </Text>
        )}
        <Text style={styles.goalName} numberOfLines={2}>
          {goal.name}
        </Text>
        <Text style={styles.goalAmt} numberOfLines={1} adjustsFontSizeToFit>
          {formatMaskableMoney(goal.currentAmountMinor, { masked })} saved
        </Text>
        <Text style={[styles.goalAmt, styles.goalOf]} numberOfLines={1} adjustsFontSizeToFit>
          of {formatMoney(goal.targetAmountMinor)}
        </Text>
      </Glass>
    </AnimatedPressable>
  );
}

/**
 * What-if as a lever: your biggest spending category, three cut sizes, and what each would free up a month
 * and a year, then a way into the full sandbox. Too little spending to project from: one line saying so.
 */
export function WhatIfCard({
  whatIf,
  onOpen,
}: {
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  onOpen: () => void;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [cut, setCut] = useState<number>(10);
  const extra = whatIf ? projectedMonthlySpend(whatIf.avgMonthlyMinor, cut).extraMinor : 0;
  return (
    <Glass style={styles.card}>
      {whatIf ? (
        <>
          <Text style={styles.gainNote}>Spend a little less</Text>
          <Text style={styles.whatIfBold}>{whatIf.categoryName}</Text>
          <Text style={styles.gainNote}>{formatMoney(whatIf.avgMonthlyMinor)} average / month</Text>
          <View style={styles.lever}>
            <View style={styles.cuts}>
              {WHAT_IF_CUTS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    haptics.tap();
                    setCut(c);
                  }}
                  hitSlop={4}
                  style={withPressed([styles.cut, cut === c && { backgroundColor: ink, borderColor: ink }])}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cut === c }}
                  accessibilityLabel={`Cut by ${c}%`}
                >
                  <Text style={[styles.cutText, cut === c && styles.cutTextOn]}>−{c}%</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.gain} accessibilityLiveRegion="polite">
              <Text style={styles.gainNote}>Could free up</Text>
              <Text style={styles.gainValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(extra)}
              </Text>
              <Text style={styles.gainNote}>a month</Text>
              <Text style={styles.gainNote}>{formatMoney(extra * 12)} a year</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.whatIfQ}>
          What-if: try a spending cut once you&rsquo;ve logged a few expenses
        </Text>
      )}
      <Pressable
        onPress={onOpen}
        style={withPressed(styles.openRow)}
        accessibilityRole="button"
        accessibilityLabel="Open the what-if sandbox"
      >
        <Text style={styles.openText}>Explore this scenario</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Pressable>
    </Glass>
  );
}
