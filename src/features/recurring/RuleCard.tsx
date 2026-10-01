import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { RecurringRule } from '@/types';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { NeoTile } from '@/components/NeoTile';
import { formatMaskableMoney } from '@/lib/money';
import { styles } from './recurring.styles';
import { ruleCadenceLabel } from './recurring.helpers';
import { MAX_LIST_STAGGER_MS, MOTION, ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { withPressed } from '@/lib/pressed';
import { weekdayDayMonth } from '@/lib/dateLabels';

export function RuleCard({
  rule,
  accountName,
  categoryName,
  index,
  onPress,
  onTogglePause,
  muted,
  masked,
}: {
  rule: RecurringRule;
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  /** Position within its own group (active or paused) — each group's stagger restarts from 0. */
  index: number;
  onPress: () => void;
  onTogglePause: () => void;
  muted?: boolean;
  /** A savings or investment rule while those amounts are hidden. */
  masked?: boolean;
}) {
  const title =
    rule.type === 'transfer'
      ? `${accountName(rule.accountId)} → ${accountName(rule.toAccountId!)}`
      : categoryName(rule.categoryId);
  return (
    // Was tinted per the rule's position in the list (ID_PALETTE cycled by
    // index) — a rent rule and a Netflix subscription could swap colours
    // just by being reordered. Plain neutral card now; the amount already
    // carries the real, meaningful colour (income/expense) below. It also
    // had zero entrance motion at all, unlike every other list in the app —
    // now settles in staggered, same easing as everywhere else. Deleting or
    // pausing one slides the others into place instead of jumping.
    <Animated.View
      entering={FadeIn.delay(Math.min(index * MOTION.enterStep, MAX_LIST_STAGGER_MS))
        .duration(MOTION.enter)
        .easing(MOTION.ease)
        .reduceMotion(ReduceMotion.System)}
      layout={ROW_LAYOUT}
      exiting={ROW_EXIT}
    >
      <NeoTile style={[styles.card, muted && styles.cardMuted]}>
        <Pressable style={withPressed()} onPress={onPress} accessibilityRole="button">
          <View style={styles.cardTop}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.cardSub}>
                {ruleCadenceLabel(rule)} · Next {weekdayDayMonth(rule.nextRunDate)}
                {rule.note ? ` · ${rule.note}` : ''}
              </Text>
            </View>
            <Text
              style={[
                styles.cardAmount,
                rule.type === 'income' && styles.income,
                rule.type === 'expense' && styles.expense,
              ]}
            >
              {rule.type === 'expense' ? '-' : rule.type === 'income' ? '+' : ''}
              {formatMaskableMoney(rule.amountMinor, { masked })}
            </Text>
          </View>
        </Pressable>
        <View style={styles.cardFooter}>
          <Text style={styles.pauseLabel}>{rule.active ? 'Active' : 'Paused'}</Text>
          <ToggleSwitch value={rule.active} onChange={onTogglePause} />
        </View>
      </NeoTile>
    </Animated.View>
  );
}
