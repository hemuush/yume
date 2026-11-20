import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { SCREEN } from '@/components/screenStyles';
import { SummaryGradient, summaryInk } from '@/components/SummaryGradient';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';
import { themedStyles } from '@/theme/themedStyles';

export function CashHero({
  minor,
  label,
  sub,
  masked,
}: {
  minor: number;
  label: string;
  sub: string;
  masked: boolean;
}) {
  return (
    <View style={styles.card}>
      <SummaryGradient />
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
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      marginHorizontal: SCREEN.gutter,
      // The same sky summary card as Home, Activity, Plan and Reports.
      backgroundColor: summaryInk.background,
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      marginTop: 12,
    },
    top: {
      gap: 3,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 10,
    },
    topMain: { flexShrink: 1, minWidth: 0 },
    label: { fontFamily: theme.font.body, fontSize: 12, color: summaryInk.secondary },
    figure: {
      fontFamily: theme.font.bodyBold,
      fontSize: 27,
      lineHeight: 32,
      letterSpacing: -0.2,
      fontVariant: ['tabular-nums'],
      color: summaryInk.text,
    },
    sub: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: summaryInk.secondary },
  })
);
