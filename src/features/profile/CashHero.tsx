import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { Amount } from '@/components/Amount';
import { screenStyles as h } from '@/components/screenStyles';
import { styles as hero } from '@/features/home/hero.styles';
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
      <Text style={styles.label}>{label}</Text>
      {masked ? (
        <Text style={hero.headValue}>{formatMaskableMoney(0, { masked: true })}</Text>
      ) : (
        <CountUpAmount
          minor={minor}
          countFromZero={false}
          symbolStyle={hero.headSymbol}
          style={hero.headValue}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      )}
      <Text style={styles.sub}>{sub}</Text>

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
  card: { ...h.card, marginTop: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 8 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: -6 },
  shelf: { flexDirection: 'row', gap: 3, height: 8 },
  slice: {
    flexBasis: 0,
    minWidth: 8,
    height: 8,
    borderRadius: 4,
    boxShadow: `inset 0 0 0 1px ${theme.colors.inkHairline}`,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6 },
  legendItem: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', maxWidth: '100%' },
  key: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 5,
    boxShadow: `inset 0 0 0 1px ${theme.colors.inkHairline}`,
  },
  legendLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  legendValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textPrimary,
  },
});
