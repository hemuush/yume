import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass, GLASS } from '@/components/Glass';
import { Kicker, FrostChip, PaceBar, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';

/** Under this % either way, spending reads as "about usual". */
const ABOUT_USUAL_PCT = 5;

/**
 * Reports' first card, the period at a glance: what went out in the big thin figure, against the usual month
 * (a pace bar with a tick where usual spending would be by today, for the month in progress), chips for how
 * it sits against usual and against the period before, then Money in · Spent · Kept. Its figures come from the
 * same (privacy-filtered) comparison as the rest of Reports.
 */
export function ReportsHero({
  periodLabel,
  spentMinor,
  incomeMinor,
  baselineMinor,
  vsUsual,
  previousMinor,
  previousLabel,
  monthProgress,
}: {
  /** "October", "2026", "FY 2025–26". */
  periodLabel: string;
  spentMinor: number;
  incomeMinor: number;
  /** A usual month's spend (month views only), or null. */
  baselineMinor: number | null;
  /** This period against usual, from vsUsual; null when there's nothing to compare. */
  vsUsual: { pct: number; soFar: boolean } | null;
  /** The period before's spend, and how to name it ("September", "last year"); null to leave it out. */
  previousMinor: number | null;
  previousLabel: string;
  /** For the month in progress: how far through it today is (0–1). Null otherwise. */
  monthProgress: number | null;
}) {
  const keptMinor = incomeMinor - spentMinor;
  const diff = previousMinor != null ? roundedMinor(spentMinor) - roundedMinor(previousMinor) : null;
  const usualPct = vsUsual ? Math.round(vsUsual.pct) : null;
  return (
    <Glass radius={28} tone="strong" style={styles.card}>
      <View style={frost.heroRow}>
        <View style={frost.heroMain}>
          <Kicker icon="bar-chart-2">Spent in {periodLabel}</Kicker>
          <Text style={frost.bigValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(spentMinor)}
          </Text>
        </View>
        {baselineMinor != null && (
          <View style={frost.side}>
            <Text style={frost.sideLabel}>Usual month</Text>
            <Text style={frost.sideValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(baselineMinor)}
            </Text>
          </View>
        )}
      </View>

      {monthProgress != null && baselineMinor != null && baselineMinor > 0 && (
        <>
          <PaceBar
            animKey={`reports:hero:${periodLabel}`}
            pct={(spentMinor / baselineMinor) * 100}
            color={theme.colors.ink}
            marker={monthProgress * 100}
          />
          <Text style={frost.note2}>The tick is where a usual month would be by today</Text>
        </>
      )}

      {(usualPct != null || (diff != null && diff !== 0)) && (
        <View style={frost.chips}>
          {usualPct != null &&
            (Math.abs(usualPct) < ABOUT_USUAL_PCT ? (
              <FrostChip icon="check" tone="ok">
                About usual{vsUsual?.soFar ? ' so far' : ''}
              </FrostChip>
            ) : (
              <FrostChip
                icon={usualPct > 0 ? 'trending-up' : 'trending-down'}
                tone={usualPct > 0 ? 'bad' : 'ok'}
              >
                {Math.abs(usualPct)}% {usualPct > 0 ? 'above' : 'below'} usual
                {vsUsual?.soFar ? ' so far' : ''}
              </FrostChip>
            ))}
          {diff != null && diff !== 0 && (
            <FrostChip icon={diff > 0 ? 'arrow-up-right' : 'arrow-down-right'}>
              {formatMoney(Math.abs(diff))} {diff > 0 ? 'more' : 'less'} than {previousLabel}
            </FrostChip>
          )}
        </View>
      )}

      <View style={styles.cells}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Money in</Text>
          <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(incomeMinor)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Spent</Text>
          <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(spentMinor)}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Kept</Text>
          <Text
            style={[
              styles.cellValue,
              { color: keptMinor < 0 ? theme.colors.expenseText : theme.colors.incomeText },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {keptMinor < 0 ? '−' : ''}
            {formatMoney(Math.abs(keptMinor))}
          </Text>
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, marginTop: 4, marginBottom: 4 },
  cells: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
    gap: 2,
  },
  cellLabel: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  cellValue: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
});
