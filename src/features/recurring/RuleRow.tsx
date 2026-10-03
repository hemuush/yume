import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Category, RecurringRule } from '@/types';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatMaskableMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { styles } from './recurring.styles';
import { ruleCadenceLabel } from './recurring.helpers';
import { MAX_LIST_STAGGER_MS, MOTION, ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { withPressed } from '@/lib/pressed';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { inParent, joinSub } from '@/lib/categoryLabel';

/**
 * One rule in the Running or Paused card: category icon, what and when, amount, and a pause switch. Tapping
 * the rest opens the edit sheet. Rows settle in staggered; others slide into place on pause or delete.
 */
export function RuleRow({
  rule,
  category,
  parentName,
  accountName,
  index,
  onPress,
  onTogglePause,
  muted,
  masked,
}: {
  rule: RecurringRule;
  category: Category | undefined;
  /** The category's parent, when it is a subcategory. */
  parentName?: string;
  accountName: (id: string) => string;
  /** Position within its own group (running or paused) — each group's stagger restarts from 0. */
  index: number;
  onPress: () => void;
  onTogglePause: () => void;
  muted?: boolean;
  /** A savings or investment rule while those amounts are hidden. */
  masked?: boolean;
}) {
  const transfer = rule.type === 'transfer';
  const name = transfer
    ? `${accountName(rule.accountId)} → ${accountName(rule.toAccountId!)}`
    : (category?.name ?? '—');
  const title = !transfer && rule.note ? `${name} · ${rule.note}` : name;
  const when = `${ruleCadenceLabel(rule)} · Next ${weekdayDayMonth(rule.nextRunDate)}`;
  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index * MOTION.enterStep, MAX_LIST_STAGGER_MS))
        .duration(MOTION.enter)
        .easing(MOTION.ease)
        .reduceMotion(ReduceMotion.System)}
      layout={ROW_LAYOUT}
      exiting={ROW_EXIT}
      style={[styles.row, index > 0 && styles.rowDivider, muted && styles.rowMuted]}
    >
      <Pressable style={withPressed(styles.ruleMain)} onPress={onPress} accessibilityRole="button">
        <CategoryIcon
          name={transfer ? 'swap-horizontal' : (category?.icon ?? 'repeat')}
          color={transfer ? theme.colors.secondary : category?.color}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            {transfer ? when : joinSub([inParent(parentName), when, accountName(rule.accountId)])}
          </Text>
        </View>
      </Pressable>
      <View style={styles.ruleSide}>
        <Pressable onPress={onPress} importantForAccessibility="no" accessibilityElementsHidden>
          <Text
            style={[
              styles.ruleAmount,
              rule.type === 'income' && styles.income,
              rule.type === 'expense' && styles.expense,
            ]}
          >
            {rule.type === 'expense' ? '-' : rule.type === 'income' ? '+' : ''}
            {formatMaskableMoney(rule.amountMinor, { masked })}
          </Text>
        </Pressable>
        <ToggleSwitch
          small
          value={rule.active}
          onChange={onTogglePause}
          accessibilityLabel={`${title}, ${rule.active ? 'running' : 'paused'}`}
        />
      </View>
    </Animated.View>
  );
}
