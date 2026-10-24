import { Pressable, View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { StripCard, KickerDot } from '@/components/StripCard';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { formatMaskableMoney } from '@/lib/money';
import { gainLabel } from '@/lib/investment';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Portfolio, SeriesPoint } from '@/lib/portfolio';

const SPARK_W = 96;
const SPARK_H = 38;

/** The trend as a small line; null until there are two points to draw. */
function sparkPoints(series: SeriesPoint[]): string | null {
  if (series.length < 2) return null;
  const values = series.map((p) => p.valueMinor);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  return series
    .map((p, i) => {
      const x = 2 + (i / (series.length - 1)) * (SPARK_W - 4);
      const y = SPARK_H - 3 - ((p.valueMinor - min) / span) * (SPARK_H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Plan's summary of the investments, built like the other Plan cards: what they are worth, the gain, a small
 * trend, and the three facts that matter (put in, SIPs a month, values due). Opens the Investments page; with
 * none yet it is a dashed invitation to track the first.
 */
export function InvestmentsCard({
  portfolio,
  series,
  monthlySipMinor,
  onOpen,
}: {
  portfolio: Portfolio;
  series: SeriesPoint[];
  monthlySipMinor: number;
  onOpen: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const none = portfolio.holdings.length === 0 && portfolio.otherCurrency.length === 0;
  const money = (minor: number) =>
    formatMaskableMoney(minor, { currency: portfolio.currency, masked: hideAmounts });
  if (none) {
    return (
      <Pressable
        onPress={onOpen}
        style={withPressed(styles.wrap)}
        accessibilityRole="button"
        accessibilityLabel="Track an investment. Fund, stocks, gold or a deposit"
      >
        <View style={styles.empty}>
          <Feather name="plus" size={18} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>Track an investment</Text>
          <Text style={styles.sub}>Fund, stocks, gold or a deposit</Text>
        </View>
      </Pressable>
    );
  }
  const gain =
    portfolio.gainMinor == null
      ? null
      : gainLabel(
          { gainMinor: portfolio.gainMinor, investedMinor: portfolio.investedMinor },
          { currency: portfolio.currency, masked: hideAmounts }
        );
  const up = (portfolio.gainMinor ?? 0) >= 0;
  const due = portfolio.holdings.filter((x) => x.stale).length;
  const spark = hideAmounts ? null : sparkPoints(series);
  return (
    <Pressable
      onPress={onOpen}
      style={withPressed(styles.wrap)}
      accessibilityRole="button"
      accessibilityLabel={`Investments, worth ${money(portfolio.valueMinor)}${gain ? `, ${gain}` : ''}. Open`}
    >
      <StripCard tone={theme.colors.slice.saved} lifted={false} style={styles.card}>
        <View style={styles.kickerRow}>
          <KickerDot color={theme.colors.secondaryDeep} />
          <Text style={styles.kicker}>Worth now</Text>
        </View>
        <View style={styles.top}>
          <View style={styles.copy}>
            <Text style={styles.figure} numberOfLines={1} adjustsFontSizeToFit>
              {money(portfolio.valueMinor)}
            </Text>
            {gain && (
              <Text
                style={[
                  styles.gain,
                  {
                    color: hideAmounts
                      ? theme.colors.textSecondary
                      : up
                        ? theme.colors.incomeText
                        : theme.colors.expenseText,
                  },
                ]}
              >
                {gain}
              </Text>
            )}
          </View>
          {spark && (
            <Svg width={SPARK_W} height={SPARK_H} accessible={false}>
              <Polyline
                points={spark}
                fill="none"
                stroke={theme.colors.slice.saved}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>
        <View style={styles.trio}>
          <Fact label="Put in" value={money(portfolio.investedMinor)} />
          <Fact label="SIPs / month" value={money(monthlySipMinor)} />
          <Fact label="Values" value={due > 0 ? `${due} due` : 'Up to date'} warn={due > 0} tint={due > 0} />
        </View>
        <View style={styles.footer}>
          <Feather name="refresh-cw" size={13} color={theme.colors.link} />
          <Text style={styles.footerText}>Update values</Text>
        </View>
      </StripCard>
    </Pressable>
  );
}

function Fact({
  label,
  value,
  warn,
  tint,
}: {
  label: string;
  value: string;
  warn?: boolean;
  tint?: boolean;
}) {
  return (
    <View style={[styles.fact, tint && styles.factDue]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text
        style={[styles.factValue, warn && { color: theme.colors.warnInk }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  card: { padding: 14, paddingTop: 18, marginHorizontal: 0, gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textSecondary },
  top: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  figure: { fontFamily: theme.font.roundedBold, fontSize: 30, color: theme.colors.textPrimary },
  gain: { fontFamily: theme.font.bodyBold, fontSize: 13 },
  trio: { flexDirection: 'row', gap: 8, marginTop: 6 },
  fact: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.tray,
  },
  factDue: { backgroundColor: theme.colors.dueTint },
  factLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  factValue: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  footerText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
  empty: {
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  emptyTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
});
