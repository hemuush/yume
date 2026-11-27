import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { Section } from '@/components/Section';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressRing } from '@/components/ProgressRing';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';
import { SCREEN } from '@/components/screenStyles';
import { categorySentence } from '@/lib/categoryLabel';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { usePrivacy } from '@/theme/PrivacyContext';
import { GOAL_PACE_LABEL } from '@/features/goals/goalPlan';
import type { BudgetProgress } from '@/db/budgets';
import type { ExpectedRefund } from '@/db/refundTracking';
import type { SavingsGoal } from '@/types';
import { buildComingUp, summarizeComingUp, COMING_UP_ROWS, ComingUpFilter, ComingUpItem } from './comingUp';
import type { Upcoming } from './upcomingItems';
import { UpcomingRow } from './UpcomingRow';
import { PlanMoneyRow, planRowText } from '@/features/plan/PlanMoneyRow';
import { HomeRefunds } from './HomeRefunds';
import { themedStyles } from '@/theme/themedStyles';

const FILTERS: { key: ComingUpFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'payment', label: 'Payments' },
  { key: 'budget', label: 'Budgets' },
  { key: 'goal', label: 'Goals' },
];

function FilterChip({
  label,
  active,
  attention,
  onPress,
}: {
  label: string;
  active: boolean;
  attention: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      // Drawn 36 tall; the touch area is 44, as on Activity's filter chips.
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={attention ? `${label}, needs a look` : label}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
      {/* A corner badge, not a part of the row: it comes and goes without changing the width of the chip, so
          tapping one chip never moves the ones beside it. */}
      {attention && !active && <View style={styles.chipDot} />}
    </Pressable>
  );
}

function BudgetRow({ entry }: { entry: Extract<ComingUpItem, { kind: 'budget' }> }) {
  const { progress, state } = entry;
  const money = (minor: number) => formatMoney(minor);
  const name = categorySentence(progress.categoryName, progress.parentName);
  const left = money(Math.abs(progress.remainingMinor));
  const subtitle =
    state === 'over'
      ? `${left} over its limit`
      : `${state === 'ahead' ? 'Ahead of pace' : 'On track'} · ${left} left`;
  const percent = `${Math.round(progress.percentUsed)}%`;
  // The same row as Plan's budgets and goals (PlanMoneyRow), so a budget looks alike on both screens.
  return (
    <PlanMoneyRow
      icon={
        <CategoryIcon
          name={progress.categoryIcon}
          color={progress.categoryColor}
          square={40}
          size={18}
          round
        />
      }
      title={`${name} budget`}
      subtitle={
        <Text
          style={[
            planRowText.subtitle,
            state === 'over' ? planRowText.bad : state === 'ahead' ? planRowText.warn : null,
          ]}
        >
          {subtitle}
        </Text>
      }
      value={<Text style={[planRowText.value, state === 'over' && planRowText.bad]}>{percent}</Text>}
      progress={{
        pct: Math.min(100, progress.percentUsed),
        color: state === 'over' ? theme.colors.expenseText : theme.colors.ink,
        animKey: `budget:${progress.budget.id}`,
      }}
      onPress={() => router.push({ pathname: '/budgets', params: { budget: progress.budget.id } })}
      accessibilityLabel={`${name} budget, ${percent} used, ${left} ${state === 'over' ? 'over' : 'left'}`}
    />
  );
}

function GoalRow({ entry }: { entry: Extract<ComingUpItem, { kind: 'goal' }> }) {
  const { hideAmounts } = usePrivacy();
  const { goal, percent, toGoMinor, perMonthMinor, pace } = entry;
  const behind = pace === 'behind';
  const toGo = formatMaskableMoney(toGoMinor, { masked: hideAmounts });
  const pct = `${Math.round(percent)}%`;
  const subtitle = hideAmounts
    ? 'Amounts hidden'
    : perMonthMinor != null
      ? `${formatMoney(perMonthMinor)} a month`
      : 'No target date';
  return (
    <PlanMoneyRow
      icon={
        <ProgressRing
          percent={hideAmounts ? 0 : percent}
          color={behind ? theme.colors.slice.due : theme.colors.slice.saved}
          animKey={`home-goal:${goal.id}`}
          size={SCREEN.lead}
        >
          {hideAmounts ? (
            <Feather name="eye-off" size={14} color={theme.colors.textMuted} />
          ) : (
            <Text style={styles.ringText}>{pct}</Text>
          )}
        </ProgressRing>
      }
      title={goal.name}
      subtitle={
        <Text style={[planRowText.subtitle, behind && !hideAmounts && planRowText.warn]}>{subtitle}</Text>
      }
      value={<Text style={planRowText.value}>{hideAmounts ? toGo : `${toGo} to go`}</Text>}
      note={
        !hideAmounts && pace ? (
          <Text style={[planRowText.note, behind ? planRowText.warn : planRowText.good]}>
            {GOAL_PACE_LABEL[pace]}
          </Text>
        ) : undefined
      }
      onPress={() => router.push({ pathname: '/savings-goals', params: { goal: goal.id } })}
      accessibilityLabel={`${goal.name}, ${hideAmounts ? 'amounts hidden' : `${pct} saved, ${toGo} to go${pace ? `, ${GOAL_PACE_LABEL[pace]}` : ''}`}`}
    />
  );
}

