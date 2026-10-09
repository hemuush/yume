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
import { screenStyles as h } from '@/components/screenStyles';
import { useAccent } from '@/theme/AccentContext';
import { GLASS, GLASS_CARD } from '@/components/Glass';

/** "+₹1,600" / "−₹23,18,958" / "₹0": a true minus sign, and a plus for the lines of a sum. */
function signedMoney(minor: number, plus = true, masked = false, currency?: string): string {
  if (masked) return formatMaskableMoney(0, { currency, masked: true });
  return `${minor < 0 ? '−' : plus && minor > 0 ? '+' : ''}${formatMoney(Math.abs(minor), currency)}`;
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
 * The tracked balance, one line until opened: accounts + loans + friends as the sum it is, with a note about
 * loans whose home or vehicle isn't counted yet. Amounts including savings are masked while those are hidden.
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
  currency,
  embedded = false,
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
  /** The currency every figure here is in (the app's default); falls back to it when omitted. */
  currency?: string;
  /** Sits under the cash hero in one shared card, so it draws no edge or margin of its own. */
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { secondary } = useAccent();
  return (
    <View style={embedded ? styles.embedded : [h.card, GLASS_CARD, styles.card]}>
      <Pressable
        style={withPressed([styles.head, embedded && styles.headEmbedded])}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Tracked balance, ${signedMoney(totalMinor, false, masked, currency)}, after loans and friends`}
      >
        <View style={h.mid}>
          <Text style={styles.label}>Tracked balance</Text>
          <Text style={h.sub}>After loans and friends</Text>
        </View>
        <Text
          style={[styles.value, !masked && totalMinor < 0 && { color: theme.colors.expenseText }]}
          numberOfLines={1}
        >
          {signedMoney(totalMinor, false, masked, currency)}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {open && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
          <View style={[styles.sumLines, !embedded && styles.inset]}>
            <SumLine
              color={secondary}
              label={accountsLabel}
              text={signedMoney(accountsMinor, true, masked, currency)}
            />
            {showLoans && (
              <SumLine
                color={theme.colors.idGoldDeep}
                label="Loans"
                text={signedMoney(loansMinor, true, false, currency)}
              />
            )}
            {showPeople && (
              <SumLine
                color={theme.colors.idCoralDeep}
                label="Friends & Family"
                text={signedMoney(peopleMinor, true, false, currency)}
              />
            )}
            <View style={styles.sumTotal}>
              <Text style={styles.sumTotalLabel}>Tracked balance</Text>
              <Text style={styles.sumValue}>{signedMoney(totalMinor, false, masked, currency)}</Text>
            </View>
          </View>
          {untrackedAssetLoan ? (
            <Pressable
              style={withPressed([styles.hint, styles.hintWarn, !embedded && styles.inset])}
              onPress={() => router.push('/loans')}
              accessibilityRole="button"
              accessibilityLabel="A loan's home or vehicle isn't counted yet. Open loans to add its value"
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
              <View style={[styles.hint, !embedded && styles.inset]}>
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
  card: { marginTop: 10, paddingBottom: 4 },
  // At the foot of the money map, which draws the glass and the padding.
  embedded: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(18,19,15,0.14)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  headEmbedded: { paddingHorizontal: 0, paddingBottom: 0 },
  label: EYEBROW,
  value: { fontFamily: theme.font.monoBold, fontSize: 16, color: theme.colors.textPrimary, flexShrink: 1 },
  // The sum, on a brighter pane: each part, then a rule and the total.
  sumLines: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fillStrong,
  },
  inset: { marginHorizontal: 14, marginBottom: 10 },
  sumLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sumKey: { width: 10, height: 10, borderRadius: 3 },
  sumLabel: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  sumValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  sumTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 7,
    borderTopWidth: 1.5,
    borderTopColor: theme.colors.ink,
  },
  sumTotalLabel: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
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
