import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dueDateLabel } from '@/lib/dueDate';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { formatMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { hexToRgba, shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { DueGroup, PlanDueItem, PlanRoute, dueTone } from './planOverview';

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
}) {
  const { accent } = useAccent();
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
          <View style={[s.icon, { backgroundColor: shade(accent, 88) }]}>
            <Feather name="repeat" size={15} color={theme.colors.ink} />
          </View>
          <View style={s.mid}>
            <Text style={s.title}>Rent, salary, subscriptions</Text>
            <Text style={s.sub}>Add a recurring entry to see it here</Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : (
        shown.map((g, gi) => {
          const late = g.items.some((item) => item.dueDate < g.date);
          return (
            <View key={g.date}>
              <View style={[s.dayHead, gi > 0 && s.dayHeadDivider]}>
                <Text style={[s.dayHeadText, late && s.dayHeadLate]}>
                  {g.date === today ? 'Today · ' : ''}
                  {weekdayDayMonth(g.date)}
                  {late ? <Text style={s.dayHeadNote}> · incl. overdue</Text> : null}
                </Text>
                {g.outMinor > 0 && (
                  <Text style={s.dayTotal}>
                    {formatMoney(g.outMinor)} {flow}
                  </Text>
                )}
              </View>
              {g.items.map((item) => {
                const tone = dueTone(item, today);
                const payable = !!item.loanId && item.nextInstallment !== false && !!onPay && tone != null;
                const incoming = item.kind === 'income' || item.transfer?.flow === 'in';
                const subtitle = item.transfer
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
                    style={withPressedTint(accent, s.row)}
                  >
                    <View
                      style={[
                        s.icon,
                        {
                          backgroundColor:
                            tone === 'urgent'
                              ? theme.colors.expenseTint
                              : item.kind === 'emi'
                                ? hexToRgba(accent, 0.18)
                                : incoming
                                  ? theme.colors.incomeTint
                                  : item.key.startsWith('card-')
                                    ? theme.colors.idGold
                                    : theme.colors.secondaryTint,
                        },
                      ]}
                    >
                      <Feather
                        name={kindIcon(item)}
                        size={15}
                        color={tone === 'urgent' ? theme.colors.expense : theme.colors.ink}
                      />
                    </View>
                    <View style={s.mid}>
                      <Text style={s.title} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text
                        style={[s.sub, tone === 'urgent' && s.subUrgent, tone === 'soon' && s.subSoon]}
                        numberOfLines={2}
                      >
                        {subtitle}
                      </Text>
                    </View>
                    <Text style={[s.amount, incoming && s.income]} numberOfLines={1}>
                      {money}
                    </Text>
                    {payable && (
                      <View style={[s.pay, { backgroundColor: themeInk(accent) }]}>
                        <Text style={s.payText}>Pay</Text>
                      </View>
                    )}
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

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
    paddingBottom: 2,
  },
  dayHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  dayHeadDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
    marginTop: 4,
  },
  dayHeadText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  dayHeadLate: { color: theme.colors.expenseText },
  dayHeadNote: { fontFamily: theme.font.body, color: theme.colors.textMuted },
  dayTotal: {
    fontFamily: theme.font.body,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textMuted,
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
  title: { fontFamily: theme.font.bodyMedium, fontSize: 14, lineHeight: 19, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 16, color: theme.colors.textMuted },
  subUrgent: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
  subSoon: { fontFamily: theme.font.bodyBold, color: theme.colors.warnInk },
  amount: {
    flexShrink: 0,
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  income: { color: theme.colors.incomeText },
  // The Pay pill is part of the row, which is the one tap target (44 dp tall at least in practice).
  pay: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 12, borderRadius: theme.radius.pill },
  payText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.white },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 14 },
});