function PaymentRow({
  entry,
  repeatDate,
}: {
  entry: Extract<ComingUpItem, { kind: 'payment' }>;
  /** The row above is due the same day: its "Due in 10 days" is not said again. */
  repeatDate: boolean;
}) {
  const { item } = entry;
  return (
    <UpcomingRow
      icon={item.icon}
      iconBg={theme.colors.home.control}
      iconColor={item.iconColor}
      title={item.title}
      subtitle={repeatDate ? '' : item.subtitle}
      amountMinor={item.amountMinor}
      sign={item.sign}
      onPress={() =>
        item.urgent && item.ruleId
          ? router.push({
              pathname: '/(tabs)/plan',
              params: { tab: 'upcoming', upcoming: item.sortDate, rule: item.ruleId },
            })
          : router.push(item.route)
      }
      urgent={item.urgent}
      soon={item.pinned && !item.urgent}
      date={item.sortDate}
      dueDate={item.sortDate}
      actionLabel={item.pinned && item.payable ? 'Pay' : item.urgent ? 'Review' : undefined}
      highlight={item.pinned}
      payInline
    />
  );
}

function sameDayAsPrev(list: ComingUpItem[], i: number) {
  const prev = list[i - 1];
  const cur = list[i];
  return (
    !!prev && prev.kind === 'payment' && cur.kind === 'payment' && prev.item.sortDate === cur.item.sortDate
  );
}

/**
 * Home's Coming up: payments, budgets and goals in one list, the most pressing first. Chips narrow it to one
 * kind; each kind's own page is one tap from the header link. Pending refunds sit under the payments.
 */
