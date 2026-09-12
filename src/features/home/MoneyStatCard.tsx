import { Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { SoftCard } from './SoftCard';

type Tone = 'good' | 'watch' | 'neutral';

const TONE_COLOR: Record<Tone, string> = {
  good: theme.colors.income,
  watch: theme.colors.expense,
  neutral: theme.colors.textPrimary,
};

/**
 * A single stat tile — Surplus/Debt-left below the hero. Previously a
 * flat-tinted card (sage/coral/gold); now a plain neutral surface, matching
 * Apple Wallet/Fitness' own restraint — colour is spent on the figure itself
 * (green for a healthy surplus, red for a real deficit), not the whole tile,
 * so it doesn't add another hue to a page that already has its own accent.
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
    <SoftCard padding={14} style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, { color: TONE_COLOR[tone] }]} numberOfLines={1} adjustsFontSizeToFit>
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
    color: theme.colors.textMuted,
  },
  amount: { fontFamily: theme.font.monoBold, fontSize: 16, marginTop: 6 },
  footnote: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
