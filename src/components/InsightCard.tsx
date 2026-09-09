import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  icon: string;
  text: string;
  boldPrefix?: string;
  tone?: 'default' | 'warn';
}

// "Flynn says" — a proactive one-line insight card. Every message shown
// through this component must come from a real computed value (period
// comparison, category pace, schedule) — never a placeholder number.
export function InsightCard({ icon, text, boldPrefix, tone = 'default' }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, tone === 'warn' && styles.iconWrapWarn]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={styles.text}>
        {boldPrefix && <Text style={styles.bold}>{boldPrefix} </Text>}
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.secondary,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapWarn: { backgroundColor: theme.colors.gold },
  iconText: { fontSize: 15 },
  text: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textPrimary,
    lineHeight: 18,
  },
  bold: { fontFamily: theme.font.bodyBold },
});
