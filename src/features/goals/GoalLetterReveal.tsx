import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { SuuIllustration } from '@/components/SuuIllustration';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

/**
 * One-time reveal inside ContributeModal's sheet, replacing the add/withdraw form (see its crossing check).
 * Deliberately a dark "night sky" card (Suu's ring reads as a moon), like the Lock Screen: a once-only moment.
 */
export function GoalLetterReveal({ goalName, note, targetAmountMinor }: GoalLetterRevealProps) {
  return (
    <View style={styles.card}>
      <SuuIllustration size={64} />
      <Text style={styles.title}>{goalName} — reached 🎉</Text>
      <Text style={styles.sub}>
        You saved the full {formatMoney(targetAmountMinor)}. Here's the note you sealed when you started:
      </Text>
      <View style={styles.letterBox}>
        <Text style={styles.letterText}>&ldquo;{note}&rdquo;</Text>
      </View>
    </View>
  );
}

export interface GoalLetterRevealProps {
  goalName: string;
  note: string;
  targetAmountMinor: number;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.xl2,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 16,
    color: theme.colors.surface,
    marginTop: 14,
    textAlign: 'center',
  },
  sub: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  letterBox: {
    marginTop: 14,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.onInkWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.onInkHairline,
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  letterText: {
    fontFamily: theme.font.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: theme.colors.onInkSoft,
    lineHeight: 19,
    textAlign: 'center',
  },
});
