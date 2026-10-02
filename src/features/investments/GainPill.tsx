import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePrivacy } from '@/theme/PrivacyContext';
import { toLocalIsoDate } from '@/lib/date';
import { gainLabel, isValueStale, valueAgeDays, ageLabel } from '@/lib/investment';
import type { Account } from '@/types';

/** A gain as a pill: green when up, red when down; hidden amounts mask the gain and the percentage together. */
export function GainBadge({
  gainMinor,
  investedMinor,
  currency,
  moneyOnly,
}: {
  gainMinor: number;
  investedMinor: number;
  currency?: string;
  moneyOnly?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const label = gainLabel({ gainMinor, investedMinor }, { currency, masked: hideAmounts, moneyOnly });
  const down = gainMinor < 0;
  return (
    <View
      style={[styles.pill, { backgroundColor: down ? theme.colors.expenseTint : theme.colors.incomeTint }]}
    >
      <Text style={[styles.text, { color: down ? theme.colors.expenseText : theme.colors.incomeText }]}>
        {label}
      </Text>
    </View>
  );
}

/** A tracked account's gain as a pill, or a quiet "Add value" until its first update. */
export function GainPill({ account, moneyOnly }: { account: Account; moneyOnly?: boolean }) {
  const inv = account.investment;
  if (!inv) return null;
  if (inv.gainMinor == null) {
    return (
      <View style={[styles.pill, styles.neutral]}>
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>Add value</Text>
      </View>
    );
  }
  return (
    <GainBadge
      gainMinor={inv.gainMinor}
      investedMinor={inv.investedMinor}
      currency={account.currency}
      moneyOnly={moneyOnly}
    />
  );
}

/** "42 days old" in amber once a tracked value has gone stale; nothing otherwise. */
export function StalePill({ account }: { account: Account }) {
  const inv = account.investment;
  const today = toLocalIsoDate(new Date());
  if (!inv || !isValueStale(inv, today)) return null;
  const age = valueAgeDays(inv, today);
  return (
    <View style={[styles.pill, { backgroundColor: theme.colors.goldTint }]}>
      <Text style={[styles.text, { color: theme.colors.warnInk }]}>{ageLabel(age ?? 0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  neutral: { backgroundColor: theme.colors.inkWash },
  text: { fontFamily: theme.font.monoBold, fontSize: 11 },
});
