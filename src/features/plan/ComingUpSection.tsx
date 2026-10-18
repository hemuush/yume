import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { dueDateLabel } from '@/lib/dueDate';
import { withPressed } from '@/lib/pressed';
import { formatMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { hexToRgba } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { UpcomingRow } from '@/features/home/UpcomingRow';
import { DueGroup, PlanDueItem, PlanRoute, dueTone } from './planOverview';
import { styles } from './plan.styles';

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
  if (item.kind === 'transfer') return 'repeat';
  return 'file-text';
}

/**
 * Plan's upcoming payments as one card: the EMIs, bills and income of the window (all of them, or the first `limit`),
 * a small heading per day (its date once, with what leaves that day) and Home's row under it (icon, title,
 * kind and, when it is late or close, when; amount; a chip). A due or close EMI ends in a Pay pill and its row
 * opens the pay sheet; any other EMI opens its loan, a rule opens the rule sheet.
 */
export function ComingUpSection({
  groups,
  today,
  onOpen,
  onPay,
  onLoan,
  onRule,
  limit,
}: {
  groups: DueGroup[];
  /** YYYY-MM-DD — the day the amber/red tones count from. */
  today: string;
  onOpen: (route: PlanRoute) => void;
  /** Records an EMI as paid — the Pay pill on a due or close EMI. */
  onPay?: (loanId: string) => void;
  onLoan?: (loanId: string) => void;
  onRule?: (ruleId: string) => void;
  /** Show only the first N rows (the Overview preview). */
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
    <Glass style={[styles.list, cardSurface.neutral]}>
      {shown.length === 0 ? (
        <Pressable
          onPress={() => onOpen('/recurring')}
          style={withPressed(styles.emptyRow)}
          accessibilityRole="button"
          accessibilityLabel="Add a recurring entry"
        >
          <View style={styles.dueIcon}>
            <Feather name="repeat" size={16} color={theme.colors.ink} />
          </View>
          <View style={styles.dueMid}>
            <Text style={styles.dueTitle}>Rent, salary, subscriptions</Text>
            <Text style={styles.dueSub}>Add a recurring entry to see it here</Text>
          </View>
          <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : (
        shown.map((g) => (
          <View key={g.date}>
            <View style={styles.dayHead}>
              <Text style={styles.dayHeadText}>{weekdayDayMonth(g.date)}</Text>
              {g.outMinor > 0 && <Text style={styles.dayHeadText}>{formatMoney(g.outMinor)} out</Text>}
            </View>
            {g.items.map((item, i) => {
              const tone = dueTone(item, today);
              const payable = !!item.loanId && !!onPay && tone != null;
              return (
                <UpcomingRow
                  key={item.key}
                  icon={kindIcon(item)}
                  iconBg={
                    item.kind === 'emi'
                      ? hexToRgba(accent, 0.18)
                      : item.kind === 'income'
                        ? theme.colors.incomeTint
                        : item.key.startsWith('card-')
                          ? theme.colors.idGold
                          : theme.colors.secondaryTint
                  }
                  title={item.title}
                  subtitle={
                    tone ? `${KIND_LABEL[item.kind]} · ${dueDateLabel(item.dueDate)}` : KIND_LABEL[item.kind]
                  }
                  dueDate={item.dueDate}
                  amountMinor={item.amountMinor}
                  sign={item.kind === 'income' ? '+' : item.kind === 'transfer' ? '' : '-'}
                  urgent={tone === 'urgent'}
                  soon={tone === 'soon'}
                  actionLabel={payable ? 'Pay' : undefined}
                  divider={i > 0}
                  onPress={() => {
                    if (payable) onPay!(item.loanId!);
                    else if (item.loanId && onLoan) onLoan(item.loanId);
                    else if (item.ruleId && onRule) onRule(item.ruleId);
                    else onOpen(item.route);
                  }}
                />
              );
            })}
          </View>
        ))
      )}
    </Glass>
  );
}
