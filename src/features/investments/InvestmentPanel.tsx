import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { withPressed } from '@/lib/pressed';
import { formatMaskableMoney } from '@/lib/money';
import { dayMonth } from '@/lib/dateLabels';
import { formatReturnPct, returnPct } from '@/lib/investment';
import type { Valuation } from '@/db/valuations';
import type { Account } from '@/types';
import { GainBadge, StalePill } from './GainPill';

export interface NextSip {
  amountMinor: number;
  date: string;
  fromName: string | undefined;
}

/**
 * Value page of a tracked account's sheet: invested / gain / return, value updates (tap to correct),
 * next planned contribution, and the button that records what it is worth now.
 */
export function InvestmentPanel({
  account,
  valuations,
  nextSip,
  masked,
  onUpdate,
  onEdit,
}: {
  account: Account;
  valuations: Valuation[] | null;
  nextSip: NextSip | null;
  masked: boolean;
  onUpdate: () => void;
  onEdit: (valuation: Valuation) => void;
}) {
  const inv = account.investment;
  if (!inv) return null;
  const money = (minor: number) => formatMaskableMoney(minor, { currency: account.currency, masked });
  const pct = returnPct(inv);
  const gain = inv.gainMinor;
  const gainColor =
    gain == null || gain === 0
      ? theme.colors.textPrimary
      : gain > 0
        ? theme.colors.incomeText
        : theme.colors.expenseText;

  return (
    <>
      <View style={styles.trio}>
        <Stat label="Invested" value={money(inv.investedMinor)} />
        <Stat
          label="Gain"
          value={
            gain == null
              ? '—'
              : masked
                ? money(0)
                : `${gain < 0 ? '−' : gain > 0 ? '+' : ''}${money(Math.abs(gain))}`
          }
          color={masked ? undefined : gainColor}
          divider
        />
        <Stat
          label="Return"
          value={pct == null ? '—' : masked ? '••%' : formatReturnPct(pct)}
          color={masked ? undefined : gainColor}
          divider
        />
      </View>

      <View style={styles.pillRow}>
        <StalePill account={account} />
      </View>

      <Text style={styles.label}>Updates</Text>
      {valuations === null ? null : valuations.length === 0 ? (
        <Text style={styles.empty}>
          No updates yet. Tell Yume what it is worth now and the gain appears here.
        </Text>
      ) : (
        <View style={styles.card}>
          {valuations.map((v, i) => {
            const down = v.gainMinor < 0;
            return (
              <Pressable
                key={v.id}
                onPress={() => onEdit(v)}
                style={withPressed([styles.row, i > 0 && styles.divider])}
                accessibilityRole="button"
                accessibilityLabel={`Edit the value from ${dayMonth(v.date)}`}
              >
                <View
                  style={[
                    styles.tile,
                    { backgroundColor: down ? theme.colors.expenseTint : theme.colors.incomeTint },
                  ]}
                >
                  <Feather
                    name={down ? 'trending-down' : 'trending-up'}
                    size={16}
                    color={down ? theme.colors.expenseText : theme.colors.incomeText}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowValue}>{money(v.valueMinor)}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {dayMonth(v.date)} · invested {money(v.investedMinor)}
                  </Text>
                </View>
                <GainBadge
                  gainMinor={v.gainMinor}
                  investedMinor={v.investedMinor}
                  currency={account.currency}
                  moneyOnly
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {nextSip && (
        <Text style={styles.sip}>
          Next SIP {money(nextSip.amountMinor)} · {dayMonth(nextSip.date)}
          {nextSip.fromName ? `, from ${nextSip.fromName}` : ''}
        </Text>
      )}

      <PrimaryButton title="Update value" variant="secondary" onPress={onUpdate} style={styles.update} />
    </>
  );
}

function Stat({
  label,
  value,
  color,
  divider,
}: {
  label: string;
  value: string;
  color?: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.stat, divider && styles.statDivider]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...EYEBROW, marginTop: 8 },
  trio: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    marginHorizontal: -4,
  },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  statLabel: { ...EYEBROW, marginBottom: 0 },
  statValue: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  pillRow: { marginTop: 10, marginBottom: 6, alignItems: 'flex-start' },
  card: {
    marginTop: 8,
    marginHorizontal: -4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowValue: { fontFamily: theme.font.monoBold, fontSize: 14, color: theme.colors.textPrimary },
  rowMeta: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  empty: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  sip: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 12 },
  update: { marginTop: 12 },
});
