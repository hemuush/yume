import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { dayMonth } from '@/lib/dateLabels';
import { styles } from './plan.styles';

function StatTile({
  value,
  line1,
  line2,
  label,
  onPress,
}: {
  value: string;
  line1: string;
  line2: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.statWrap)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Glass radius={22} style={[styles.stat, cardSurface.neutral]}>
        <View style={styles.statIcon}>
          <Feather name="calendar" size={16} color={theme.colors.ink} />
        </View>
        <View style={styles.statCopy}>
          <Text style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.statLine} numberOfLines={1}>
            {line1}
          </Text>
          <Text style={styles.statLine} numberOfLines={1}>
            {line2}
          </Text>
        </View>
      </Glass>
    </Pressable>
  );
}

/**
 * Two small tiles under the balance card: how many payments are coming and which is next. Both open the Upcoming
 * tab. Nothing is drawn when nothing is due, since the balance card already says so.
 */
export function PlanStats({
  count,
  days,
  next,
  onOpen,
}: {
  count: number;
  days: number;
  /** The first payment going out: its date and name. */
  next: { date: string; title: string } | null;
  onOpen: () => void;
}) {
  if (count === 0) return null;
  return (
    <View style={styles.statRow}>
      <StatTile
        value={String(count)}
        line1={count === 1 ? 'Payment' : 'Payments'}
        line2={`Next ${days} days`}
        label={`${count} payment${count === 1 ? '' : 's'} in the next ${days} days. Open Upcoming`}
        onPress={onOpen}
      />
      {next && (
        <StatTile
          value={dayMonth(next.date)}
          line1="Next payment"
          line2={next.title}
          label={`Next payment ${dayMonth(next.date)}, ${next.title}. Open Upcoming`}
          onPress={onOpen}
        />
      )}
    </View>
  );
}
