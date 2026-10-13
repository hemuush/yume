import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { theme } from '@/constants/theme';

/** A non-interactive status; words carry the meaning as well as colour. */
export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'due' | 'warning' | 'complete';
}) {
  const colour =
    tone === 'warning'
      ? theme.colors.expenseText
      : tone === 'due'
        ? theme.colors.dueInk
        : tone === 'complete'
          ? theme.colors.incomeText
          : theme.colors.textSecondary;
  const backgroundColor =
    tone === 'warning'
      ? theme.colors.expenseTint
      : tone === 'due'
        ? theme.colors.dueTint
        : tone === 'complete'
          ? theme.colors.incomeTint
          : theme.colors.surfaceAlt;
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.label, { color: colour }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, lineHeight: 16 },
});
