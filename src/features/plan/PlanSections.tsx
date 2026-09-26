import { useState } from 'react';
import { View, Pressable, ScrollView, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { dueDateLabel } from '@/lib/dueDate';
import { parseLocalIsoDate } from '@/lib/date';
import { projectedMonthlySpend } from '@/lib/whatIf';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { SavingsGoal } from '@/types';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h, HOME } from '@/features/home/homeStyles';
import { GoalChip } from '@/features/goals/GoalChip';
import {
  BUDGET_NEAR_PCT,
  BudgetsSummary,
  DueSoon,
  HabitState,
  LoansSummary,
  PeopleState,
  PlanDueItem,
  PlanRoute,
  WHAT_IF_CUTS,
} from './planOverview';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** "5 Oct" */
function shortDate(iso: string): string {
  return parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** One tappable list row in Home's shared row style — icon tile, title, subtitle, optional right side. */
function PlanRow({
  icon,
  iconBg,
  title,
  sub,
  subTone,
  right,
  onPress,
  divider,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub?: string;
  subTone?: 'warn' | 'good';
  right?: React.ReactNode;
  onPress: () => void;
  divider?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      style={[h.row, divider && h.divider, animatedStyle]}
    >
      <View style={[h.iconTile, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={h.mid}>
        <Text style={h.title} numberOfLines={1}>
          {title}
        </Text>
        {!!sub && (
          <Text
            style={[h.sub, subTone === 'warn' && h.subUrgent, subTone === 'good' && styles.subGood]}
            numberOfLines={1}
          >
            {sub}
          </Text>
        )}
      </View>
      {right ?? <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />}
    </AnimatedPressable>
  );
}

const icon = (name: FeatherName, color: string = theme.colors.ink) => (
  <Feather name={name} size={HOME.iconGlyph} color={color} />
);

/** A thin 0–100% track. */
function Track({ fraction, color }: { fraction: number; color: string }) {
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.trackFill,
          { width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

/* ---------- 1 · Loans ---------- */

/** How many loan rows show before a "+N more" row. */
const LOAN_ROWS_SHOWN = 3;

export function LoansSection({ summary, onOpen }: { summary: LoansSummary; onOpen: () => void }) {
  const hasBorrowed = summary.borrowedCount > 0;
  const shown = summary.rows.slice(0, LOAN_ROWS_SHOWN);
  const more = summary.rows.length - shown.length;
  return (
    <HomeSection title="Loans" onSeeAll={summary.rows.length > 0 ? onOpen : undefined}>
      <View style={h.card}>
        {summary.rows.length === 0 ? (
          <PlanRow
            icon={icon('credit-card')}
            iconBg={theme.colors.goldTint}
            title="Track an EMI"
            sub="See what's left and when each EMI is due"
            onPress={onOpen}
          />
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.kicker}>{hasBorrowed ? 'Debt left' : 'Owed to you'}</Text>
              <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(hasBorrowed ? summary.debtLeftMinor : summary.lentLeftMinor)}
              </Text>
              {hasBorrowed && (
                <>
                  <Track fraction={summary.paidFraction} color={theme.colors.secondary} />
                  <Text style={styles.note}>
                    <Text style={styles.noteGood}>{formatRatioPct(summary.paidFraction)} paid off</Text> ·{' '}
                    {formatMoney(summary.paidOffMinor)} of {formatMoney(summary.borrowedPrincipalMinor)} ·{' '}
                    {summary.borrowedCount} loan{summary.borrowedCount === 1 ? '' : 's'}
                  </Text>
                  {summary.lentLeftMinor > 0 && (
                    <Text style={styles.note}>
                      Owed to you on loans:{' '}
                      <Text style={styles.noteMoney}>{formatMoney(summary.lentLeftMinor)}</Text>
                    </Text>
                  )}
                </>
              )}
            </View>
            {shown.map((l) => {
              const borrowed = l.direction === 'borrowed';
              const parts: string[] = [];
              if (l.nextEmiMinor != null && l.nextDueDate) {
                parts.push(
                  borrowed
                    ? `EMI ${formatMoney(l.nextEmiMinor)} · ${shortDate(l.nextDueDate)}`
                    : `${formatMoney(l.nextEmiMinor)} back on ${shortDate(l.nextDueDate)}`
                );
              } else if (!borrowed) {
                parts.push('Lent');
              }
              if (l.totalCount > 0) parts.push(`${l.paidCount} of ${l.totalCount} paid`);
              return (
                <PlanRow
                  key={l.id}
                  // Every loan row sits under the summary block, so each gets a divider.
                  divider
                  icon={icon(borrowed ? 'credit-card' : 'arrow-down-left')}
                  iconBg={borrowed ? theme.colors.goldTint : theme.colors.incomeTint}
                  title={l.name}
                  sub={parts.join(' · ')}
                  right={
                    <Text style={[h.amount, !borrowed && h.income]} numberOfLines={1}>
                      {formatMoney(l.leftMinor)}
                    </Text>
                  }
                  onPress={onOpen}
                />
              );
            })}
            {more > 0 && (
              <PlanRow
                divider
                icon={icon('more-horizontal', theme.colors.textMuted)}
                iconBg={theme.colors.surfaceAlt}
                title={`${more} more loan${more === 1 ? '' : 's'}`}
                onPress={onOpen}
              />
            )}
          </>
        )}
      </View>
    </HomeSection>
  );
}

/* ---------- 2 · Due in the next 2 weeks ---------- */

export function DueSoonCard({ dueSoon }: { dueSoon: DueSoon }) {
  const none = dueSoon.count === 0;
  return (
    <View style={[h.card, styles.dueCard]}>
      <View style={styles.dueTop}>
        <Text style={styles.kicker}>Due in the next 2 weeks</Text>
        {!none && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{dueSoon.count} due</Text>
          </View>
        )}
      </View>
      {none ? (
        <Text style={styles.note}>Nothing due before {shortDate(dueSoon.untilDate)}.</Text>
      ) : (
        <>
          <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(dueSoon.totalMinor)}
          </Text>
          <View style={styles.pills}>
            {dueSoon.emiMinor > 0 && (
              <View style={styles.pill}>
                <View style={[styles.pillDot, { backgroundColor: theme.colors.idGoldDeep }]} />
                <Text style={styles.pillText}>EMIs {formatMoney(dueSoon.emiMinor)}</Text>
              </View>
            )}
            {dueSoon.billMinor > 0 && (
              <View style={styles.pill}>
                <View style={[styles.pillDot, { backgroundColor: theme.colors.income }]} />
                <Text style={styles.pillText}>Bills {formatMoney(dueSoon.billMinor)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.note}>
            Due by {shortDate(dueSoon.untilDate)}, from your loans and recurring entries.
          </Text>
        </>
      )}
    </View>
  );
}

/* ---------- 3 · Coming up ---------- */

const COMING_UP_SHOWN = 3;
const KIND_TAG: Record<PlanDueItem['kind'], { label: string; bg: string; fg: string }> = {
  emi: { label: 'EMI', bg: theme.colors.goldTint, fg: theme.colors.idGoldDeep },
  bill: { label: 'Bill', bg: theme.colors.secondaryTint, fg: theme.colors.income },
  income: { label: 'Income', bg: theme.colors.incomeTint, fg: theme.colors.income },
  transfer: { label: 'Transfer', bg: theme.colors.primaryTint, fg: theme.colors.inkSoft },
};

export function ComingUpSection({
  items,
  onOpen,
}: {
  items: PlanDueItem[];
  onOpen: (route: PlanRoute) => void;
}) {
  const shown = items.slice(0, COMING_UP_SHOWN);
  return (
    <HomeSection title="Coming up">
      <View style={h.card}>
        {shown.length === 0 ? (
          <PlanRow
            icon={icon('repeat')}
            iconBg={theme.colors.primaryTint}
            title="Rent, salary, subscriptions"
            sub="Add a recurring entry to see it here"
            onPress={() => onOpen('/recurring')}
          />
        ) : (
          shown.map((it, i) => {
            const d = parseLocalIsoDate(it.dueDate);
            const tag = KIND_TAG[it.kind];
            const when = dueDateLabel(it.dueDate);
            const sign = it.kind === 'income' ? '+' : it.kind === 'transfer' ? '' : '−';
            return (
              <PlanRow
                key={it.key}
                divider={i > 0}
                iconBg={theme.colors.surfaceAlt}
                icon={
                  <View style={styles.date}>
                    <Text style={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</Text>
                    <Text style={styles.dateMonth}>
                      {d.toLocaleDateString(undefined, { month: 'short' })}
                    </Text>
                  </View>
                }
                title={it.title}
                sub={`${tag.label} · ${when}`}
                subTone={when.startsWith('Overdue') ? 'warn' : undefined}
                right={
                  <Text
                    style={[
                      h.amount,
                      it.kind === 'income' && h.income,
                      (it.kind === 'emi' || it.kind === 'bill') && h.expense,
                    ]}
                    numberOfLines={1}
                  >
                    {sign}
                    {formatMoney(it.amountMinor)}
                  </Text>
                }
                onPress={() => onOpen(it.route)}
              />
            );
          })
        )}
        <View style={styles.links}>
          <LinkCell label="Recurring" onPress={() => onOpen('/recurring')} />
          <LinkCell label="Loans" onPress={() => onOpen('/loans')} divider />
        </View>
      </View>
    </HomeSection>
  );
}

function LinkCell({ label, onPress, divider }: { label: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.linkCell, divider && styles.linkDivider]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/* ---------- 4 · Budgets ---------- */

function budgetColor(b: { overBudget: boolean; percentUsed: number }): string {
  if (b.overBudget) return theme.colors.expense;
  if (b.percentUsed >= BUDGET_NEAR_PCT) return theme.colors.idGoldDeep;
  return theme.colors.secondary;
}

export function BudgetsSection({ summary, onOpen }: { summary: BudgetsSummary; onOpen: () => void }) {
  const empty = summary.rows.length === 0;
  return (
    <HomeSection title="Budgets" onSeeAll={empty ? undefined : onOpen}>
      <View style={h.card}>
        {empty ? (
          <PlanRow
            icon={icon('pie-chart')}
            iconBg={theme.colors.primaryTint}
            title="Set a monthly limit"
            sub="For food, bills, anything you want to keep an eye on"
            onPress={onOpen}
          />
        ) : (
          <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="Open budgets">
            <View style={styles.budgetHead}>
              <Text style={styles.budgetLine}>
                <Text style={styles.budgetMoney}>{formatMoney(summary.usedMinor)}</Text> used of{' '}
                <Text style={styles.budgetMoney}>{formatMoney(summary.budgetedMinor)}</Text> budgeted
              </Text>
              {summary.overCount > 0 && <Text style={styles.overText}>{summary.overCount} over</Text>}
            </View>
            <View style={styles.split}>
              {summary.rows.map((b, i) =>
                summary.shares[i] > 0 ? (
                  <View
                    key={b.id}
                    style={{ flex: summary.shares[i], backgroundColor: budgetColor(b), height: '100%' }}
                  />
                ) : null
              )}
            </View>
            {summary.rows.map((b) => (
              <View key={b.id} style={styles.bRow}>
                <Text style={styles.bName} numberOfLines={1}>
                  {b.categoryName}
                </Text>
                <View style={styles.bTrack}>
                  <Track fraction={b.percentUsed / 100} color={budgetColor(b)} />
                </View>
                <Text style={[styles.bLeft, b.overBudget && styles.bOver]} numberOfLines={1}>
                  {b.overBudget
                    ? `${formatMoney(-b.remainingMinor)} over`
                    : `${formatMoney(b.remainingMinor)} left`}
                </Text>
              </View>
            ))}
          </Pressable>
        )}
      </View>
    </HomeSection>
  );
}

/* ---------- 5 · Friends & Family ---------- */

export function PeopleSection({ state, onOpen }: { state: PeopleState; onOpen: () => void }) {
  let title: string;
  let sub: string;
  let right: React.ReactNode = undefined;
  if (state.kind === 'none') {
    title = 'Track money with friends';
    sub = 'Who paid for what, and who owes whom';
  } else if (state.kind === 'settled') {
    title = 'All settled up';
    sub = `With ${state.count} ${state.count === 1 ? 'person' : 'people'}`;
  } else if (state.owedToYouMinor > 0 && state.youOweMinor > 0) {
    title = `${formatMoney(state.owedToYouMinor)} owed to you`;
    sub = `You owe ${formatMoney(state.youOweMinor)}`;
  } else if (state.owedToYouMinor > 0) {
    title = 'Owed to you';
    sub = `Across ${state.count} ${state.count === 1 ? 'person' : 'people'}`;
    right = <Text style={[h.amount, h.income]}>+{formatMoney(state.owedToYouMinor)}</Text>;
  } else {
    title = 'You owe';
    sub = `Across ${state.count} ${state.count === 1 ? 'person' : 'people'}`;
    right = <Text style={[h.amount, h.expense]}>−{formatMoney(state.youOweMinor)}</Text>;
  }
  return (
    <HomeSection title="Friends & Family" onSeeAll={state.kind === 'none' ? undefined : onOpen}>
      <View style={h.card}>
        <PlanRow
          icon={icon('users')}
          iconBg={theme.colors.idCoral}
          title={title}
          sub={sub}
          right={right}
          onPress={onOpen}
        />
      </View>
    </HomeSection>
  );
}

/* ---------- 6 · Saving toward ---------- */

export function SavingSection({
  goals,
  whatIf,
  onOpenGoals,
  onOpenWhatIf,
}: {
  goals: SavingsGoal[];
  /** The biggest spending category's recent monthly average, or null with too little spending to project from. */
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  onOpenGoals: () => void;
  onOpenWhatIf: () => void;
}) {
  const [cut, setCut] = useState<number>(10);
  const active = goals.filter((g) => !g.archived);
  return (
    <HomeSection title="Saving toward" onSeeAll={active.length > 0 ? onOpenGoals : undefined}>
      <View style={h.card}>
        {active.length === 0 ? (
          <PlanRow
            icon={icon('flag')}
            iconBg={theme.colors.secondaryTint}
            title="Start a goal"
            sub="A trip, a fund, a gadget. Track it here."
            onPress={onOpenGoals}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goals}>
            {active.map((g) => (
              <GoalChip key={g.id} goal={g} onPress={onOpenGoals} />
            ))}
          </ScrollView>
        )}
        <Pressable
          onPress={onOpenWhatIf}
          style={styles.whatIf}
          accessibilityRole="button"
          accessibilityLabel="Open the what-if sandbox"
        >
          <View style={[h.iconTile, { backgroundColor: theme.colors.glass }]}>{icon('zap')}</View>
          <View style={h.mid}>
            {whatIf ? (
              <>
                <Text style={styles.whatIfText}>
                  What if you spent <Text style={styles.whatIfBold}>{cut}%</Text> less on{' '}
                  {whatIf.categoryName}? About{' '}
                  <Text style={styles.whatIfBold}>
                    {formatMoney(projectedMonthlySpend(whatIf.avgMonthlyMinor, cut).extraMinor)}
                  </Text>{' '}
                  more a month.
                </Text>
                <View style={styles.cuts}>
                  {WHAT_IF_CUTS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => {
                        haptics.tap();
                        setCut(c);
                      }}
                      hitSlop={6}
                      style={[styles.cut, cut === c && styles.cutActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: cut === c }}
                      accessibilityLabel={`Cut by ${c}%`}
                    >
                      <Text style={[styles.cutText, cut === c && styles.cutTextActive]}>{c}%</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={h.title}>What-if</Text>
                <Text style={h.sub}>Try a spending cut once you've logged a few expenses</Text>
              </>
            )}
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    </HomeSection>
  );
}

/* ---------- 7 · Daily habit ---------- */

export function HabitSection({
  habit,
  goalMinor,
  onOpen,
}: {
  /** Null when no daily spending goal is set. */
  habit: HabitState | null;
  goalMinor: number | null;
  onOpen: () => void;
}) {
  return (
    <HomeSection title="Daily habit" onSeeAll={habit ? onOpen : undefined}>
      <View style={h.card}>
        {!habit || goalMinor == null ? (
          <PlanRow
            icon={<MaterialCommunityIcons name="sprout" size={HOME.iconGlyph} color={theme.colors.ink} />}
            iconBg={theme.colors.flatPink + '66'}
            title="Set a daily goal"
            sub="Every day you keep to it plants something in Suu's Garden"
            onPress={onOpen}
          />
        ) : (
          <Pressable
            onPress={onOpen}
            style={styles.habit}
            accessibilityRole="button"
            accessibilityLabel={`${habit.streakDays}-day streak under ${formatMoney(goalMinor)} a day. Open Suu's Garden`}
          >
            <View style={styles.sprouts}>
              {habit.days.map((kept, i) => (
                <View key={i} style={styles.sprout}>
                  <MaterialCommunityIcons
                    name="sprout"
                    size={20}
                    color={kept ? theme.colors.income : theme.colors.textMuted}
                    style={!kept && styles.sproutMissed}
                  />
                </View>
              ))}
            </View>
            <View style={h.mid}>
              <Text style={styles.streak}>{habit.streakDays}-day streak</Text>
              <Text style={h.sub}>Under {formatMoney(goalMinor)} a day</Text>
            </View>
          </Pressable>
        )}
      </View>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  subGood: { fontFamily: theme.font.bodyBold, color: theme.colors.income },
  kicker: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  big: { fontFamily: theme.font.monoBold, fontSize: 26, color: theme.colors.textPrimary },
  note: { fontFamily: theme.font.body, fontSize: 12.5, lineHeight: 17, color: theme.colors.textSecondary },
  noteGood: { fontFamily: theme.font.bodyBold, color: theme.colors.income },
  noteMoney: { fontFamily: theme.font.monoBold, color: theme.colors.income },
  summary: { padding: 14, gap: 6 },
  track: {
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: theme.radius.pill },

  dueCard: { marginTop: 14, padding: 14, gap: 8 },
  dueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },

  date: { alignItems: 'center' },
  dateDay: { fontFamily: theme.font.monoBold, fontSize: 14, lineHeight: 16, color: theme.colors.textPrimary },
  dateMonth: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  links: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  linkCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  linkDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },

  budgetHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  budgetLine: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  budgetMoney: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  overText: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.expense },
  split: {
    flexDirection: 'row',
    height: 8,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 10,
  },
  bRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  bName: { flex: 1, fontFamily: theme.font.body, fontSize: 13.5, color: theme.colors.textPrimary },
  bTrack: { width: 84 },
  bLeft: {
    minWidth: 86,
    textAlign: 'right',
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  bOver: { fontFamily: theme.font.monoBold, color: theme.colors.expense },

  goals: { gap: 10, padding: 14 },
  whatIf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 12,
    marginTop: 0,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentTint,
  },
  whatIfText: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 18, color: theme.colors.textPrimary },
  whatIfBold: { fontFamily: theme.font.monoBold },
  cuts: { flexDirection: 'row', gap: 6, marginTop: 8 },
  cut: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cutActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  cutText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textPrimary },
  cutTextActive: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },

  habit: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  sprouts: { flexDirection: 'row', gap: 6 },
  sprout: {
    width: 30,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  sproutMissed: { opacity: 0.35 },
  streak: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
});
