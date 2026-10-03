import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMaskableMoney } from '@/lib/money';
import { HOME } from '@/components/homeStyles';

/**
 * First block on You: what is in your accounts right now. Leads with this, not the tracked balance, since
 * loans can pull that far below zero normally. Masked when savings amounts are hidden, as it includes them.
 */
export function CashHero({
  minor,
  label,
  sub,
  masked,
  embedded = false,
}: {
  minor: number;
  label: string;
  sub: string;
  masked: boolean;
  /** Sits inside a shared card with the tracked balance, which draws the edge and margins. */
  embedded?: boolean;
}) {
  const hue = theme.colors.idTeal;
  return (
    <View style={embedded ? styles.cardEmbedded : styles.card}>
      <LinearGradient
        colors={[shade(hue, 93), shade(hue, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circle} />
      <Text style={styles.kicker}>{label}</Text>
      {masked ? (
        <Text style={styles.amount}>{formatMaskableMoney(0, { masked: true })}</Text>
      ) : (
        <CountUpAmount
          minor={minor}
          countFromZero={false}
          style={styles.amount}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      )}
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: HOME.gutter,
    marginTop: 12,
    padding: 16,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  cardEmbedded: { padding: 16 },
  circle: {
    position: 'absolute',
    right: -34,
    top: -46,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
});
