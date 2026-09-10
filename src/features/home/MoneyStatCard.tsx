import { Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { SoftCard } from './SoftCard';

type Tone = 'good' | 'watch' | 'neutral';

const TONE_FILL: Record<Tone, string> = {
  good: theme.colors.idSage,
  watch: theme.colors.idCoral,
  neutral: theme.colors.idGold,
};

/**
 * A single soft figure tile — used for the Surplus + Debt-left pair below the
 * hero. One dominant amount, a quiet trend or footnote beneath it.
 */
export function MoneyStatCard({
  label,
  amountMinor,
  changePct,
  tone = 'neutral',
  footnote,
}: {
  label: string;
  amountMinor: number;
  changePct?: number | null;
  tone?: Tone;
  footnote?: string;
}) {
  return (
    <SoftCard backgroundColor={TONE_FILL[tone]} padding={14} style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(amountMinor)}
      </Text>
      {footnote ? (
        <Text style={styles.footnote}>{footnote}</Text>
      ) : changePct != null ? (
        <Text style={styles.footnote}>
          {changePct >= 0 ? '↑' : '↓'} {formatPctChange(changePct)}
        </Text>
      ) : (
        <Text style={styles.footnote}> </Text>
      )}
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  label: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.onFlat,
    opacity: 0.6,
  },
  amount: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.onFlat, marginTop: 6 },
  footnote: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.onFlat,
    opacity: 0.7,
    marginTop: 4,
  },
});
