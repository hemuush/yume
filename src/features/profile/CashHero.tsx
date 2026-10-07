import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { StripCard, KickerDot } from '@/components/StripCard';
import { formatMaskableMoney } from '@/lib/money';
import { SCREEN } from '@/components/screenStyles';

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
  const body = (
    <>
      <View style={styles.kickerRow}>
        <KickerDot color={theme.colors.secondaryDeep} />
        <Text style={styles.kicker}>{label}</Text>
      </View>
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
    </>
  );
  // A white card with a mint strip, like the heroes on the screens opened from Plan. In the shared card with
  // the tracked balance, that card draws the edge; the strip still runs along its top.
  return embedded ? (
    <View style={styles.cardEmbedded}>
      <View style={styles.strip} />
      {body}
    </View>
  ) : (
    <StripCard tone={theme.colors.slice.saved} style={styles.card}>
      {body}
    </StripCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN.gutter,
    marginTop: 12,
    padding: 16,
    paddingTop: 18,
  },
  cardEmbedded: { padding: 16, paddingTop: 18 },
  strip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: theme.colors.slice.saved,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
});
