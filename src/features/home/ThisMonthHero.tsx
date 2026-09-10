import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { clampSavingsRate, savingsRateLabel } from '@/lib/savingsRate';
import { FlynnIllustration } from '@/components/FlynnIllustration';
import { SoftCard } from './SoftCard';
import type { FlynnLine } from './flynnLine';

/**
 * The month's headline: what came in and what went out, side by side, over a
 * single "how much of it you kept" bar — plus Flynn with one encouraging
 * line. Replaces the old 2×2 tile grid as the one thing the eye lands on.
 */
export function ThisMonthHero({
  incomeMinor,
  spentMinor,
  incomeChangePct,
  expenseChangePct,
  savingsPct,
  flynn,
}: {
  incomeMinor: number;
  spentMinor: number;
  incomeChangePct: number | null | undefined;
  expenseChangePct: number | null | undefined;
  savingsPct: number;
  flynn: FlynnLine;
}) {
  const hasIncome = incomeMinor > 0;
  const barPct = hasIncome ? Math.max(0, clampSavingsRate(savingsPct)) : 0;

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

        <View style={styles.flynn}>
          <FlynnIllustration size={62} pose={flynn.pose} />
          <Text style={styles.flynnText}>{flynn.text}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${barPct}%` }]} />
      </View>
      <Text style={styles.barLabel}>
        {hasIncome ? `${savingsRateLabel(savingsPct)} of income saved` : 'Add income to track your saving'}
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

  flynn: { width: 118, alignItems: 'center', justifyContent: 'center' },
  flynnText: {
    fontFamily: theme.font.rounded,
    fontSize: 11.5,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },

  track: {
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    marginTop: 16,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.colors.secondary, borderRadius: theme.radius.pill },
  barLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 7,
  },
});
