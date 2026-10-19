import { View, Pressable } from 'react-native';
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
import { PlanSummaryRow, summaryListStyle } from './PlanSummaryRow';
import { TileGrid } from './PlanGrid';

/** Used this much of its limit, a jar turns amber. */
const NEAR = 85;

/**
 * This month's budgets as tiles, three to a row, the same tile as the goals: the category, the share of its
 * limit used, a thin bar (amber near the limit, coral past it) and what is left or over. A tile opens its
 * overview; the header's See all opens Budgets. Empty prompts setup.
 */
export function BudgetJars({
  summary,
  onOpen,
  onBudget,
  onAdd,
  limit,
  compact = false,
}: {
  summary: BudgetsSummary;
  onOpen: () => void;
  onBudget?: (id: string) => void;
  onAdd?: () => void;
  /** Tiles shown at most (default: two rows). */
  limit?: number;
  /** Flat rows used by Plan; limit counts actual budgets, not an Add tile. */
  compact?: boolean;
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
  if (compact) {
    const sorted = [...summary.rows].sort(
      (a, b) => Number(b.overBudget) - Number(a.overBudget) || b.percentUsed - a.percentUsed
    );
    return (
      <View style={summaryListStyle}>
        {sorted.slice(0, limit ?? sorted.length).map((b) => {
          const amount = b.overBudget
            ? `${formatMoney(Math.max(0, -b.remainingMinor))} over`
            : `${formatMoney(b.remainingMinor)} left`;
          const color = b.overBudget
            ? theme.colors.expenseText
            : b.percentUsed >= NEAR
              ? theme.colors.warnInk
              : theme.colors.link;
          return (
            <PlanSummaryRow
              key={b.id}
              name={b.categoryName}
              subtitle={`${Math.round(b.percentUsed)}% used`}
              amount={amount}
              icon={(b.categoryIcon ?? 'tag') as McIconName}
              progress={b.percentUsed}
              color={color}
              accessibilityLabel={`${b.categoryName}, ${Math.round(b.percentUsed)}% used, ${amount}. Open budgets`}
              onPress={() => (onBudget ? onBudget(b.id) : onOpen())}
            />
          );
        })}
      </View>
    );
  }
  return (
    <TileGrid
      tiles={[...summary.rows]
        .sort((a, b) => Number(b.overBudget) - Number(a.overBudget) || b.percentUsed - a.percentUsed)
        .map((b) => (
          <BudgetTile key={b.id} budget={b} onPress={() => (onBudget ? onBudget(b.id) : onOpen())} />
        ))}
      label="Add"
      accessibilityLabel="Add a budget"
      onAdd={onAdd ?? onOpen}
      limit={limit}
    />
  );
}

function BudgetTile({ budget: b, onPress }: { budget: PlanBudgetInput; onPress: () => void }) {
  const pct = Math.max(0, b.percentUsed);
  const tone = b.overBudget ? 'over' : pct >= NEAR ? 'near' : 'calm';
  const base = b.categoryColor ?? theme.colors.slice.saved;
  const fill = tone === 'over' ? theme.colors.slice.spent : tone === 'near' ? theme.colors.slice.due : base;
  const left = b.overBudget
    ? `${formatMoney(-b.remainingMinor)} over`
    : `${formatMoney(b.remainingMinor)} left`;
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.tileWrap)}
      accessibilityRole="button"
      accessibilityLabel={`${b.categoryName}, ${Math.round(pct)}% used, ${left}${
        tone === 'near' ? ', near limit' : ''
      }. Open budgets`}
    >
      <Glass radius={24} style={[styles.tileFill, cardSurface.neutral]}>
        <View style={[styles.tileIcon, { backgroundColor: softTint(base, 0.6) }]}>
          <MaterialCommunityIcons
            name={(b.categoryIcon ?? 'tag') as McIconName}
            size={18}
            color={theme.colors.ink}
          />
        </View>
        <Text style={[styles.tilePct, b.overBudget && styles.tileOver]}>
          {Math.round(pct)}
          <Text style={styles.tilePctSign}>%</Text>
        </Text>
        <Text style={styles.tileName} numberOfLines={2}>
          {b.categoryName}
        </Text>
        <View style={styles.tileTrack} pointerEvents="none">
          <View style={[styles.tileProgress, { width: `${Math.min(100, pct)}%`, backgroundColor: fill }]} />
        </View>
        <Text style={[styles.tileAmt, b.overBudget && styles.tileOver]} numberOfLines={2}>
          {left}
        </Text>
      </Glass>
    </Pressable>
  );
}
