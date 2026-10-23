import { selectedFill } from '@/theme/interactionColors';
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
import { ROW_LAYOUT } from '@/lib/animation';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import { categorySentence } from '@/lib/categoryLabel';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { GOAL_PACE_LABEL } from '@/features/goals/goalPlan';
import type { BudgetProgress } from '@/db/budgets';
import type { ExpectedRefund } from '@/db/refundTracking';
import type { SavingsGoal } from '@/types';
import { buildComingUp, summarizeComingUp, ComingUpFilter, ComingUpItem } from './comingUp';
import type { Upcoming } from './upcomingItems';
import { UpcomingRow } from './UpcomingRow';
import { HomeRow } from './HomeRow';
import { HomeRefunds } from './HomeRefunds';

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
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={attention ? `${label}, needs a look` : label}
      style={withPressedTint(accent, [styles.chip, active && { backgroundColor: selectedFill(accent) }])}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
      {attention && !active && <View style={styles.chipDot} />}
    </Pressable>
  );
}

function BudgetRow({
  entry,
  divider,
}: {
  entry: Extract<ComingUpItem, { kind: 'budget' }>;
  divider: boolean;
}) {
  const { progress, state } = entry;
  const money = (minor: number) => formatMoney(minor);
  const name = categorySentence(progress.categoryName, progress.parentName);
  const left = money(Math.abs(progress.remainingMinor));
  const subtitle =
    state === 'over'
      ? `${left} over its limit`
      : `${state === 'ahead' ? 'Ahead of pace' : 'On track'} · ${left} left`;
  const percent = `${Math.round(progress.percentUsed)}%`;
  return (
    <HomeRow
      leading={
        <CategoryIcon
          name={progress.categoryIcon}
          color={progress.categoryColor}
          square={SCREEN.mark}
          size={18}
          round
        />
      }
      title={`${name} budget`}
      subtitle={subtitle}
      subtitleTone={state === 'over' ? 'urgent' : state === 'ahead' ? 'soon' : undefined}
      value={percent}
      chip={
        state === 'over'
          ? { label: 'Over', tone: 'warning' }
          : state === 'ahead'
            ? { label: 'Ahead', tone: 'due' }
            : undefined
      }
      onPress={() => router.push('/budgets')}
      divider={divider}
      accessibilityLabel={`${name} budget, ${percent} used, ${left} ${state === 'over' ? 'over' : 'left'}`}
    />
  );
}

function GoalRow({ entry, divider }: { entry: Extract<ComingUpItem, { kind: 'goal' }>; divider: boolean }) {
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
    <HomeRow
      leading={
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
      subtitle={subtitle}
      subtitleTone={behind && !hideAmounts ? 'soon' : undefined}
      value={hideAmounts ? toGo : `${toGo} to go`}
      chip={
        !hideAmounts && pace ? { label: GOAL_PACE_LABEL[pace], tone: behind ? 'due' : 'complete' } : undefined
      }
      onPress={() => router.push('/savings-goals')}
      divider={divider}
      accessibilityLabel={`${goal.name}, ${hideAmounts ? 'amounts hidden' : `${pct} saved, ${toGo} to go${pace ? `, ${GOAL_PACE_LABEL[pace]}` : ''}`}`}
    />
  );
}

function PaymentRow({
  entry,
  divider,
}: {
  entry: Extract<ComingUpItem, { kind: 'payment' }>;
  divider: boolean;
}) {
  const { item } = entry;
  return (
    <UpcomingRow
      icon={item.icon}
      iconBg={item.iconBg}
      iconColor={item.iconColor}
      title={item.title}
      subtitle={item.subtitle}
      amountMinor={item.amountMinor}
      sign={item.sign}
      onPress={() => router.push(item.route)}
      divider={divider}
      urgent={item.urgent}
      soon={item.pinned && !item.urgent}
      date={item.sortDate}
      dueDate={item.sortDate}
      actionLabel={item.pinned && item.payable ? 'Pay' : undefined}
      highlight={item.pinned}
    />
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
      title="Coming up"
      onSeeAll={() => onSeeAll(filter)}
      actionLabel={filter === 'budget' ? 'All budgets' : filter === 'goal' ? 'All goals' : 'View plan'}
    >
      <Animated.View layout={ROW_LAYOUT} style={styles.card}>
        {kindsPresent > 1 && (
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
        {visible.length > 0 ? (
          visible.map((entry, i) => (
            <Animated.View key={`${filter}:${entry.key}`} entering={rowEntering(i)}>
              {entry.kind === 'payment' ? (
                <PaymentRow entry={entry} divider={i > 0} />
              ) : entry.kind === 'budget' ? (
                <BudgetRow entry={entry} divider={i > 0} />
              ) : (
                <GoalRow entry={entry} divider={i > 0} />
              )}
            </Animated.View>
          ))
        ) : (
          <Pressable
            onPress={() => onSeeAll('all')}
            accessibilityRole="button"
            accessibilityLabel="Nothing coming up. Open Plan"
            style={withPressed(styles.empty)}
          >
            <Feather name="check-circle" size={20} color={theme.colors.incomeText} />
            <View style={styles.copy}>
              <Text style={styles.emptyTitle}>Nothing coming up</Text>
              <Text style={styles.emptyHint}>Add bills, budgets and goals in Plan.</Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
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
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, paddingHorizontal: 12, paddingBottom: 6 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 14,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.colors.tray,
  },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.textPrimary, fontFamily: theme.font.bodyBold },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.slice.due },
  ringText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
  refunds: { marginTop: 4, marginHorizontal: -12, borderRadius: 20, backgroundColor: theme.colors.surface },
  empty: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  emptyTitle: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  emptyHint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
});
