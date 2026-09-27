import { useState } from 'react';
import { View, Pressable, ScrollView, Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { dueDateLabel } from '@/lib/dueDate';
import { parseLocalIsoDate } from '@/lib/date';
import { projectedMonthlySpend } from '@/lib/whatIf';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { Account, SavingsGoal } from '@/types';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h, HOME } from '@/features/home/homeStyles';
import { GoalChip } from '@/features/goals/GoalChip';
import {
  BudgetsSummary,
  DueDay,
  DueGroup,
  DueSoon,
  HabitState,
  LoansSummary,
  PeopleState,
  PlanDueItem,
  PlanRoute,
  WHAT_IF_CUTS,
} from './planOverview';

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

/** "5 Oct" */
const shortDate = (iso: string) =>
  parseLocalIsoDate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
/** "Thu 1 Oct" */
const dayDate = (iso: string) =>
  parseLocalIsoDate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
/** "January 2045" */
const monthYear = (iso: string) =>
  parseLocalIsoDate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
/** "Jan 2045" */
const shortMonthYear = (iso: string) =>
  parseLocalIsoDate(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/** "5 & 7 Oct", or "30 Sep & 5 Oct" across months. */
export function joinDays(dates: string[]): string {
  if (dates.length === 0) return '';
  const sameMonth = dates.every((d) => d.slice(0, 7) === dates[0].slice(0, 7));
  const parts = sameMonth
    ? [...dates.slice(0, -1).map((d) => String(Number(d.slice(8)))), shortDate(dates[dates.length - 1])]
    : dates.map(shortDate);
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}

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

/** Two tiles side by side. */
export function TileRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.tileRow}>{children}</View>;
}

/* ---------- Next 14 days ---------- */

