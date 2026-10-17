import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney, getCurrencySymbol, toMajor } from '@/lib/money';
import { shortMonth } from '@/lib/dateLabels';

const TRACK = 72;

/** "₹3.3k", "₹1.2M" — short enough to sit above a bar; under 1,000 it is the plain amount. */
export function compactMoney(minor: number): string {
  const major = Math.abs(toMajor(minor));
  if (major < 1000) return formatMoney(minor);
  const [n, unit] = major < 1_000_000 ? [major / 1000, 'k'] : [major / 1_000_000, 'M'];
  return `${minor < 0 ? '−' : ''}${getCurrencySymbol()}${n.toFixed(1).replace(/\.0$/, '')}${unit}`;
}

/**
 * Monthly totals as labelled bars: value above each, the period's own (last) month in full colour and
 * earlier ones paler, "—" for an empty month, and a line at the usual month when there is one.
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
  const { fontScale } = useWindowDimensions();
  const labelRoom = Math.ceil(24 * Math.max(1, fontScale));
  const peak = Math.max(1, usualMinor ?? 0, ...months.map((m) => m.totalMinor));
  const last = months.length - 1;
  return (
    <View>
      <View style={[styles.plot, { height: TRACK + labelRoom }]}>
        <View style={styles.cols}>
          {months.map((m, i) => {
            const height = m.totalMinor > 0 ? Math.max(3, (m.totalMinor / peak) * TRACK) : 3;
            return (
              <View
                key={m.month}
                style={styles.col}
                accessible
                accessibilityLabel={`${shortMonth(`${m.month}-01`)}: ${formatMoney(m.totalMinor)}`}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[styles.value, i === last && styles.lastText, { bottom: height + 6 }]}
                >
                  {m.totalMinor !== 0 ? compactMoney(m.totalMinor) : '—'}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor:
                        m.totalMinor > 0 ? (i === last ? color : `${color}73`) : theme.colors.borderSoft,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
        {usualMinor != null && usualMinor > 0 && (
          <View pointerEvents="none" style={[styles.usual, { bottom: (usualMinor / peak) * TRACK }]} />
        )}
      </View>
      <View style={styles.labels}>
        {months.map((m, i) => (
          <Text key={m.month} style={[styles.label, i === last && styles.lastText]}>
            {shortMonth(`${m.month}-01`)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { position: 'relative' },
  cols: { flexDirection: 'row', gap: 8, height: '100%' },
  labels: { flexDirection: 'row', gap: 8 },
  col: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  value: {
    position: 'absolute',
    maxWidth: '100%',
    fontFamily: theme.font.bodyMedium,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  label: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11,
    flex: 1,
    textAlign: 'center',
    minHeight: 18,
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
