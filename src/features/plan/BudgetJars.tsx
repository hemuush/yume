import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { softTint } from '@/components/softTint';
import type { McIconName } from '@/components/iconName';
import { BudgetsSummary, PlanBudgetInput } from './planOverview';
import { styles } from './plan.styles';

/** Used this much of its limit, a jar turns amber. */
const NEAR = 85;
/** Budgets shown on Plan (two columns); the rest are under See all. */
const SHOWN = 4;

/**
 * This month's budgets as two-column tiles: the category, what is left (or over), and a thin bar that is
 * amber near the limit and coral past it. A tile opens its overview; the header's See all opens Budgets.
 * Empty prompts setup.
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
        onPress={onAdd ?? onOpen}
        style={withPressed({ minHeight: 44 })}
        accessibilityRole="button"
        accessibilityLabel="Set a monthly limit. Open budgets"
      >
        <Glass style={[styles.card, cardSurface.neutral]}>
          <Text style={styles.title}>Set a monthly limit</Text>
          <Text style={styles.sub}>Watch spending for a category. Tap to add your first budget.</Text>
        </Glass>
      </Pressable>
    );
  }
  const over = summary.overCount > 0;
  const shown = summary.rows.slice(0, SHOWN);
  return (
    <Glass style={[styles.card, cardSurface.neutral]}>
      {over && (
        <Pressable
          onPress={onOpen}
          style={withPressed({ minHeight: 32, justifyContent: 'center' })}
          accessibilityRole="button"
          accessibilityLabel={`Budgets, ${summary.overCount} over. Open budgets`}
        >
          <Text style={[styles.caption, styles.captionBad]}>{summary.overCount} over</Text>
        </Pressable>
      )}
      <View style={styles.budgetGrid}>
        {shown.map((b) => (
          <BudgetTile key={b.id} budget={b} onPress={() => (onBudget ? onBudget(b.id) : onOpen())} />
        ))}
        {shown.length < SHOWN && (
          <Pressable
            onPress={onAdd ?? onOpen}
            style={withPressed([styles.budgetTile, styles.budgetAdd])}
            accessibilityRole="button"
            accessibilityLabel="Add a budget"
          >
            <Feather name="plus" size={18} color={theme.colors.textMuted} />
            <Text style={styles.jarName}>Add</Text>
          </Pressable>
        )}
      </View>
    </Glass>
  );
}

function BudgetTile({ budget: b, onPress }: { budget: PlanBudgetInput; onPress: () => void }) {
  const pct = Math.max(0, b.percentUsed);
  const tone = b.overBudget ? 'over' : pct >= NEAR ? 'near' : 'calm';
  const fill =
    tone === 'over'
      ? theme.colors.slice.spent
      : tone === 'near'
        ? theme.colors.slice.due
        : (b.categoryColor ?? theme.colors.slice.saved);
  const left = b.overBudget
    ? `${formatMoney(-b.remainingMinor)} over`
    : `${formatMoney(b.remainingMinor)} left`;
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.budgetTile)}
      accessibilityRole="button"
      accessibilityLabel={`${b.categoryName}, ${Math.round(pct)}% used, ${left}${
        tone === 'near' ? ', near limit' : ''
      }. Open budgets`}
    >
      <View style={styles.budgetTop}>
        <View style={[styles.budgetIcon, { backgroundColor: softTint(b.categoryColor ?? fill, 0.75) }]}>
          <MaterialCommunityIcons
            name={(b.categoryIcon ?? 'tag') as McIconName}
            size={18}
            color={theme.colors.textSecondary}
          />
        </View>
        <View style={styles.jarCopy}>
          <Text style={styles.jarName} numberOfLines={1}>
            {b.categoryName}
          </Text>
          <Text style={[styles.jarLeft, b.overBudget && styles.jarOver]} numberOfLines={1}>
            {left}
          </Text>
        </View>
      </View>
      <View style={styles.budgetTrack}>
        <View style={[styles.budgetFill, { width: `${Math.min(100, pct)}%`, backgroundColor: fill }]} />
      </View>
    </Pressable>
  );
}