export function DueTile({
  dueSoon,
  days,
  next,
  onPress,
}: {
  dueSoon: DueSoon;
  days: DueDay[];
  /** The first day with something due, if any. */
  next: DueGroup | null;
  onPress: () => void;
}) {
  const none = dueSoon.count === 0;
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
      {next && next.outMinor > 0 && (
        <Text style={styles.tileSub} numberOfLines={2}>
          Next: {describeGroup(next)} on {dayDate(next.date)} ({formatMoney(next.outMinor)}),{' '}
          {dueDateLabel(next.date).replace('Due ', '').toLowerCase()}
        </Text>
      )}
      <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {days.map((d, i) => (
          <View
            key={d.date}
            style={[
              styles.stripDay,
              d.bill && styles.stripBill,
              d.emi && styles.stripEmi,
              i === 0 && styles.stripToday,
            ]}
          >
            <Text style={[styles.stripText, (d.emi || d.bill || i === 0) && styles.stripTextOn]}>
              {Number(d.date.slice(8))}
            </Text>
          </View>
        ))}
      </View>
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
  const emiDates = groups.filter((g) => g.items.some((i) => i.kind === 'emi')).map((g) => g.date);
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
            {formatMoney(dueSoon.emiMinor)}
          </Text>
          <Text style={styles.tileSub} numberOfLines={2}>
            {joinDays(emiDates)} · {loans.borrowedCount} loan{loans.borrowedCount === 1 ? '' : 's'}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {nextEmi?.nextEmiMinor != null ? formatMoney(nextEmi.nextEmiMinor) : '—'}
          </Text>
          <Text style={styles.tileSub} numberOfLines={2}>
            {nextEmi?.nextDueDate ? `Next on ${shortDate(nextEmi.nextDueDate)}` : 'None due soon'}
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
        {'\n'}
        {worst.overBudget
          ? `${formatMoney(-worst.remainingMinor)} over`
          : `${formatMoney(worst.remainingMinor)} left`}
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
        loans.debtFreeDate ? `, debt-free in ${monthYear(loans.debtFreeDate)}` : ''
      }. Open loans`}
    >
      <Kicker icon={kIcon('flag')}>
        {loans.debtFreeDate ? `Debt-free · ${monthYear(loans.debtFreeDate)}` : 'Debt left'}
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
              <View
                style={[
                  styles.trackFill,
                  { width: `${l.totalCount > 0 ? Math.max(2, (l.paidCount / l.totalCount) * 100) : 0}%` },
                ]}
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
        ? `owed to you · you owe ${formatMoney(state.youOweMinor)}`
        : `owed to you · ${people(state.count)}`;
  } else {
    tone = theme.colors.idCoral;
    value = (
      <Text style={[styles.value, styles.overValue]} numberOfLines={1} adjustsFontSizeToFit>
        −{formatMoney(state.youOweMinor)}
      </Text>
    );
    sub =
      state.owedToYouMinor > 0
        ? `you owe · ${formatMoney(state.owedToYouMinor)} owed to you`
        : `you owe · ${people(state.count)}`;
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
        <Kicker icon={sprout}>Habit</Kicker>
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
      <Kicker icon={sprout}>Habit</Kicker>
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
  const active = goals.filter((g) => !g.archived);
  return (
    <View style={[styles.tile, styles.tileWide, styles.savingTile]}>
      <Pressable onPress={onOpenGoals} accessibilityRole="button" accessibilityLabel="Open savings goals">
        <Kicker icon={kIcon('flag')}>Saving toward</Kicker>
        {active.length === 0 ? (
          <>
            <Text style={styles.tileTitle}>Start a goal that fills up by itself</Text>
            <Text style={styles.tileSub}>
              {savingsAccounts.length > 0
                ? `Follow ${savingsAccounts
                    .slice(0, 2)
                    .map((a) => `${a.name} (${formatMoney(a.currentBalanceMinor)})`)
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
        style={styles.whatIf}
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

/* ---------- Coming up ---------- */

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

const KIND_LABEL: Record<PlanDueItem['kind'], string> = {
  emi: 'EMI',
  bill: 'Bill',
  income: 'Income',
  transfer: 'Transfer',
};

function DueRow({
  item,
  divider,
  onOpen,
  onPay,
}: {
  item: PlanDueItem;
  divider: boolean;
  onOpen: (route: PlanRoute) => void;
  onPay?: (loanId: string) => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const d = parseLocalIsoDate(item.dueDate);
  const when = dueDateLabel(item.dueDate);
  const sign = item.kind === 'income' ? '+' : item.kind === 'transfer' ? '' : '−';
  const amount = (
    <Text
      style={[
        h.amount,
        item.kind === 'income' && h.income,
        (item.kind === 'emi' || item.kind === 'bill') && h.expense,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {sign}
      {formatMoney(item.amountMinor)}
    </Text>
  );
  return (
    <AnimatedPressable
      onPress={() => onOpen(item.route)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${KIND_LABEL[item.kind]}, ${when}`}
      style={[h.row, divider && h.divider, animatedStyle]}
    >
      <View style={[h.iconTile, styles.date]}>
        <Text style={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</Text>
        <Text style={styles.dateMonth}>{d.toLocaleDateString(undefined, { month: 'short' })}</Text>
      </View>
      <View style={h.mid}>
        <Text style={h.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[h.sub, when.startsWith('Overdue') && h.subUrgent]} numberOfLines={1}>
          {KIND_LABEL[item.kind]} · {when}
        </Text>
      </View>
      {item.loanId && onPay ? (
        <View style={styles.payWrap}>
          {amount}
          <Pressable
            onPress={() => onPay(item.loanId!)}
            hitSlop={8}
            style={styles.payBtn}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.title} EMI paid`}
          >
            <Text style={styles.payBtnText}>Paid</Text>
          </Pressable>
        </View>
      ) : (
        amount
      )}
    </AnimatedPressable>
  );
}

/**
 * Everything due in the next 14 days, grouped under its date with the day's
 * total going out — not just the first few. EMIs keep their Paid button.
 */
export function ComingUpSection({
  groups,
  onOpen,
  onPay,
}: {
  groups: DueGroup[];
  onOpen: (route: PlanRoute) => void;
  /** Records an EMI as paid — shown as a Paid button on each EMI row. */
  onPay?: (loanId: string) => void;
}) {
  return (
    <HomeSection title="Coming up">
      <View style={h.card}>
        {groups.length === 0 ? (
          <Pressable
            onPress={() => onOpen('/recurring')}
            style={h.row}
            accessibilityRole="button"
            accessibilityLabel="Add a recurring entry"
          >
            <View style={[h.iconTile, { backgroundColor: theme.colors.primaryTint }]}>
              <Feather name="repeat" size={HOME.iconGlyph} color={theme.colors.ink} />
            </View>
            <View style={h.mid}>
              <Text style={h.title}>Rent, salary, subscriptions</Text>
              <Text style={h.sub}>Add a recurring entry to see it here</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>
        ) : (
          groups.map((g, gi) => (
            <View key={g.date}>
              <View style={[styles.dayHead, gi > 0 && h.divider]}>
                <Text style={styles.dayHeadText}>{dayDate(g.date)}</Text>
                {g.outMinor > 0 && <Text style={styles.dayHeadAmount}>{formatMoney(g.outMinor)}</Text>}
              </View>
              {g.items.map((it) => (
                <DueRow key={it.key} item={it} divider onOpen={onOpen} onPay={onPay} />
              ))}
            </View>
          ))
        )}
        <View style={styles.links}>
          <LinkCell label="Recurring" onPress={() => onOpen('/recurring')} />
          <LinkCell label="Loans" onPress={() => onOpen('/loans')} divider />
        </View>
      </View>
    </HomeSection>
  );
}

const TILE_GAP = 8;

const styles = StyleSheet.create({
  tileRow: { flexDirection: 'row', gap: TILE_GAP, marginHorizontal: HOME.gutter, marginTop: TILE_GAP },
  tile: {
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 14,
    gap: 4,
    overflow: 'hidden',
  },
  tileWide: { marginHorizontal: HOME.gutter, marginTop: TILE_GAP },
  tileHalf: { flex: 1, minHeight: 116 },
  savingTile: { backgroundColor: theme.colors.primaryTint, gap: 10 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  kicker: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  bigValue: { fontFamily: theme.font.monoBold, fontSize: 26, color: theme.colors.textPrimary },
  value: { fontFamily: theme.font.monoBold, fontSize: 19, color: theme.colors.textPrimary },
  valueNote: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  overValue: { color: theme.colors.expense },
  incomeValue: { color: theme.colors.income },
  tileTitle: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  tileSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary },

  strip: { flexDirection: 'row', gap: 3, marginTop: 8 },
  stripDay: {
    flex: 1,
    height: 26,
    borderRadius: 7,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    overflow: 'hidden',
  },
  stripBill: {
    backgroundColor: theme.colors.idGold,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.idGoldDeep,
  },
  stripEmi: {
    backgroundColor: theme.colors.idCoral,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.idCoralDeep,
  },
  stripToday: { borderWidth: 1.5, borderColor: theme.colors.ink },
  stripText: { fontFamily: theme.font.mono, fontSize: 8.5, color: theme.colors.textMuted },
  stripTextOn: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },

  ring: { position: 'absolute', right: 12, top: 12 },

  bars: { gap: 7, marginTop: 6 },
  barRow: { gap: 3 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barName: { flex: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textPrimary },
  barEnd: { fontFamily: theme.font.monoBold, fontSize: 11, color: theme.colors.textSecondary },
  track: {
    height: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkWash,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: theme.radius.pill, backgroundColor: theme.colors.secondary },

  sprouts: { flexDirection: 'row', gap: 2 },
  sproutMissed: { opacity: 0.45 },

  goals: { gap: 8 },
  whatIf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  whatIfIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: theme.colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatIfText: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textPrimary,
  },
  whatIfBold: { fontFamily: theme.font.bodyBold },
  cuts: { flexDirection: 'row', gap: 6, marginTop: 8 },
  cut: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cutActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  cutText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textPrimary },
  cutTextActive: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },

  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dayHeadText: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  dayHeadAmount: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textPrimary },
  date: { backgroundColor: theme.colors.surfaceAlt },
  dateDay: { fontFamily: theme.font.monoBold, fontSize: 14, lineHeight: 16, color: theme.colors.textPrimary },
  dateMonth: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  payWrap: { alignItems: 'flex-end', gap: 5 },
  payBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  payBtnText: { fontFamily: theme.font.roundedBold, fontSize: 11.5, color: theme.colors.surface },
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
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  linkDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
});
