import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { SettingsRow } from '@/components/SettingsRow';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';
import { ageLabel, estimatedValue, INVESTMENT_KIND_LABEL } from '@/lib/investment';
import type { Holding } from '@/lib/portfolio';
import { GainBadge } from './GainPill';

/**
 * One holding in a list: its name, kind and how old its value is, the estimate and maturity for a deposit,
 * the value and the gain. Opens the holding's sheet.
 */
export function HoldingRow({
  holding,
  today,
  masked,
  onPress,
  divider,
}: {
  holding: Holding;
  today: string;
  masked: boolean;
  onPress: () => void;
  divider: boolean;
}) {
  const cur = holding.account.currency;
  const estimate = estimatedValue(holding.account, today);
  const maturity = holding.account.investment?.maturityDate;
  const sub = [
    holding.kind ? INVESTMENT_KIND_LABEL[holding.kind] : null,
    holding.ageDays == null ? 'No value yet' : ageLabel(holding.ageDays),
    estimate
      ? `≈ ${formatMaskableMoney(estimate.valueMinor, { currency: cur, masked })} at ${estimate.rateBp / 100}%`
      : null,
    maturity ? `${maturity <= today ? 'Matured' : 'Matures'} ${dayMonthYear(maturity)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <SettingsRow
      icon="trending-up"
      round
      label={holding.name}
      sub={sub}
      subColor={holding.stale ? theme.colors.warnInk : undefined}
      onPress={onPress}
      divider={divider}
      right={
        <View style={styles.rowRight}>
          <Text style={styles.rowValue} numberOfLines={1}>
            {formatMaskableMoney(holding.valueMinor, { currency: cur, masked })}
          </Text>
          {holding.gainMinor != null && (
            <GainBadge
              gainMinor={holding.gainMinor}
              investedMinor={holding.investedMinor}
              currency={cur}
              moneyOnly
            />
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  rowRight: { alignItems: 'flex-end', gap: 3, flexShrink: 1 },
  rowValue: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
});
