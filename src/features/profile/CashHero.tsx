import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Amount } from '@/components/Amount';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';

/** One account type's slice of the money map. */
export interface MoneyShare {
  key: string;
  label: string;
  color: string;
  minor: number;
  /** Savings: masked, and left out of the bar, while those amounts are hidden. */
  sensitive: boolean;
}

/**
 * First card on You, the money map: what is in your accounts right now in the big thin figure, then one bar
 * split by account type so you see where it sits, with each type's total under it. Leads with this, not the
 * tracked balance, since loans can pull that far below zero normally; the tracked balance (`children`) sits at
 * its foot. Masked when savings amounts are hidden, as it includes them.
 */
export function CashHero({
  minor,
  label,
  sub,
  masked,
  shares = [],
  children,
}: {
  minor: number;
  label: string;
  sub: string;
  masked: boolean;
  /** Each account type's total, in the default currency. */
  shares?: MoneyShare[];
  children?: React.ReactNode;
}) {
  // Only money that's there makes the bar; a card in debt shows in the legend instead.
  const bar = shares.filter((s) => s.minor > 0 && !(masked && s.sensitive));
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.topMain}>
          <Text style={styles.label}>{label}</Text>
          {masked ? (
            <Text style={styles.figure}>{formatMaskableMoney(0, { masked: true })}</Text>
          ) : (
            <CountUpAmount
              minor={minor}
              countFromZero={false}
              style={styles.figure}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
        </View>
        <Text style={styles.sub}>{sub}</Text>
      </View>

      {bar.length > 1 && (
        <View
          style={styles.shelf}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {bar.map((s) => (
            <View key={s.key} style={[styles.slice, { flexGrow: s.minor, backgroundColor: s.color }]} />
          ))}
        </View>
      )}
      {shares.length > 1 && (
        <View style={styles.legend}>
          {shares.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.key, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel}>{s.label} </Text>
              <Amount
                minor={s.minor}
                sensitive={s.sensitive}
                style={[styles.legendValue, s.minor < 0 && { color: theme.colors.expenseText }]}
              />
            </View>
          ))}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The flat summary card the other screens lead with.
  card: {
    ...h.card,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
    borderWidth: 1,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 8px 24px rgba(18,19,15,0.05)',
    overflow: 'visible',
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
  },
  topMain: { flexShrink: 1, minWidth: 0 },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  sub: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  shelf: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' },
  slice: { flexBasis: 0, minWidth: 6, height: 8, borderRadius: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 },
  legendItem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%' },
  key: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  legendValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
});
