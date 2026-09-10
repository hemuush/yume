import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { SuuIllustration } from '@/components/SuuIllustration';
import { SoftCard } from './SoftCard';
import type { SuuLine } from './suuLine';

/**
 * The month's headline: what came in and what went out, side by side, over a
 * single "how much of it you kept" bar — plus Suu with one encouraging
 * line. Replaces the old 2×2 tile grid as the one thing the eye lands on.
 */
export function ThisMonthHero({
  incomeMinor,
  spentMinor,
  incomeChangePct,
  expenseChangePct,
  suu,
}: {
  incomeMinor: number;
  spentMinor: number;
  incomeChangePct: number | null | undefined;
  expenseChangePct: number | null | undefined;
  suu: SuuLine;
}) {
  const hasIncome = incomeMinor > 0;
  const overspent = hasIncome && spentMinor > incomeMinor;
  // Bar spans this month's income: coral for the spent share, mint for the rest.
  const spentPct = hasIncome ? Math.min(100, (spentMinor / incomeMinor) * 100) : 0;
  const keptPct = Math.max(0, 100 - spentPct);

  return (
    <SoftCard elevated backgroundColor={theme.colors.primaryTint} style={styles.card}>
      <Text style={styles.title}>This month</Text>

      <View style={styles.body}>
        <View style={styles.figures}>
          <Figure
            label="Income"
            amountMinor={incomeMinor}
            changePct={incomeChangePct}
            icon="arrow-up-right"
            color={theme.colors.income}
          />
          <Figure
            label="Spent"
            amountMinor={spentMinor}
            changePct={expenseChangePct}
            icon="arrow-down-right"
            color={theme.colors.expense}
          />
        </View>

        <View style={styles.suu}>
          <SuuIllustration size={62} pose={suu.pose} />
          <Text style={styles.suuText}>{suu.text}</Text>
        </View>
      </View>

      <View style={styles.track}>
        {overspent ? (
          <View style={[styles.fillOver, { width: '100%' }]} />
        ) : (
          <>
            <View style={[styles.fillSpent, { width: `${spentPct}%` }]} />
            <View style={[styles.fillKept, { width: `${keptPct}%` }]} />
          </>
        )}
      </View>
      <Text style={[styles.barLabel, overspent && styles.barLabelOver]}>
        {!hasIncome
          ? 'Add income to track your saving'
          : overspent
            ? `Spent ${formatMoney(spentMinor - incomeMinor)} more than came in`
            : `${formatMoney(spentMinor)} spent · ${Math.round(keptPct)}% kept`}
      </Text>
    </SoftCard>
  );
}

function Figure({
  label,
  amountMinor,
  changePct,
  icon,
  color,
}: {
  label: string;
  amountMinor: number;
  changePct: number | null | undefined;
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
}) {
  return (
    <View style={styles.figure}>
      <View style={styles.figureHead}>
        <Feather name={icon} size={13} color={color} />
        <Text style={styles.figureLabel}>{label}</Text>
      </View>
      <Text style={styles.figureAmount} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(amountMinor)}
      </Text>
      {changePct != null && (
        <Text style={styles.figureTrend}>
          {changePct >= 0 ? '↑' : '↓'} {formatPctChange(changePct)} vs last
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 4 },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 13,
    letterSpacing: 0.3,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  body: { flexDirection: 'row', gap: 12, marginTop: 12 },
  figures: { flex: 1, gap: 14, justifyContent: 'center' },
  figure: {},
  figureHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  figureLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  figureAmount: {
    fontFamily: theme.font.monoBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginTop: 3,
  },
  figureTrend: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textMuted, marginTop: 2 },

  suu: { width: 118, alignItems: 'center', justifyContent: 'center' },
  suuText: {
    fontFamily: theme.font.rounded,
    fontSize: 11.5,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  track: {
    flexDirection: 'row',
    height: 11,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    marginTop: 16,
    overflow: 'hidden',
  },
  fillSpent: { height: '100%', backgroundColor: theme.colors.idCoralDeep },
  fillKept: { height: '100%', backgroundColor: theme.colors.secondary },
  fillOver: {
    height: '100%',
    backgroundColor: theme.colors.expense,
  },
  barLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 7,
  },
  barLabelOver: { color: theme.colors.expense, fontFamily: theme.font.bodyBold },
});
