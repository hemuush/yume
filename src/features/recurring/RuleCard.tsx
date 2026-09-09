import { View, Text, Pressable } from 'react-native';
import { RecurringRule } from '@/types';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { NeoTile } from '@/components/NeoTile';
import { formatMoney } from '@/lib/money';
import { styles } from './recurring.styles';
import { ruleCadenceLabel } from './recurring.helpers';

export function RuleCard({
  rule,
  color,
  accountName,
  categoryName,
  onPress,
  onTogglePause,
  muted,
}: {
  rule: RecurringRule;
  color: string;
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  onPress: () => void;
  onTogglePause: () => void;
  muted?: boolean;
}) {
  const title =
    rule.type === 'transfer'
      ? `${accountName(rule.accountId)} → ${accountName(rule.toAccountId!)}`
      : categoryName(rule.categoryId);
  return (
    <NeoTile backgroundColor={color} style={[styles.card, muted && styles.cardMuted]}>
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
  );
}
