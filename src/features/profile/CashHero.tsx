import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';

/**
 * First card on You, the flat summary card the other screens lead with: what is in your accounts right now at
 * 20 px and how many accounts that is. What sits under it arrives as `children` (the tracked balance, then the
 * shortcut strip), full width, so each can draw its own hairline. Masked when savings amounts are hidden, as
 * it includes them. Loans can pull the tracked balance far below zero normally, so it leads with this instead.
 */
export function CashHero({
  minor,
  label,
  sub,
  masked,
  children,
}: {
  minor: number;
  label: string;
  sub: string;
  masked: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.topMain}>
          <Text style={styles.label}>{label}</Text>
          {masked ? (
            <Text style={styles.figure}>{formatMaskableMoney(0, { masked: true })}</Text>
          ) : (
            <CountUpAmount minor={minor} style={styles.figure} numberOfLines={1} adjustsFontSizeToFit />
          )}
        </View>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...h.card,
    marginTop: 12,
    borderWidth: 1,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 8px 24px rgba(18,19,15,0.05)',
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  topMain: { flexShrink: 1, minWidth: 0 },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  sub: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
});
