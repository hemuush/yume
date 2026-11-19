import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dueDateLabel } from '@/lib/dueDate';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { formatMoney } from '@/lib/money';
import { weekdayDayMonthMaybeYear } from '@/lib/dateLabels';
import { parseLocalIsoDate } from '@/lib/date';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { DueGroup, PlanDueItem, PlanRoute, dueTone } from './planOverview';
import { themedStyles } from '@/theme/themedStyles';
import { useStacked } from '@/lib/useStacked';

const KIND_LABEL: Record<PlanDueItem['kind'], string> = {
  emi: 'EMI',
  bill: 'Bill',
  income: 'Income',
  transfer: 'Transfer',
};

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function kindIcon(item: PlanDueItem): FeatherName {
  if (item.kind === 'emi' || item.key.startsWith('card-')) return 'credit-card';
  if (item.kind === 'income') return 'arrow-down-left';
  if (item.transfer?.invest) return 'trending-up';
  if (item.kind === 'transfer') return 'repeat';
  return 'file-text';
}

/**
 * Plan's upcoming payments as one flat card: a heading per day (its date, with what leaves or arrives that day
 * and "incl. overdue" when late items are counted in it) and a compact row under it (icon, title, kind and,
 * when it is late or close, when; amount). A due or close EMI ends in a Pay pill and its row opens the pay
 * sheet; any other EMI opens its loan, a rule opens the rule sheet. Nothing to show: one row inviting a first
 * recurring entry.
 */
