import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { homeStyles as h } from '@/features/home/homeStyles';

/** "+₹1,600" / "−₹23,18,958" / "₹0": a true minus sign, and a plus for the lines of a sum. */
function signedMoney(minor: number, plus = true, masked = false): string {
  if (masked) return formatMaskableMoney(0, { masked: true });
  return `${minor < 0 ? '−' : plus && minor > 0 ? '+' : ''}${formatMoney(Math.abs(minor))}`;
}

function SumLine({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <View style={styles.sumLine}>
      <View style={[styles.sumKey, { backgroundColor: color }]} />
      <Text style={styles.sumLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.sumValue}>{text}</Text>
    </View>
  );
}

/**
 * The tracked balance, one line until you open it: accounts + loans + friends
 * as the sum it is, with the note about loans whose home or vehicle isn't
 * counted yet. Amounts that include savings are masked while those are hidden.
 */
export function TrackedCard({
  totalMinor,
  accountsMinor,
  loansMinor,
  peopleMinor,
  accountsLabel,
  showLoans,
  showPeople,
  untrackedAssetLoan,
  hasLoans,
  masked,
}: {
  totalMinor: number;
  accountsMinor: number;
  loansMinor: number;
  peopleMinor: number;
  accountsLabel: string;
  showLoans: boolean;
  showPeople: boolean;
  untrackedAssetLoan: boolean;
  hasLoans: boolean;
  masked: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[h.card, styles.card]}>
      <Pressable
        style={withPressed(styles.head)}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Tracked balance"
      >
        <View style={h.mid}>
          <Text style={styles.label}>Tracked balance</Text>
          <Text style={h.sub}>After loans and friends</Text>
        </View>
        <Text
          style={[styles.value, !masked && totalMinor < 0 && { color: theme.colors.expenseText }]}
          numberOfLines={1}
        >
          {signedMoney(totalMinor, false, masked)}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {open && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
          <View style={[styles.sumLines, h.divider]}>
            <SumLine
              color={theme.colors.secondary}
              label={accountsLabel}
              text={signedMoney(accountsMinor, true, masked)}
            />
            {showLoans && (
              <SumLine color={theme.colors.idGoldDeep} label="Loans" text={signedMoney(loansMinor)} />
            )}
            {showPeople && (
              <SumLine
                color={theme.colors.idCoralDeep}
                label="Friends & Family"
                text={signedMoney(peopleMinor)}
              />
            )}
          </View>
          {untrackedAssetLoan ? (
            <Pressable
              style={withPressed([styles.hint, styles.hintWarn])}
              onPress={() => router.push('/loans')}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="home-outline" size={16} color={theme.colors.ink} />
              <Text style={styles.hintText}>
                A loan's home or vehicle isn't counted until you add its value on the loan, so this can run
                negative for a completely normal loan.
              </Text>
              <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : (
            hasLoans && (
              <View style={styles.hint}>
                <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.textMuted} />
                <Text style={styles.hintText}>
                  Loans with a tracked asset value count their real equity here, not just the debt.
                </Text>
              </View>
            )
          )}
        </ReanimatedAnimated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  label: EYEBROW,
  value: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.textPrimary, flexShrink: 1 },
  sumLines: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  sumLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sumKey: { width: 10, height: 10, borderRadius: 3 },
  sumLabel: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  sumValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  hintWarn: { backgroundColor: theme.colors.idGold },
  hintText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
});
