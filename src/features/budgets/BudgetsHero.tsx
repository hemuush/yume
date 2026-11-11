import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { PaceBar } from '@/components/Frost';
import {
  SummaryCard,
  SummaryFacts,
  SummarySide,
  SummaryTop,
  summaryFigure,
  summaryNote,
  type SummaryFact,
} from '@/components/SummaryCard';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import type { BudgetsHeroFigures, BudgetsTone } from './budgetsOverview';

/** The bar's fill takes the month's tone: calm green, amber once ahead of pace, coral once over. */
const FILL: Record<BudgetsTone, string> = {
  ok: theme.colors.slice.saved,
  ahead: theme.colors.slice.due,
  over: theme.colors.slice.spent,
};

/** What needs a look, in one fact: the budgets over, the ones ahead of pace, or that all is well. */
function lookFact(h: BudgetsHeroFigures): SummaryFact {
  const parts = [
    h.overCount > 0 ? `${h.overCount} over` : null,
    h.aheadCount > 0 ? `${h.aheadCount} ahead` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return { label: 'Status', value: 'On track', tone: 'good' };
  return { label: 'Needs a look', value: parts.join(' · '), tone: h.overCount > 0 ? 'bad' : 'warn' };
}

/**
 * First card on Budgets, the same flat summary card as Loans: what's left across all limits this month (or
 * what's over) with the daily allowance and days left beside it, a pace bar with a tick where an even month
 * would be today, and the spent, the limit and what needs a look as small facts.
 */
export function BudgetsHero({ figures: h }: { figures: BudgetsHeroFigures }) {
  const over = h.spentMinor > h.limitMinor;
  const daysLeft = h.daysLeft === 0 ? 'Last day' : `${h.daysLeft} ${h.daysLeft === 1 ? 'day' : 'days'} left`;
  const evenPaceMinor = Math.round((h.limitMinor * h.expectedPct) / 100);

  return (
    <SummaryCard>
      <SummaryTop
        label={over ? 'Over this month' : 'Left this month'}
        figure={
          <CountUpAmount
            minor={over ? h.overMinor : h.leftMinor}
            countFromZero={false}
            style={[summaryFigure, over && { color: theme.colors.expenseText }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          />
        }
        side={
          h.perDayMinor != null ? (
            <SummarySide main={`${formatMoney(h.perDayMinor)} a day`} note={daysLeft} />
          ) : (
            <SummarySide main={daysLeft} />
          )
        }
      />
      <View>
        <PaceBar
          animKey="budgets:hero"
          pct={h.usedPct}
          color={FILL[h.tone]}
          marker={h.expectedPct}
          height={8}
          style={styles.bar}
          accessibilityLabel={`${formatMoney(h.spentMinor)} spent of ${formatMoney(h.limitMinor)}. An even month would be at ${formatMoney(evenPaceMinor)} by today.`}
        />
        <View
          style={styles.barCaption}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.captionText}>{Math.round(h.usedPct)}% used</Text>
          <Text style={styles.captionText}>Even pace {Math.round(h.expectedPct)}%</Text>
        </View>
      </View>
      <SummaryFacts
        facts={[
          { label: 'Spent', value: formatMoney(h.spentMinor) },
          { label: 'Limit', value: formatMoney(h.limitMinor) },
          lookFact(h),
        ]}
      />
      {!!h.nestedCount && (
        <Text style={styles.note}>Subcategory limits are included in their parent budget totals.</Text>
      )}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: 0 },
  barCaption: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  captionText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  note: summaryNote,
});
