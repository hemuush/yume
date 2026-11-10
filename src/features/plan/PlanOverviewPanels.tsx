import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import type { BudgetsSummary, DueGroup, LoansSummary } from './planOverview';
import type { SavingsGoal } from '@/types';
import type { PlanTab } from './PlanNavigation';
import type { Runway } from './runway';
import { dayMonth } from '@/lib/dateLabels';
import { parseLocalIsoDate } from '@/lib/date';
import { gainLabel } from '@/lib/investment';
import { goalProgress } from '@/lib/savingsGoalProgress';
import type { Portfolio } from '@/lib/portfolio';

type Alert = { key: string; title: string; detail: string; onPress: () => void };

type Tile = {
  key: string;
  name: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  /** The tile's one figure, with a quiet word after it ("of ₹20,000", "left"). */
  figure?: string;
  unit?: string;
  /** Bar segments as shares of the whole track (0–1), in order; what is left stays empty track. */
  bar?: { share: number; color: string }[];
  note: string;
  noteTone?: 'bad' | 'good';
  onPress: () => void;
};

/** Up to this many budgets get their own colour in the Budgets bar; the rest share one. */
const BAR_BUDGETS = 4;

function PlanStatusTile({ tile, wide }: { tile: Tile; wide: boolean }) {
  const { accent } = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tile.name}. ${[tile.figure, tile.unit, tile.note].filter(Boolean).join(' ')}`}
      onPress={tile.onPress}
      style={withPressedTint(accent, [s.tile, wide && s.tileWide])}
    >
      <View style={s.tileHead}>
        <Feather name={tile.icon} size={13} color={theme.colors.textSecondary} />
        <Text style={s.tileName}>{tile.name}</Text>
        <Feather name="chevron-right" size={13} color={theme.colors.textMuted} />
      </View>
      {tile.figure ? (
        <Text style={s.figure}>
          {tile.figure}
          {tile.unit ? <Text style={s.unit}> {tile.unit}</Text> : null}
        </Text>
      ) : null}
      {tile.bar && (
        <View style={s.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {tile.bar.map((seg, i) => (
            <View key={i} style={{ flexGrow: Math.max(0, seg.share), backgroundColor: seg.color }} />
          ))}
          <View style={{ flexGrow: Math.max(0, 1 - tile.bar.reduce((sum, seg) => sum + seg.share, 0)) }} />
        </View>
      )}
      <Text style={[s.note, tile.noteTone === 'bad' && s.bad, tile.noteTone === 'good' && s.good]}>
        {tile.note}
      </Text>
    </Pressable>
  );
}

export function PlanOverviewPanels({
  budgets,
  groups,
  loans,
  goals,
  today,
  hideAmounts,
  runway,
  investments,
  onInvestments,
  onTab,
  onBudget,
}: {
  budgets: BudgetsSummary;
  groups: DueGroup[];
  loans: LoansSummary;
  goals: SavingsGoal[];
  today: string;
  hideAmounts: boolean;
  /** When its balance dips below zero, the shortfall is the first thing needing attention. */
  runway?: Runway;
  investments: Portfolio;
  onInvestments: () => void;
  onTab: (tab: PlanTab) => void;
  onBudget: (id: string) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const oneColumn = width < 340 || fontScale > 1.3;
  const overdue = groups
    .flatMap((g) => g.items)
    .filter((item) => item.dueDate < today && (item.kind === 'bill' || item.kind === 'emi'));
  const alerts: Alert[] = [];
  if (runway?.short)
    alerts.push({
      key: 'short',
      title: 'Balance runs short',
      detail: `${formatMoney(runway.short.minor)} below zero on ${dayMonth(runway.short.date)}`,
      onPress: () => onTab('upcoming'),
    });
  if (overdue.length)
    alerts.push({
      key: 'late',
      title: `${overdue.length} overdue payment${overdue.length === 1 ? '' : 's'}`,
      detail: 'Review the payment schedule',
      onPress: () => onTab('upcoming'),
    });
  for (const budget of budgets.rows
    .filter((b) => b.overBudget)
    .sort((a, b) => a.remainingMinor - b.remainingMinor)
    .slice(0, 2))
    alerts.push({
      key: budget.id,
      title: budget.categoryName,
      detail: `${formatMoney(Math.max(0, -budget.remainingMinor))} over budget`,
      onPress: () => onBudget(budget.id),
    });

  const active = goals.filter((g) => !g.archived);
  const borrowed = loans.rows.filter((l) => l.direction === 'borrowed');
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

  // Budgets: used of budgeted, the bar split by budget so the heavy ones show.
  const shownBudgets = budgets.rows.slice(0, BAR_BUDGETS);
  const budgetTile: Tile = budgets.rows.length
    ? {
        key: 'budgets',
        name: 'Budgets',
        icon: 'pie-chart',
        figure: formatMoney(budgets.usedMinor),
        unit: `of ${formatMoney(budgets.budgetedMinor)}`,
        bar:
          budgets.budgetedMinor > 0
            ? [
                ...shownBudgets.map((b) => ({
                  share: Math.min(b.spentMinor, b.effectiveLimitMinor) / budgets.budgetedMinor,
                  color: b.overBudget ? theme.colors.expense : (b.categoryColor ?? theme.colors.slice.free),
                })),
                {
                  share:
                    budgets.rows
                      .slice(BAR_BUDGETS)
                      .reduce((sum, b) => sum + Math.min(b.spentMinor, b.effectiveLimitMinor), 0) /
                    budgets.budgetedMinor,
                  color: theme.colors.otherSlice,
                },
              ]
            : undefined,
        note:
          budgets.overCount > 0
            ? `${count(budgets.rows.length, 'budget')} · ${budgets.overCount} over`
            : `${count(budgets.rows.length, 'budget')} · all within limits`,
        noteTone: budgets.overCount > 0 ? 'bad' : undefined,
        onPress: () => onTab('money'),
      }
    : {
        key: 'budgets',
        name: 'Budgets',
        icon: 'pie-chart',
        note: 'Set a category spending limit',
        onPress: () => onTab('money'),
      };

  // Goals: what is saved across them, and how far the nearest one is. Nothing saved shows with savings hidden.
  const lead = [...active].sort(
    (a, b) =>
      goalProgress(b.currentAmountMinor, b.targetAmountMinor).percent -
      goalProgress(a.currentAmountMinor, a.targetAmountMinor).percent
  )[0];
  const reached = active.filter(
    (g) => g.targetAmountMinor > 0 && g.currentAmountMinor >= g.targetAmountMinor
  ).length;
  const goalTile: Tile = active.length
    ? hideAmounts
      ? {
          key: 'goals',
          name: 'Goals',
          icon: 'flag',
          figure: count(active.length, 'goal'),
          note: 'Saved amounts hidden',
          onPress: () => onTab('money'),
        }
      : {
          key: 'goals',
          name: 'Goals',
          icon: 'flag',
          figure: formatMoney(active.reduce((sum, g) => sum + Math.max(0, g.currentAmountMinor), 0)),
          unit: 'saved',
          bar: lead
            ? [
                {
                  share: goalProgress(lead.currentAmountMinor, lead.targetAmountMinor).percent / 100,
                  color: theme.colors.slice.saved,
                },
              ]
            : undefined,
          note: `${count(active.length, 'goal')} · ${reached} reached`,
          onPress: () => onTab('money'),
        }
    : {
        key: 'goals',
        name: 'Goals',
        icon: 'flag',
        note: 'Start a savings goal',
        onPress: () => onTab('money'),
      };

  // Debt: what is left and the month it ends. The repaid share is the bar; the Debt tab says it in figures.
  const debtFree = loans.debtFreeDate
    ? parseLocalIsoDate(loans.debtFreeDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;
  const debtTile: Tile = borrowed.length
    ? {
        key: 'debt',
        name: 'Debt',
        icon: 'credit-card',
        figure: formatMoney(loans.debtLeftMinor),
        unit: 'left',
        bar: [{ share: Math.min(1, Math.max(0, loans.paidFraction)), color: theme.colors.slice.debt }],
        note: debtFree
          ? `${count(borrowed.length, 'loan')} · free by ${debtFree}`
          : `${count(borrowed.length, 'active loan')}`,
        onPress: () => onTab('debt'),
      }
    : {
        key: 'debt',
        name: 'Debt',
        icon: 'credit-card',
        note: 'Track borrowing and lending',
        onPress: () => onTab('debt'),
      };

  const tracked = investments.holdings.length > 0 || investments.otherCurrency.length > 0;
  const stale = investments.holdings.filter((x) => x.stale).length;
  const gain =
    investments.gainMinor == null
      ? null
      : gainLabel(
          { gainMinor: investments.gainMinor, investedMinor: investments.investedMinor },
          { currency: investments.currency, masked: hideAmounts }
        );
  const investTile: Tile = tracked
    ? {
        key: 'investments',
        name: 'Investments',
        icon: 'trending-up',
        figure: formatMaskableMoney(investments.valueMinor, {
          currency: investments.currency,
          masked: hideAmounts,
        }),
        note:
          [gain, stale > 0 ? `${stale} value${stale === 1 ? '' : 's'} due` : null]
            .filter(Boolean)
            .join(' · ') || 'Up to date',
        noteTone:
          !hideAmounts && investments.gainMinor != null && stale === 0
            ? investments.gainMinor > 0
              ? 'good'
              : investments.gainMinor < 0
                ? 'bad'
                : undefined
            : undefined,
        onPress: onInvestments,
      }
    : {
        key: 'investments',
        name: 'Investments',
        icon: 'trending-up',
        note: "Track what you've invested",
        onPress: onInvestments,
      };

  return (
    <>
      {alerts.length > 0 && (
        <Section compact title="Needs attention">
          <View style={s.alerts}>
            {alerts.map((alert) => (
              <Pressable
                key={alert.key}
                accessibilityRole="button"
                accessibilityLabel={`${alert.title}. ${alert.detail}`}
                onPress={alert.onPress}
                style={withPressed(s.alert)}
              >
                <Feather name="alert-circle" size={16} color={theme.colors.expenseText} />
                <View style={s.alertCopy}>
                  <Text style={s.alertTitle}>{alert.title}</Text>
                  <Text style={s.alertDetail}>{alert.detail}</Text>
                </View>
                <Feather name="chevron-right" size={15} color={theme.colors.expenseText} />
              </Pressable>
            ))}
          </View>
        </Section>
      )}
      <Section compact title="Your plans">
        <View style={s.grid}>
          {[debtTile, budgetTile, goalTile, investTile].map((tile) => (
            <PlanStatusTile key={tile.key} tile={tile} wide={oneColumn} />
          ))}
        </View>
      </Section>
    </>
  );
}

const s = StyleSheet.create({
  alerts: { marginHorizontal: 16, gap: 6 },
  // One tinted line per alert: the tint says "look", so no icon tile or card is needed.
  alert: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.expenseTint,
  },
  alertCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: 6 },
  alertTitle: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  alertDetail: {
    flexShrink: 1,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  grid: { marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  tileWide: { flexBasis: '100%' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileName: { flex: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  track: {
    flexDirection: 'row',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.trayTrack,
  },
  note: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  bad: { fontFamily: theme.font.bodyMedium, color: theme.colors.expenseText },
  good: { fontFamily: theme.font.bodyMedium, color: theme.colors.incomeText },
});
