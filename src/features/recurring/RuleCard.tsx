import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { RecurringRule } from '@/types';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { NeoTile } from '@/components/NeoTile';
import { formatMoney } from '@/lib/money';
import { styles } from './recurring.styles';
import { ruleCadenceLabel } from './recurring.helpers';
import { MAX_LIST_STAGGER_MS } from '@/lib/animation';

export function RuleCard({
  rule,
  accountName,
  categoryName,
  index,
  onPress,
  onTogglePause,
  muted,
}: {
  rule: RecurringRule;
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  /** Position within its own group (active or paused) — each group's stagger restarts from 0. */
  index: number;
  onPress: () => void;
  onTogglePause: () => void;
  muted?: boolean;
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
    // now settles in staggered, same easing as everywhere else.
    <Animated.View
      entering={FadeIn.delay(Math.min(index * 60, MAX_LIST_STAGGER_MS))
        .duration(300)
        .springify()
        .reduceMotion(ReduceMotion.System)}
    >
      <NeoTile style={[styles.card, muted && styles.cardMuted]}>
        <Pressable onPress={onPress}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.cardSub}>
                {ruleCadenceLabel(rule)} · Next {rule.nextRunDate}
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
              {formatMoney(rule.amountMinor)}
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
