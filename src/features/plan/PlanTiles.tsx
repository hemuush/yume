import { useState } from 'react';
import { View, Pressable, ScrollView, Animated, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { GrowFill } from '@/components/GrowFill';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { formatRatioPct } from '@/lib/format';
import { dueDateLabel } from '@/lib/dueDate';
import { projectedMonthlySpend } from '@/lib/whatIf';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { Account, SavingsGoal } from '@/types';
import { homeStyles as h } from '@/features/home/homeStyles';
import { GoalChip } from '@/features/goals/GoalChip';
import {
  BudgetsSummary,
  DueDay,
  DueGroup,
  DueSoon,
  HabitState,
  LoansSummary,
  PeopleState,
  WHAT_IF_CUTS,
} from './planOverview';
import { dayMonth, weekdayDayMonth, longMonthYear, shortMonthYear } from '@/lib/dateLabels';

import { styles, STRIP_BAR_AREA } from './plan.styles';
import { withPressed } from '@/lib/pressed';

/**
 * The Plan tab as a bento (the Plan sign-off, direction A): a grid of
 * tiles, one per topic, so the whole picture fits the first screen, then
 * Coming up as the full list. Each tile opens its own screen. Colours carry
 * meaning, from the app's pale identity tones: coral for EMIs and debt,
 * red when a budget is over, teal for money coming back, sage for the
 * habit, sky for saving.
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type FeatherName = React.ComponentProps<typeof Feather>['name'];

/* ---------- Tile ---------- */

function Tile({
  tone,
  wide,
  onPress,
  label,
  children,
  style,
}: {
  tone: string;
  wide?: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.tile,
        wide ? styles.tileWide : styles.tileHalf,
        { backgroundColor: tone },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

function Kicker({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.kickerRow}>
      {icon}
      <Text style={styles.kicker} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}
const kIcon = (name: FeatherName) => <Feather name={name} size={12} color={theme.colors.textMuted} />;

/** Tiles stacked 8px apart, between a section's title and the next. */
export function TileGroup({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <View style={[styles.group, first && styles.groupFirst]}>{children}</View>;
}

/** Two tiles side by side. */
export function TileRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.tileRow}>{children}</View>;
}

/* ---------- Next 14 days ---------- */

/** The tallest bar leaves room above it; a day with nothing due is a short stub. */
const STRIP_BAR_MIN = 10;
const STRIP_BAR_SPAN = STRIP_BAR_AREA - STRIP_BAR_MIN - 4;
const STRIP_STUB = 4;

export function DueTile({
  dueSoon,
  days,
  next,
  onPress,
  onJumpToDay,
}: {
  dueSoon: DueSoon;
  days: DueDay[];
  /** The first day with something due, if any. */
  next: DueGroup | null;
  onPress: () => void;
  /** Scrolls Coming up to a day's group. */
  onJumpToDay: (date: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const none = dueSoon.count === 0;
  const maxMinor = Math.max(0, ...days.map((d) => d.amountMinor));
  const picked = days.find((d) => d.date === selected && (d.emi || d.bill)) ?? null;
  return (
    <Tile
      tone={theme.colors.surface}
      wide
      onPress={onPress}
      label={
        none
          ? 'Nothing due in the next 14 days. Open Coming up'
          : `${formatMoney(dueSoon.totalMinor)} due in the next 14 days. Open Coming up`
      }
    >
      <Kicker icon={kIcon('calendar')}>
        Next 14 days{none ? '' : ` · ${dueSoon.count} payment${dueSoon.count === 1 ? '' : 's'}`}
      </Kicker>
      {none ? (
        <Text style={styles.tileTitle}>Nothing due</Text>
      ) : (
        <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(dueSoon.totalMinor)}
        </Text>
      )}
      <View style={styles.strip}>
        {days.map((d, i) => {
          const live = d.emi || d.bill;
          const isSelected = picked?.date === d.date;
          const height = live
            ? STRIP_BAR_MIN + (maxMinor > 0 ? Math.round((d.amountMinor / maxMinor) * STRIP_BAR_SPAN) : 0)
            : STRIP_STUB;
          const cell = (
            <>
              <View style={styles.stripBarArea}>
                <View
                  style={[styles.stripBar, { height }, d.bill && styles.stripBill, d.emi && styles.stripEmi]}
                />
              </View>
              <Text
                style={[
                  styles.stripNum,
                  (live || i === 0) && styles.stripNumOn,
                  isSelected && styles.stripNumSelected,
                ]}
              >
                {Number(d.date.slice(8))}
              </Text>
            </>
          );
          return live ? (
            <Pressable
              key={d.date}
              onPress={() => {
                haptics.tap();
                setSelected(isSelected ? null : d.date);
              }}
              style={withPressed(styles.stripDay)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${weekdayDayMonth(d.date)}, ${formatMoney(d.amountMinor)} due. ${
                isSelected ? 'Hide details' : 'Show details'
              }`}
            >
              {cell}
            </Pressable>
          ) : (
            <View
              key={d.date}
              style={styles.stripDay}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {cell}
            </View>
          );
        })}
      </View>
      {picked ? (
        <>
          <Text style={styles.stripCaption} numberOfLines={2}>
            <Text style={styles.stripCaptionBold}>{weekdayDayMonth(picked.date)}</Text> ·{' '}
            {formatMoney(picked.amountMinor)} · {picked.titles.join(', ')}
          </Text>
          <Pressable
            onPress={() => onJumpToDay(picked.date)}
            hitSlop={8}
            style={withPressed(styles.stripJump)}
            accessibilityRole="button"
            accessibilityLabel={`See ${weekdayDayMonth(picked.date)} in the list`}
          >
            <Text style={styles.stripJumpText}>See in list</Text>
            <Feather name="arrow-down" size={13} color={theme.colors.textPrimary} />
          </Pressable>
        </>
      ) : (
        next &&
        next.outMinor > 0 && (
          <Text style={styles.stripCaption} numberOfLines={2}>
            Next: {describeGroup(next)} on {weekdayDayMonth(next.date)} ({formatMoney(next.outMinor)}),{' '}
            {dueDateLabel(next.date).replace('Due ', '').toLowerCase()}
          </Text>
        )
      )}
    </Tile>
  );
}

/** "3 bills", "2 EMIs", "1 EMI and 2 bills". */
function describeGroup(g: DueGroup): string {
  const emis = g.items.filter((i) => i.kind === 'emi').length;
  const bills = g.items.filter((i) => i.kind === 'bill').length;
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  if (emis && bills) return `${part(emis, 'EMI')} and ${part(bills, 'bill')}`;
  return emis ? part(emis, 'EMI') : part(bills, 'bill');
}

/* ---------- EMIs ---------- */

export function EmiTile({
  dueSoon,
  groups,
  loans,
  onOpen,
}: {
  dueSoon: DueSoon;
  groups: DueGroup[];
  loans: LoansSummary;
  onOpen: () => void;
}) {
  if (loans.borrowedCount === 0) {
    return (
      <Tile tone={theme.colors.goldTint} onPress={onOpen} label="Track an EMI. Open loans">
        <Kicker icon={kIcon('credit-card')}>Loans</Kicker>
        <Text style={styles.tileTitle}>Track an EMI</Text>
        <Text style={styles.tileSub}>A home or car loan, and what's left</Text>
      </Tile>
    );
  }
  const firstEmi = groups.find((g) => g.items.some((i) => i.kind === 'emi'));
  const inWindow = dueSoon.emiMinor > 0;
  const nextEmi = loans.rows.find((r) => r.direction === 'borrowed' && r.nextDueDate);
  return (
    <Tile
      tone={theme.colors.idCoral}
      onPress={onOpen}
      label={`EMIs ${inWindow ? formatMoney(dueSoon.emiMinor) : ''}. Open loans`}
    >
      <Kicker icon={kIcon('credit-card')}>EMIs</Kicker>
      {inWindow ? (
        <>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(dueSoon.emiMinor)} <Text style={styles.valueNote}>due</Text>
          </Text>
          <Text style={styles.tileSub} numberOfLines={2}>
            {firstEmi
              ? `${weekdayDayMonth(firstEmi.date)}, ${dueDateLabel(firstEmi.date)
                  .replace('Due ', '')
                  .toLowerCase()} · `
              : ''}
            {loans.borrowedCount} loan{loans.borrowedCount === 1 ? '' : 's'}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {nextEmi?.nextEmiMinor != null ? formatMoney(nextEmi.nextEmiMinor) : '—'}
          </Text>
          <Text style={styles.tileSub} numberOfLines={2}>
            {nextEmi?.nextDueDate ? `Next on ${dayMonth(nextEmi.nextDueDate)}` : 'None due soon'}
          </Text>
        </>
      )}
    </Tile>
  );
}

/* ---------- Budgets ---------- */

const RING = 44;
const RING_STROKE = 5;

export function BudgetTile({ summary, onOpen }: { summary: BudgetsSummary; onOpen: () => void }) {
  if (summary.rows.length === 0) {
    return (
      <Tile tone={theme.colors.surface} onPress={onOpen} label="Set a monthly limit. Open budgets">
        <Kicker icon={kIcon('pie-chart')}>Budgets</Kicker>
        <Text style={styles.tileTitle}>Set a limit</Text>
        <Text style={styles.tileSub}>For food, bills, anything you watch</Text>
      </Tile>
    );
  }
  const over = summary.overCount > 0;
  const worst = summary.rows.find((b) => b.overBudget) ?? summary.rows[0];
  const fraction = summary.budgetedMinor > 0 ? Math.min(1, summary.usedMinor / summary.budgetedMinor) : 0;
  const r = (RING - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <Tile
      tone={over ? theme.colors.expenseTint : theme.colors.idSage}
      onPress={onOpen}
      label={`Budgets, ${over ? `${summary.overCount} over` : 'all within their limits'}. Open budgets`}
    >
      <View style={styles.ring}>
        <Svg width={RING} height={RING}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={theme.colors.inkHairline}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={over ? theme.colors.expense : theme.colors.secondary}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
      </View>
      <Kicker icon={kIcon('pie-chart')}>Budgets</Kicker>
      <Text style={[styles.value, over && styles.overValue]} numberOfLines={1}>
        {over ? `${summary.overCount} over` : 'On track'}
      </Text>
      <Text style={styles.tileSub} numberOfLines={2}>
        {worst.categoryName}
        {worst.overBudget
          ? ` is ${formatMoney(-worst.remainingMinor)} over`
          : ` has ${formatMoney(worst.remainingMinor)} left`}
      </Text>
    </Tile>
  );
}

/* ---------- Debt-free ---------- */

const LOAN_BARS_SHOWN = 3;

export function DebtTile({ loans, onOpen }: { loans: LoansSummary; onOpen: () => void }) {
  const borrowed = loans.rows.filter((r) => r.direction === 'borrowed');
  if (borrowed.length === 0) return null;
  const shown = borrowed.slice(0, LOAN_BARS_SHOWN);
  const more = borrowed.length - shown.length;
  return (
    <Tile
      tone={theme.colors.surface}
      wide
      onPress={onOpen}
      label={`${formatMoney(loans.debtLeftMinor)} of debt left${
        loans.debtFreeDate ? `, debt-free in ${longMonthYear(loans.debtFreeDate)}` : ''
      }. Open loans`}
    >
      <Kicker icon={kIcon('flag')}>
        {loans.debtFreeDate ? `Debt-free by ${longMonthYear(loans.debtFreeDate)}` : 'Debt left'}
      </Kicker>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(loans.debtLeftMinor)}{' '}
        <Text style={styles.valueNote}>left · {formatRatioPct(loans.paidFraction)} paid</Text>
      </Text>
      <View style={styles.bars}>
        {shown.map((l) => (
          <View key={l.id} style={styles.barRow}>
            <View style={styles.barTop}>
              <Text style={styles.barName} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={styles.barEnd}>
                {l.endDate ? shortMonthYear(l.endDate) : `${l.paidCount} of ${l.totalCount} paid`}
              </Text>
            </View>
            <View style={styles.track}>
              <GrowFill
                animKey={`plan-loan:${l.id}`}
                pct={l.totalCount > 0 ? Math.max(2, (l.paidCount / l.totalCount) * 100) : 0}
                style={styles.trackFill}
              />
            </View>
          </View>
        ))}
      </View>
      {(more > 0 || loans.lentLeftMinor > 0) && (
        <Text style={styles.tileSub}>
          {more > 0 ? `+${more} more loan${more === 1 ? '' : 's'}` : ''}
          {more > 0 && loans.lentLeftMinor > 0 ? ' · ' : ''}
          {loans.lentLeftMinor > 0 ? `${formatMoney(loans.lentLeftMinor)} you lent out` : ''}
        </Text>
      )}
    </Tile>
  );
}

/* ---------- Friends & Family ---------- */

export function PeopleTile({ state, onOpen }: { state: PeopleState; onOpen: () => void }) {
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
  let value: React.ReactNode;
  let sub: string;
  let tone: string = theme.colors.idTeal;
  if (state.kind === 'none') {
    value = <Text style={styles.tileTitle}>Track IOUs</Text>;
    sub = 'Who paid, who owes';
    tone = theme.colors.surface;
  } else if (state.kind === 'settled') {
    value = <Text style={styles.tileTitle}>All settled</Text>;
    sub = `With ${people(state.count)}`;
  } else if (state.owedToYouMinor >= state.youOweMinor) {
    value = (
      <Text style={[styles.value, styles.incomeValue]} numberOfLines={1} adjustsFontSizeToFit>
        +{formatMoney(state.owedToYouMinor)}
      </Text>
    );
    sub =
      state.youOweMinor > 0
        ? `to collect · you owe ${formatMoney(state.youOweMinor)}`
        : `to collect from ${people(state.count)}`;
  } else {
    tone = theme.colors.idCoral;
    value = (
      <Text style={[styles.value, styles.overValue]} numberOfLines={1} adjustsFontSizeToFit>
        −{formatMoney(state.youOweMinor)}
      </Text>
    );
    sub =
      state.owedToYouMinor > 0
        ? `to pay back · ${formatMoney(state.owedToYouMinor)} to collect`
        : `to pay back to ${people(state.count)}`;
  }
  return (
    <Tile tone={tone} onPress={onOpen} label={`Friends & Family, ${sub}. Open Friends & Family`}>
      <Kicker icon={kIcon('users')}>Friends</Kicker>
      {value}
      <Text style={styles.tileSub} numberOfLines={2}>
        {sub}
      </Text>
    </Tile>
  );
}

/* ---------- Daily habit ---------- */

export function HabitTile({
  habit,
  goalMinor,
  onOpen,
}: {
  /** Null when no daily spending goal is set. */
  habit: HabitState | null;
  goalMinor: number | null;
  onOpen: () => void;
}) {
  const sprout = <MaterialCommunityIcons name="sprout" size={12} color={theme.colors.textMuted} />;
  if (!habit || goalMinor == null) {
    return (
      <Tile tone={theme.colors.surface} onPress={onOpen} label="Set a daily goal. Open Suu's Garden">
        <Kicker icon={sprout}>Spend streak</Kicker>
        <Text style={styles.tileTitle}>Set a daily goal</Text>
        <Text style={styles.tileSub}>Grow Suu's Garden</Text>
      </Tile>
    );
  }
  return (
    <Tile
      tone={theme.colors.idSage}
      onPress={onOpen}
      label={`${habit.streakDays}-day streak under ${formatMoney(goalMinor)} a day. Open Suu's Garden`}
    >
      <Kicker icon={sprout}>Spend streak</Kicker>
      <Text style={styles.value}>
        {habit.streakDays} day{habit.streakDays === 1 ? '' : 's'}
      </Text>
      <View style={styles.sprouts}>
        {habit.days.map((kept, i) => (
          <MaterialCommunityIcons
            key={i}
            name="sprout"
            size={15}
            color={kept ? theme.colors.income : theme.colors.textMuted}
            style={!kept && styles.sproutMissed}
          />
        ))}
      </View>
      <Text style={styles.tileSub} numberOfLines={1}>
        under {formatMoney(goalMinor)} a day
      </Text>
    </Tile>
  );
}

/* ---------- Saving toward ---------- */

export function SavingTile({
  goals,
  savingsAccounts,
  whatIf,
  onOpenGoals,
  onOpenWhatIf,
}: {
  goals: SavingsGoal[];
  /** Savings accounts a new goal could follow (Wave 3), with their balances. */
  savingsAccounts: Account[];
  /** The biggest spending category's recent monthly average, or null with too little spending to project from. */
  whatIf: { categoryName: string; avgMonthlyMinor: number } | null;
  onOpenGoals: () => void;
  onOpenWhatIf: () => void;
}) {
  const [cut, setCut] = useState<number>(10);
  const { hideAmounts } = usePrivacy();
  const active = goals.filter((g) => !g.archived);
  return (
    <View style={[styles.tile, styles.tileWide, styles.savingTile]}>
      <Pressable
        style={withPressed()}
        onPress={onOpenGoals}
        accessibilityRole="button"
        accessibilityLabel="Open savings goals"
      >
        <Kicker icon={kIcon('flag')}>Saving toward</Kicker>
        {active.length === 0 ? (
          <>
            <Text style={styles.tileTitle}>Start a goal that fills up by itself</Text>
            <Text style={styles.tileSub}>
              {savingsAccounts.length > 0
                ? `Follow ${savingsAccounts
                    .slice(0, 2)
                    .map(
                      (a) =>
                        `${a.name} (${formatMaskableMoney(a.currentBalanceMinor, { masked: hideAmounts })})`
                    )
                    .join(' or ')}, or add money yourself`
                : 'A trip, a fund, a gadget. Track it here.'}
            </Text>
          </>
        ) : null}
      </Pressable>
      {active.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goals}>
          {active.map((g) => (
            <GoalChip key={g.id} goal={g} onPress={onOpenGoals} />
          ))}
        </ScrollView>
      )}
      <Pressable
        onPress={onOpenWhatIf}
        style={withPressed(styles.whatIf)}
        accessibilityRole="button"
        accessibilityLabel="Open the what-if sandbox"
      >
        <View style={styles.whatIfIcon}>
          <Feather name="zap" size={14} color={theme.colors.ink} />
        </View>
        <View style={h.mid}>
          {whatIf ? (
            <>
              <Text style={styles.whatIfText}>
                What if you spent <Text style={styles.whatIfBold}>{cut}%</Text> less on {whatIf.categoryName}?
                About{' '}
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
                    style={withPressed([styles.cut, cut === c && styles.cutActive])}
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
            <Text style={styles.whatIfText}>
              What-if: try a spending cut once you've logged a few expenses
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}
