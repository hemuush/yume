import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { SettingsRow } from '@/components/SettingsRow';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';
import { ageLabel, estimatedValue, INVESTMENT_KIND_LABEL } from '@/lib/investment';
import type { Holding } from '@/lib/portfolio';
import type { Account } from '@/types';
import { GainBadge } from './GainPill';
import { themedStyles } from '@/theme/themedStyles';

/**
 * One holding in a list: its name, kind and how old its value is, the estimate and maturity for a deposit,
 * the value and the gain. Opens the holding's sheet.
 */
export const HoldingRow = memo(function HoldingRow({
  holding,
  today,
  masked,
  onOpen,
  divider,
}: {
  holding: Holding;
  today: string;
  masked: boolean;
  /** One function for every row (it is handed the account), so a row is drawn again only when its own holding changes. */
  onOpen: (account: Account) => void;
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
      onPress={() => onOpen(holding.account)}
      divider={divider}
      right={
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>
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
});

const styles = themedStyles(() =>
  StyleSheet.create({
    rowRight: { alignItems: 'flex-end', gap: 3, flexShrink: 1 },
    rowValue: {
      fontFamily: theme.font.bodyBold,
      fontSize: 15,
      color: theme.colors.textPrimary,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
  })
);
