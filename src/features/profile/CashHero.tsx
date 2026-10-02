import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMaskableMoney } from '@/lib/money';
import { HOME } from '@/features/home/homeStyles';

/**
 * The first block on You: what is in your accounts right now. It leads with
 * this rather than the tracked balance because loans can pull that one far
 * below zero for a perfectly normal reason. When savings amounts are hidden
 * the figure is masked, since it includes them.
 */
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
  const hue = theme.colors.idTeal;
  return (
    <View style={styles.card}>
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
