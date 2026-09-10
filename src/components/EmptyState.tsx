import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SuuIllustration } from './SuuIllustration';

interface Props {
  illustration?: React.ReactNode;
  title: string;
  subtitle?: string;
}

// Defaults to Suu (sleepy pose) rather than requiring every screen to pick
// its own bespoke icon — one consistent mascot across every empty state.
export function EmptyState({ illustration = <SuuIllustration pose="sleepy" />, title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      {illustration}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 32 },
  title: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
});
