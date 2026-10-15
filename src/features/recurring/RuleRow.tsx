import { View, Pressable, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import Animated from 'react-native-reanimated';
import { Category, RecurringRule } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { formatMaskableMoney } from '@/lib/money';
import { useAccent } from '@/theme/AccentContext';
import { styles } from './recurring.styles';
import { ruleCadenceLabel } from './recurring.helpers';
import { ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { withPressed } from '@/lib/pressed';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { joinSub } from '@/lib/categoryLabel';

/**
 * One rule in the Running or Paused card: category icon, context and amount. Tapping
 * opens the edit sheet, where status changes require confirmation. Rows appear immediately; others slide into place on pause or delete.
 */
export function RuleRow({
  rule,
  category,
  parentName,
  accountName,
  index,
  onPress,
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
  muted?: boolean;
  /** A savings or investment rule while those amounts are hidden. */
  masked?: boolean;
}) {
  const { secondary } = useAccent();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const transfer = rule.type === 'transfer';
  const name = transfer
    ? `${accountName(rule.accountId)} → ${rule.toAccountId ? accountName(rule.toAccountId) : '—'}`
    : (category?.name ?? '—');
  const title = !transfer && rule.note ? rule.note : name;
  const when = `${ruleCadenceLabel(rule)} · Next ${weekdayDayMonth(rule.nextRunDate)}`;
  return (
    <Animated.View
      layout={ROW_LAYOUT}
      exiting={ROW_EXIT}
      style={[
        styles.row,
        stacked && styles.ruleStacked,
        index > 0 && styles.rowDivider,
        muted && styles.rowMuted,
      ]}
    >
      <Pressable
        style={withPressed([styles.ruleMain, stacked && styles.ruleMainStacked])}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${when}. ${formatMaskableMoney(rule.amountMinor, { masked })}. Open recurring entry`}
      >
        <CategoryIcon
          name={transfer ? 'swap-horizontal' : (category?.icon ?? 'repeat')}
          color={transfer ? secondary : category?.color}
        />
        <View style={styles.ruleCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>
            {joinSub([
              `${weekdayDayMonth(rule.nextRunDate)} · ${ruleCadenceLabel(rule)}`,
              !transfer && rule.note && name,
              !transfer && parentName,
              transfer
                ? 'Transfer'
                : `${rule.type === 'income' ? 'Into' : 'From'} ${accountName(rule.accountId)}`,
            ])}
          </Text>
        </View>
      </Pressable>
      <View style={[styles.ruleSide, stacked && styles.ruleSideStacked]}>
        <Pressable
          style={styles.amountButton}
          onPress={onPress}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          <Text style={[styles.ruleAmount, rule.type === 'income' && styles.income]}>
            {/* Bills read in ink with no sign, as on Plan's Coming up; only money in is green with a "+". */}
            {rule.type === 'income' ? '+' : ''}
            {formatMaskableMoney(rule.amountMinor, { masked })}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
