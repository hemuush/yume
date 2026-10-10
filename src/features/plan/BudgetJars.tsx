import { View, Pressable, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { softTint } from '@/components/softTint';
import type { McIconName } from '@/components/iconName';
import { compactMoney } from '@/lib/compactMoney';
import { BudgetsSummary, PlanBudgetInput } from './planOverview';
import { styles, JAR_HEIGHT } from './plan.styles';

/** Used this much of its limit, a jar turns amber. */
const NEAR = 85;
/** The liquid's room inside a jar (its 3px padding and 1.5px border on each side). */
const ROOM = JAR_HEIGHT - 9;

/**
 * This month's budgets as glass jars that fill as you spend: the category's own colour, amber near the
 * limit, coral and overflowing (with what it's over by) past it. The line above names how many are over and
 * the worst one. Every jar opens Budgets; empty, it's a prompt to set the first limit.
 */
export function BudgetJars({
  summary,
  onOpen,
  onBudget,
  onAdd,
}: {
  summary: BudgetsSummary;
  onOpen: () => void;
  onBudget?: (id: string) => void;
  onAdd?: () => void;
}) {
  if (summary.rows.length === 0) {
    return (
      <Pressable
        onPress={onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel="Set a monthly limit. Open budgets"
      >
        <Glass style={styles.card}>
          <Text style={styles.title}>Set a monthly limit</Text>
          <Text style={styles.sub}>
            For food, bills, anything you watch. Each one gets a jar that fills as you spend.
          </Text>
          <View style={[styles.cuts, { marginTop: 4 }]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.jarBody, styles.jarEmpty]}>
                <Feather name="plus" size={18} color={theme.colors.textMuted} />
              </View>
            ))}
          </View>
        </Glass>
      </Pressable>
    );
  }
  const over = summary.overCount > 0;
  const worst = summary.rows.find((b) => b.overBudget) ?? summary.rows[0];
  return (
    <Glass style={styles.card}>
      <Pressable
        onPress={onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel={`Budgets, ${over ? `${summary.overCount} over` : 'all within their limits'}. Open budgets`}
      >
        <Text style={styles.caption}>
          {over ? (
            <Text style={styles.captionBad}>{summary.overCount} over</Text>
          ) : (
            <Text style={styles.captionOk}>All within their limits</Text>
          )}
          {' · '}
          {worst.overBudget
            ? `${worst.categoryName} is ${formatMoney(-worst.remainingMinor)} over`
            : `${worst.categoryName} has ${formatMoney(worst.remainingMinor)} left`}
        </Text>
        <Text style={styles.tileSub}>Jars show spending used</Text>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.jarsScroll}
        contentContainerStyle={styles.jars}
      >
        {summary.rows.map((b) => (
          <Jar key={b.id} budget={b} onPress={() => (onBudget ? onBudget(b.id) : onOpen())} />
        ))}
        <Pressable
          onPress={onAdd ?? onOpen}
          style={withPressed(styles.jar)}
          accessibilityRole="button"
          accessibilityLabel="Add a budget"
        >
          <View style={[styles.jarBody, styles.jarEmpty]}>
            <Feather name="plus" size={18} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.jarName}>Add</Text>
        </Pressable>
      </ScrollView>
    </Glass>
  );
}

function Jar({ budget: b, onPress }: { budget: PlanBudgetInput; onPress: () => void }) {
  const pct = Math.max(0, b.percentUsed);
  const tone = b.overBudget ? 'over' : pct >= NEAR ? 'near' : 'calm';
  const fill =
    tone === 'over'
      ? theme.colors.slice.spent
      : tone === 'near'
        ? theme.colors.slice.due
        : softTint(b.categoryColor ?? theme.colors.slice.saved, 0.75);
  const height = Math.round((Math.min(100, pct) / 100) * ROOM);
  const left = b.overBudget
    ? `${formatMoney(-b.remainingMinor)} over`
    : `${formatMoney(b.remainingMinor)} left`;
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.jar)}
      accessibilityRole="button"
      accessibilityLabel={`${b.categoryName}, ${Math.round(pct)}% used, ${left}. Open budgets`}
    >
      <View style={styles.jarBody}>
        {b.categoryIcon ? (
          <View style={styles.jarIcon}>
            <MaterialCommunityIcons
              name={b.categoryIcon as McIconName}
              size={16}
              color={theme.colors.textSecondary}
            />
          </View>
        ) : null}
        {height > 0 && (
          <View
            style={[
              styles.jarLiquid,
              height >= ROOM - 2 && styles.jarLiquidFull,
              { height, backgroundColor: fill },
            ]}
          />
        )}
        {b.overBudget && (
          <View style={styles.spillWrap}>
            <View style={styles.spill}>
              <Text style={styles.spillText}>+{compactMoney(-b.remainingMinor)}</Text>
            </View>
          </View>
        )}
      </View>
      <Text style={styles.jarName} numberOfLines={2}>
        {b.categoryName}
      </Text>
      <Text style={[styles.jarLeft, b.overBudget && styles.jarOver]} numberOfLines={1}>
        {left}
      </Text>
      {tone === 'near' && <Text style={styles.jarLeft}>Near limit</Text>}
    </Pressable>
  );
}
