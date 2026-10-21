import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CompletionCard } from '@/components/CompletionCard';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';

/** The sealed note remains readable in the completed goal's existing scrollable sheet. */
export function GoalLetterReveal({ goalName, note, targetAmountMinor }: GoalLetterRevealProps) {
  const { hideAmounts } = usePrivacy();
  if (hideAmounts) return <CompletionCard title="Progress saved" detail="Your savings progress is hidden." />;
  return (
    <CompletionCard
      title="Goal reached"
      detail={`${goalName} reached its ${formatMoney(targetAmountMinor)} target.`}
    >
      {note && (
        <View style={styles.letterBox}>
          <Text style={styles.label}>A note from when you started</Text>
          <Text style={styles.letterText}>{note}</Text>
        </View>
      )}
    </CompletionCard>
  );
}
interface GoalLetterRevealProps {
  goalName: string;
  note: string | null;
  targetAmountMinor: number;
}
const styles = StyleSheet.create({
  letterBox: { backgroundColor: theme.colors.surfaceAlt, borderRadius: 14, padding: 16, gap: 10 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  letterText: { fontFamily: theme.font.body, fontSize: 14, color: theme.colors.ink, lineHeight: 23 },
});
