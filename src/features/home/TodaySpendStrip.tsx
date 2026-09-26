import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { LimitMeter } from '@/components/LimitMeter';

/**
 * The "how's today going" line, right under the "This month" hero — a thin
 * status strip, not another big card, and only rendered at all when the
 * user has actually set a daily spending goal in Settings → Money. No
 * rollover, no per-category split: it's a same-day gut-check, deliberately
 * simpler than category Budgets.
 */
export function TodaySpendStrip({ spentMinor, goalMinor }: { spentMinor: number; goalMinor: number }) {
  const pct = goalMinor > 0 ? (spentMinor / goalMinor) * 100 : 0;
  const overBy = spentMinor - goalMinor;
  const tone: 'ok' | 'near' | 'over' = pct >= 100 ? 'over' : pct >= 80 ? 'near' : 'ok';
  const colors = TONE_COLORS[tone];

  return (
    <View style={[styles.strip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: colors.border }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>
          {tone === 'over' ? (
            <>
              Today: <Text style={styles.bold}>{formatMoney(spentMinor)}</Text> —{' '}
              <Text style={styles.bold}>{formatMoney(overBy)} over</Text> your {formatMoney(goalMinor)} goal
            </>
          ) : (
            <>
              Today: <Text style={styles.bold}>{formatMoney(spentMinor)}</Text> of{' '}
              <Text style={styles.bold}>{formatMoney(goalMinor)}</Text> goal
              {tone === 'near' ? ' — getting close' : ''}
            </>
          )}
        </Text>
        <View style={styles.meter}>
          <LimitMeter pct={pct} tone={tone} />
        </View>
      </View>
    </View>
  );
}

const TONE_COLORS = {
  ok: { bg: theme.colors.incomeTint, border: theme.colors.income },
  near: { bg: theme.colors.idGold, border: theme.colors.idGoldDeep },
  over: { bg: theme.colors.expenseTint, border: theme.colors.expense },
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 1 },
  text: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textPrimary, lineHeight: 16 },
  bold: { fontFamily: theme.font.bodyBold },
  meter: { marginTop: 6 },
});
