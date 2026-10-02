import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney, getCurrencySymbol, toMajor } from '@/lib/money';
import { shortMonth } from '@/lib/dateLabels';

const TRACK = 72;
const LABEL = 18;

/** "₹3.3k", "₹1.2M" — short enough to sit above a bar; under 1,000 it is the plain amount. */
export function compactMoney(minor: number): string {
  const major = Math.abs(toMajor(minor));
  if (major < 1000) return formatMoney(minor);
  const [n, unit] = major < 1_000_000 ? [major / 1000, 'k'] : [major / 1_000_000, 'M'];
  return `${getCurrencySymbol()}${n.toFixed(1).replace(/\.0$/, '')}${unit}`;
}

/**
 * Monthly totals as labelled bars: the value above each, the last month
 * (the period's own) in the full colour and earlier ones paler, "—" for a
 * month with nothing, and a line at the usual month when there is one.
 */
export function MonthBars({
  months,
  color,
  usualMinor,
}: {
  months: { month: string; totalMinor: number }[];
  color: string;
  usualMinor: number | null;
}) {
  const peak = Math.max(1, usualMinor ?? 0, ...months.map((m) => m.totalMinor));
  const last = months.length - 1;
  return (
    <View>
      <View style={styles.cols}>
        {months.map((m, i) => {
          const isLast = i === last;
          const has = m.totalMinor > 0;
          return (
            <View
              key={m.month}
              style={styles.col}
              accessibilityLabel={`${shortMonth(`${m.month}-01`)}: ${formatMoney(m.totalMinor)}`}
            >
              <Text style={[styles.value, isLast && styles.lastText]}>
                {has ? compactMoney(m.totalMinor) : '—'}
              </Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: has ? Math.max(3, (m.totalMinor / peak) * TRACK) : 3,
                      backgroundColor: has ? (isLast ? color : `${color}73`) : theme.colors.borderSoft,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.label, isLast && styles.lastText]}>{shortMonth(`${m.month}-01`)}</Text>
            </View>
          );
        })}
      </View>
      {usualMinor != null && usualMinor > 0 && (
        <View pointerEvents="none" style={[styles.usual, { bottom: LABEL + (usualMinor / peak) * TRACK }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 8 },
  col: { flex: 1, alignItems: 'center' },
  value: { fontFamily: theme.font.monoBold, fontSize: 9.5, height: 14, color: theme.colors.textSecondary },
  track: { height: TRACK, width: '70%', justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  label: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11,
    height: LABEL,
    paddingTop: 3,
    color: theme.colors.textMuted,
  },
  lastText: { color: theme.colors.textPrimary, fontFamily: theme.font.bodyBold },
  usual: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: theme.colors.ink,
    opacity: 0.3,
  },
});