export function HomeComingUp({
  upcoming,
  budgets,
  goals,
  today,
  rowEntering,
  onSeeAll,
  refunds = [],
  refundError = false,
  openingRefund,
  onOpenRefund,
  onRetryRefunds,
  stillToPayMinor = 0,
  loadFailed = false,
  onRetry,
}: {
  upcoming: Upcoming;
  budgets: BudgetProgress[];
  goals: SavingsGoal[];
  today: string;
  rowEntering: (i: number) => React.ComponentProps<typeof Animated.View>['entering'];
  onSeeAll: (filter: ComingUpFilter) => void;
  refunds?: ExpectedRefund[];
  refundError?: boolean;
  openingRefund?: string | null;
  onOpenRefund?: (transactionId: string) => void;
  onRetryRefunds?: () => void;
  /** Unpaid EMIs and bills left this month: the heading's summary line (0 = nothing said). */
  stillToPayMinor?: number;
  loadFailed?: boolean;
  onRetry?: () => void;
}) {
  const [picked, setPicked] = useState<ComingUpFilter>('all');
  const items = buildComingUp({ upcoming, budgets, goals, today });
  const kindsPresent = new Set(items.map((i) => i.kind)).size;
  // A filter whose items are gone (the last budget deleted, say) falls back to everything.
  const { counts, attention } = summarizeComingUp(items, 'all');
  const filter: ComingUpFilter = picked !== 'all' && counts[picked] === 0 ? 'all' : picked;
  const { visible } = summarizeComingUp(items, filter);
  const showRefunds = (refunds.length > 0 || refundError) && (filter === 'all' || filter === 'payment');
  return (
    <Section
      compact
      title="Upcoming"
      subtitle={stillToPayMinor > 0 ? `${formatMoney(stillToPayMinor)} still to pay this month` : undefined}
      onSeeAll={() => onSeeAll(filter)}
      actionLabel={filter === 'budget' ? 'All budgets' : filter === 'goal' ? 'All goals' : 'View plan'}
    >
      <View style={styles.sectionContent}>
        {loadFailed && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading upcoming items"
            onPress={onRetry}
            style={withPressed(styles.retry)}
          >
            <Text style={styles.retryText}>Some upcoming items couldn’t load. Try again</Text>
          </Pressable>
        )}
        {kindsPresent > 1 && items.length > COMING_UP_ROWS && (
          <View style={styles.chips} accessibilityRole="toolbar" accessibilityLabel="Filter coming up">
            {FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0).map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                active={filter === f.key}
                attention={f.key !== 'all' && attention[f.key]}
                onPress={() => {
                  if (f.key !== filter) haptics.tap();
                  setPicked(f.key);
                }}
              />
            ))}
          </View>
        )}
        <Animated.View layout={ROW_LAYOUT} style={styles.card}>
          {visible.length > 0 ? (
            visible.map((entry, i) => (
              <Animated.View key={entry.key} entering={rowEntering(i)} exiting={ROW_EXIT} layout={ROW_LAYOUT}>
                {i > 0 && <View style={styles.listDivider} />}
                {entry.kind === 'payment' ? (
                  <PaymentRow entry={entry} repeatDate={sameDayAsPrev(visible, i)} />
                ) : entry.kind === 'budget' ? (
                  <BudgetRow entry={entry} />
                ) : (
                  <GoalRow entry={entry} />
                )}
              </Animated.View>
            ))
          ) : loadFailed ? null : (
            <Pressable
              onPress={() => onSeeAll('all')}
              accessibilityRole="button"
              accessibilityLabel="Nothing coming up. Open Plan"
              style={withPressed(styles.empty)}
            >
              <View style={styles.emptyIconBadge}>
                <Feather name="check-circle" size={18} color={theme.colors.incomeText} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.emptyTitle}>Nothing coming up</Text>
                <Text style={styles.emptyHint}>Add bills, budgets and goals in Plan.</Text>
              </View>
              <Feather
                name="chevron-right"
                size={15}
                color={theme.colors.textMuted}
                style={styles.emptyChevron}
              />
            </Pressable>
          )}
          {showRefunds && (
            <View style={styles.refunds}>
              <HomeRefunds
                refunds={refunds}
                failed={refundError}
                openingId={openingRefund}
                onOpen={onOpenRefund}
                onRetry={onRetryRefunds}
                compact
              />
            </View>
          )}
        </Animated.View>
      </View>
    </Section>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    sectionContent: { marginHorizontal: SCREEN.gutter, gap: 4 },
    retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
    retryText: { color: theme.colors.link, fontFamily: theme.font.bodyMedium, fontSize: 13 },
    card: {
      backgroundColor: theme.colors.home.surface,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      overflow: 'hidden',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 4,
      // The chips are drawn 36 tall and keep their 44 touch area through hitSlop, so the row adds no padding of its
      // own: it sat a full chip further from its heading than the lists under the other headings do.
      paddingVertical: 0,
    },
    // Sized so All, Payments, Budgets and Goals share one line on a 360 dp phone; the same weight selected or not,
    // so picking one never changes its width either.
    chip: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: theme.colors.home.selected,
    },
    chipPressed: { backgroundColor: theme.colors.home.pressed },
    listDivider: {
      marginLeft: SCREEN.rowInset + SCREEN.lead + 12,
      marginRight: SCREEN.rowInset,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.home.edge,
    },
    chipText: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      letterSpacing: 0.1,
      color: theme.colors.home.secondaryText,
    },
    chipTextOn: { color: theme.colors.textPrimary },
    chipDot: {
      position: 'absolute',
      top: 4,
      right: 3,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.slice.due,
    },
    ringText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
    refunds: {
      marginTop: 4,
      marginHorizontal: -12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.home.surface,
    },
    empty: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    emptyIconBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.colors.home.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyChevron: {
      opacity: theme.opacity.disabled,
    },
    copy: { flex: 1, minWidth: 0, gap: 3 },
    emptyTitle: {
      fontFamily: theme.font.bodyBold,
      fontSize: 14,
      color: theme.colors.textPrimary,
      letterSpacing: -0.1,
    },
    emptyHint: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textSecondary,
    },
  })
);
