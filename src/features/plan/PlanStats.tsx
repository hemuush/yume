import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { dayMonth } from '@/lib/dateLabels';
import { SCREEN } from '@/components/screenStyles';

/** One compact summary opens the full schedule, keeping the count scoped to outgoing payments. */
export function PlanStats({
  count,
  days,
  next,
  onOpen,
  stack,
}: {
  count: number;
  days: number;
  next: { date: string; title: string } | null;
  onOpen: () => void;
  stack?: boolean;
}) {
  if (count === 0) return null;
  const label = `${count} payment${count === 1 ? '' : 's'} in the next ${days} days`;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${label}${next ? `. Next ${dayMonth(next.date)}, ${next.title}` : ''}. Open Upcoming`}
      style={withPressed(styles.wrap)}
    >
      <Glass radius={24} style={[styles.card, cardSurface.neutral]}>
        <View style={styles.copy}>
          <Text style={styles.caption}>{label}</Text>
          {next && (
            <Text style={[styles.next, stack && styles.nextStack]}>
              Next · {dayMonth(next.date)} · {next.title}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={theme.colors.link} />
      </Glass>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrap: { marginHorizontal: SCREEN.gutter, marginTop: SCREEN.sectionGap },
  card: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  caption: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textMuted },
  next: { fontFamily: theme.font.bodyMedium, fontSize: 13, lineHeight: 19, color: theme.colors.textPrimary },
  nextStack: { flexShrink: 1 },
});
