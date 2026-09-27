import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { NeoTile } from '@/components/NeoTile';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MovingRow } from '@/components/MovingRow';
import { SubscriptionSuggestion, SubscriptionTotals } from '@/db/subscriptions';
import { formatMoney } from '@/lib/money';
import { parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { styles } from './recurring.styles';

const shortDay = (iso: string) =>
  parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * The top of Recurring: what the running expense rules cost a month (and a
 * year, since ₹299 a month reads smaller than ₹3,588 a year), then the
 * subscriptions and monthly charges that don't have a rule yet.
 */
export function SubscriptionsSection({
  totals,
  suggestions,
  onMakeRecurring,
  onHide,
}: {
  totals: SubscriptionTotals;
  suggestions: SubscriptionSuggestion[];
  onMakeRecurring: (s: SubscriptionSuggestion) => void;
  onHide: (s: SubscriptionSuggestion) => void;
}) {
  if (totals.count === 0 && suggestions.length === 0) return null;
  return (
    <>
      {totals.count > 0 && (
        <NeoTile style={styles.subsCard}>
          <Text style={styles.subsLabel}>SUBSCRIPTIONS & BILLS</Text>
          <Text style={styles.subsAmount}>
            {formatMoney(totals.monthlyMinor)}
            <Text style={styles.subsPer}> / month</Text>
          </Text>
          <Text style={styles.subsSub}>
            {formatMoney(totals.yearlyMinor)} a year · {totals.count} running
          </Text>
        </NeoTile>
      )}

      {suggestions.length > 0 && (
        <>
          <Text style={styles.sectionDivider}>NOT SET UP YET</Text>
          <NeoTile style={styles.subsList}>
            {suggestions.map((s, i) => (
              <MovingRow key={s.key} style={[styles.subsRow, i > 0 && styles.subsRowDivider]}>
                <CategoryIcon name={s.icon} color={s.color} size={16} square={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.subsRowTitle} numberOfLines={2}>
                    {s.categoryName}
                  </Text>
                  <Text style={styles.subsRowSub}>
                    {s.source === 'pattern'
                      ? `${formatMoney(s.amountMinor)} each month · ${s.months} months in a row`
                      : `${formatMoney(s.amountMinor)} on ${shortDay(s.date)}`}
                  </Text>
                </View>
                <Pressable
                  style={styles.subsMake}
                  onPress={() => onMakeRecurring(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${s.categoryName} recurring`}
                >
                  <Text style={styles.subsMakeText}>Make recurring</Text>
                </Pressable>
                <Pressable
                  onPress={() => onHide(s)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Hide ${s.categoryName}`}
                >
                  <Feather name="x" size={15} color={theme.colors.textMuted} />
                </Pressable>
              </MovingRow>
            ))}
          </NeoTile>
          <Text style={styles.subsHint}>
            From your Subscriptions category, and charges seen once a month for 3 months. ✕ hides one; a
            monthly charge can be brought back from Needs you.
          </Text>
        </>
      )}

      <Text style={styles.sectionDivider}>RUNNING</Text>
    </>
  );
}