export function ComingUpSection({
  groups,
  today,
  flow = 'out',
  onOpen,
  onPay,
  onLoan,
  onRule,
  limit,
  preview = false,
}: {
  groups: DueGroup[];
  /** YYYY-MM-DD — the day the amber/red tones count from. */
  today: string;
  /** What each day's total on the right means: money leaving ("out") or arriving ("in"). */
  flow?: 'out' | 'in';
  onOpen: (route: PlanRoute) => void;
  /** Records an EMI as paid — the Pay pill on a due or close EMI. */
  onPay?: (loanId: string) => void;
  onLoan?: (loanId: string) => void;
  onRule?: (ruleId: string) => void;
  /** Show only the first N rows. */
  limit?: number;
  /** Small Overview list with the date on each item instead of a separate day header. */
  preview?: boolean;
}) {
  const { accent } = useAccent();
  const stacked = useStacked('late');
  const reference = parseLocalIsoDate(today);
  // The first `limit` rows, keeping each day's heading only while it still has a row.
  const shown = groups.reduce<{ rows: DueGroup[]; used: number }>(
    (acc, g) => {
      const items = g.items.slice(0, Math.max(0, (limit ?? Infinity) - acc.used));
      return items.length > 0 ? { rows: [...acc.rows, { ...g, items }], used: acc.used + items.length } : acc;
    },
    { rows: [], used: 0 }
  ).rows;
  return (
    <View style={s.card}>
      {shown.length === 0 ? (
        <Pressable
          onPress={() => onOpen('/recurring')}
          style={withPressed(s.emptyRow)}
          accessibilityRole="button"
          accessibilityLabel="Add a recurring entry"
        >
          <View style={[s.icon, { backgroundColor: theme.colors.home.control }]}>
            <Feather name="repeat" size={15} color={theme.colors.ink} />
          </View>
          <View style={s.mid}>
            <Text style={s.title}>Rent, salary, subscriptions</Text>
            <Text style={s.sub}>Add a recurring entry to see it here</Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : (
        shown.map((g, groupIndex) => {
          const late = g.items.some((item) => item.dueDate < g.date);
          return (
            <View key={g.date} style={!preview && groupIndex > 0 ? s.rowDivider : undefined}>
              {!preview && (
                <View
                  style={[
                    s.dayHead,
                    {
                      backgroundColor: late
                        ? theme.colors.expenseTint
                        : g.date === today
                          ? theme.colors.home.selected
                          : theme.colors.home.control,
                    },
                  ]}
                >
                  <Text style={[s.dayHeadText, late && s.dayHeadLate]} accessibilityRole="header">
                    {g.date === today ? 'Today · ' : ''}
                    {weekdayDayMonthMaybeYear(g.date, reference)}
                    {late ? <Text style={s.dayHeadNote}> · incl. overdue</Text> : null}
                  </Text>
                  {g.outMinor > 0 && (
                    <Text style={s.dayTotal}>
                      {formatMoney(g.outMinor)} {flow}
                    </Text>
                  )}
                </View>
              )}
              {g.items.map((item, itemIndex) => {
                const tone = dueTone(item, today);
                const payable = !!item.loanId && item.nextInstallment !== false && !!onPay && tone != null;
                const incoming = item.kind === 'income' || item.transfer?.flow === 'in';
                const subtitle = preview
                  ? item.dueDate === today
                    ? 'Due today'
                    : weekdayDayMonthMaybeYear(item.dueDate, reference)
                  : item.transfer
                    ? item.transfer.sub
                    : tone
                      ? `${KIND_LABEL[item.kind]} · ${dueDateLabel(item.dueDate)}`
                      : KIND_LABEL[item.kind];
                const money = `${incoming ? '+' : '-'}${formatMoney(item.amountMinor)}`;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}, ${subtitle}, ${money}${payable ? ', Pay' : ''}`}
                    onPress={() => {
                      if (payable) onPay!(item.loanId!);
                      else if (item.loanId && onLoan) onLoan(item.loanId);
                      else if (item.ruleId && onRule) onRule(item.ruleId);
                      else onOpen(item.route);
                    }}
                    style={withPressedTint(accent, [
                      s.row,
                      preview && s.previewRow,
                      (itemIndex > 0 || (preview && groupIndex > 0)) && s.rowDivider,
                    ])}
                  >
                    {preview && (
                      <View
                        style={[
                          s.icon,
                          {
                            // One neutral theme tint for every payment; only late (red) and income (green) differ.
                            backgroundColor:
                              tone === 'urgent'
                                ? theme.colors.expenseTint
                                : incoming
                                  ? theme.colors.incomeTint
                                  : theme.colors.home.control,
                          },
                        ]}
                      >
                        <Feather
                          name={kindIcon(item)}
                          size={15}
                          color={
                            tone === 'urgent'
                              ? theme.colors.expenseText
                              : incoming
                                ? theme.colors.incomeText
                                : theme.colors.ink
                          }
                        />
                      </View>
                    )}
                    <View style={[s.entry, stacked && s.entryStacked]}>
                      <View style={s.mid}>
                        <Text style={s.title} numberOfLines={stacked ? undefined : 2}>
                          {item.title}
                        </Text>
                        <Text
                          style={[s.sub, tone === 'urgent' && s.subUrgent, tone === 'soon' && s.subSoon]}
                          numberOfLines={stacked ? undefined : 2}
                        >
                          {subtitle}
                        </Text>
                      </View>
                      <View style={[s.end, stacked && s.endStacked]}>
                        <Text
                          style={[s.amount, incoming && s.income]}
                          numberOfLines={stacked ? undefined : 1}
                        >
                          {money}
                        </Text>
                        {payable && (
                          <View style={[s.rowAction, preview && { backgroundColor: themeInk(accent) }]}>
                            <Text style={[s.payText, preview && s.previewPayText]}>Pay</Text>
                          </View>
                        )}
                        {!payable && (
                          <View style={s.rowAction}>
                            <Feather name="chevron-right" size={14} color={theme.colors.home.secondaryText} />
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })
      )}
    </View>
  );
}

const s = themedStyles(() =>
  StyleSheet.create({
    previewRow: { minHeight: 48, paddingVertical: 5 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.home.edge },
    card: {
      marginHorizontal: 16,
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
    },
    dayHead: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      columnGap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.home.edge,
    },
    dayHeadText: {
      flexShrink: 1,
      fontFamily: theme.font.bodyBold,
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
    dayHeadLate: { color: theme.colors.expenseText },
    dayHeadNote: { fontFamily: theme.font.body, color: theme.colors.textSecondary },
    dayTotal: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      fontVariant: ['tabular-nums'],
      color: theme.colors.home.secondaryText,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    mid: { flex: 1, minWidth: 0 },
    entry: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    entryStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
    end: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    endStacked: { flexWrap: 'wrap', justifyContent: 'flex-end' },
    title: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textPrimary,
    },
    sub: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.home.secondaryText,
    },
    subUrgent: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
    subSoon: { fontFamily: theme.font.bodyBold, color: theme.colors.warnInk },
    amount: {
      flexShrink: 1,
      fontFamily: theme.font.bodyBold,
      fontSize: 14,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    income: { color: theme.colors.incomeText },
    // The Pay pill is part of the row, which is the one tap target (44 dp tall at least in practice).
    rowAction: {
      minWidth: 34,
      minHeight: 30,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.pill,
    },
    payText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
    previewPayText: { color: theme.colors.onInk },
    emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 14 },
  })
);
