import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SuuIllustration } from './SuuIllustration';

interface Props {
  illustration?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** What to do about it — a button (or a small form) that does the thing, not directions to it. */
  children?: React.ReactNode;
}

// Defaults to Suu (sleepy pose) rather than requiring every screen to pick
// its own bespoke icon — one consistent mascot across every empty state.
export function EmptyState({
  illustration = <SuuIllustration pose="sleepy" />,
  title,
  subtitle,
  children,
}: Props) {
  return (
    <View style={styles.wrap}>
      {illustration}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children && <View style={styles.action}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  title: {
    fontFamily: theme.font.roundedMedium,
    fontSize: theme.typeSize.title,
    color: theme.colors.textPrimary,
    marginTop: 14,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },
  action: { alignSelf: 'center', width: '100%', maxWidth: 360, marginTop: 20 },
});
