import { Pressable, View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { StripCard } from '@/components/StripCard';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { formatMaskableMoney } from '@/lib/money';
import { gainLabel } from '@/lib/investment';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Portfolio } from '@/lib/portfolio';

/**
 * Plan's one-card view of the investments: what they are worth, the gain, what goes in each month. Opens the
 * Investments page; with none yet it invites you to add the first.
 */
export function InvestmentsCard({
  portfolio,
  monthlySipMinor,
  onOpen,
}: {
  portfolio: Portfolio;
  monthlySipMinor: number;
  onOpen: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const none = portfolio.holdings.length === 0 && portfolio.otherCurrency.length === 0;
  const money = (minor: number) =>
    formatMaskableMoney(minor, { currency: portfolio.currency, masked: hideAmounts });
  const gain =
    portfolio.gainMinor == null
      ? null
      : gainLabel(
          { gainMinor: portfolio.gainMinor, investedMinor: portfolio.investedMinor },
          { currency: portfolio.currency, masked: hideAmounts }
        );
  const due = portfolio.holdings.filter((x) => x.stale).length;
  return (
    <Pressable
      onPress={onOpen}
      style={withPressed(styles.wrap)}
      accessibilityRole="button"
      accessibilityLabel={
        none
          ? 'Investments. Track your first investment'
          : `Investments, worth ${money(portfolio.valueMinor)}${gain ? `, ${gain}` : ''}. Open`
      }
    >
      <StripCard tone={theme.colors.slice.saved} lifted={false} style={styles.card}>
        {none ? (
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.title}>Track an investment</Text>
              <Text style={styles.sub}>
                Add an index fund, stocks, gold or a deposit, and see what it has grown to.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.kicker}>Worth now</Text>
              <Text style={styles.figure}>{money(portfolio.valueMinor)}</Text>
              <Text style={styles.sub}>
                {[
                  gain,
                  monthlySipMinor > 0 ? `SIPs ${money(monthlySipMinor)} a month` : null,
                  due > 0 ? `${due} ${due === 1 ? 'value is' : 'values are'} due an update` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') ||
                  `${portfolio.holdings.length} holding${portfolio.holdings.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.colors.textMuted} />
          </View>
        )}
      </StripCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16 },
  card: { padding: 14, marginHorizontal: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textSecondary },
  title: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  figure: { fontFamily: theme.font.roundedBold, fontSize: 24, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
});
