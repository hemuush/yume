import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { Glass } from '@/components/Glass';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MovingRow } from '@/components/MovingRow';
import { SubscriptionSuggestion } from '@/db/subscriptions';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { styles } from './recurring.styles';
import { SectionHead } from './SectionHead';
import { dayMonth } from '@/lib/dateLabels';
import { withPressed } from '@/lib/pressed';
import { categorySentence } from '@/lib/categoryLabel';

/**
 * "Not set up yet": subscriptions and monthly charges that don't have a rule.
 * "Make recurring" opens the ordinary rule form filled in; ✕ hides one for good.
 */
export function SuggestionsList({
  suggestions,
  onMakeRecurring,
  onHide,
}: {
  suggestions: SubscriptionSuggestion[];
  onMakeRecurring: (s: SubscriptionSuggestion) => void;
  onHide: (s: SubscriptionSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <>
      <SectionHead title="Not set up yet" />
      <Glass style={styles.list}>
        {suggestions.map((s, i) => (
          <MovingRow key={s.key} style={[styles.row, i > 0 && styles.rowDivider]}>
            <CategoryIcon name={s.icon} color={s.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {categorySentence(s.categoryName, s.parentName)}
              </Text>
              <Text style={styles.rowSub}>
                {s.source === 'pattern'
                  ? `${formatMoney(s.amountMinor)} each month · ${s.months} months in a row`
                  : `${formatMoney(s.amountMinor)} on ${dayMonth(s.date)}`}
              </Text>
            </View>
            <Pressable
              style={withPressed(styles.make)}
              onPress={() => onMakeRecurring(s)}
              accessibilityRole="button"
              accessibilityLabel={`Make ${categorySentence(s.categoryName, s.parentName)} recurring`}
            >
              <Text style={styles.makeText}>Make recurring</Text>
            </Pressable>
            <Pressable
              style={withPressed()}
              onPress={() => onHide(s)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Hide ${categorySentence(s.categoryName, s.parentName)}`}
            >
              <Feather name="x" size={15} color={theme.colors.textMuted} />
            </Pressable>
          </MovingRow>
        ))}
      </Glass>
      <Text style={styles.hint}>
        From your Subscriptions category, and charges seen once a month for 3 months. ✕ hides one; a monthly
        charge can be brought back from Needs you.
      </Text>
    </>
  );
}
