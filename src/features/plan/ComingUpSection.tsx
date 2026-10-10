import { View, Pressable, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { Section } from '@/components/Section';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dueDateLabel } from '@/lib/dueDate';
import { usePressScale } from '@/lib/usePressScale';
import { withPressed } from '@/lib/pressed';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';
import { DueGroup, PlanDueItem, PlanRoute, dueTone, DUE_SOON_DAYS } from './planOverview';
import { styles } from './plan.styles';
import { addDaysToIsoDate } from '@/lib/date';

/**
 * Plan's Coming up as a timeline: one line runs down the card with a dot per day (amber when something is
 * close, red when it's due), the day's total going out beside its date, and its items under it. EMIs keep
 * their Pay button. Ends with links to Recurring and Loans.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type FeatherName = React.ComponentProps<typeof Feather>['name'];

const KIND_LABEL: Record<PlanDueItem['kind'], string> = {
  emi: 'EMI',
  bill: 'Bill',
  income: 'Income',
  transfer: 'Transfer',
};

function kindIcon(item: PlanDueItem): FeatherName {
  if (item.kind === 'emi' || item.key.startsWith('card-')) return 'credit-card';
  if (item.kind === 'income') return 'arrow-down-left';
  if (item.kind === 'transfer') return 'repeat';
  return 'file-text';
}

function LinkCell({ label, onPress, divider }: { label: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={withPressed([styles.linkCell, divider && styles.linkDivider])}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function DueRow({
  item,
  today,
  onOpen,
  onPay,
}: {
  item: PlanDueItem;
  today: string;
  onOpen: (route: PlanRoute) => void;
  onPay?: (loanId: string) => void;
}) {
  const { accent } = useAccent();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const when = dueDateLabel(item.dueDate);
  const tone = dueTone(item, today);
  const sign = item.kind === 'income' ? '+' : item.kind === 'transfer' ? '' : '−';
  const direction = item.kind === 'income' ? 'in' : item.kind === 'transfer' ? '' : 'out';
  const amount = (
    <Text
      style={[styles.dueAmount, item.kind === 'income' && styles.income]}
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
      accessibilityLabel={`${item.title}, ${KIND_LABEL[item.kind]}, ${when}, ${formatMoney(item.amountMinor)}${direction ? ` ${direction}` : ''}`}
      style={[styles.dueRow, animatedStyle]}
    >
      <View style={styles.dueIcon}>
        <Feather name={kindIcon(item)} size={16} color={theme.colors.ink} />
      </View>
      <View style={styles.dueMid}>
        <Text style={styles.dueTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[styles.dueSub, tone === 'urgent' ? styles.dueUrgent : tone === 'soon' && styles.dueSoon]}
          numberOfLines={2}
        >
          {KIND_LABEL[item.kind]} · {when}
        </Text>
      </View>
      {item.loanId && onPay ? (
        <View style={styles.payWrap}>
          {amount}
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onPay(item.loanId!);
            }}
            style={withPressed([styles.payBtn, { backgroundColor: homeInk(accent) }])}
            accessibilityRole="button"
            accessibilityLabel={`Pay ${item.title} EMI`}
          >
            <Text style={styles.payBtnText}>Pay</Text>
          </Pressable>
        </View>
      ) : (
        amount
      )}
    </AnimatedPressable>
  );
}

/** A day's dot: red if anything that day is due now, amber if close, else the page's ink. */
function nodeColor(group: DueGroup, today: string, ink: string): string {
  const tones = group.items.map((it) => dueTone(it, today));
  if (tones.includes('urgent')) return theme.colors.expense;
  if (tones.includes('soon')) return theme.colors.slice.due;
  return ink;
}

export function ComingUpSection({
  groups,
  today,
  onOpen,
  onPay,
  onCardLayout,
  onGroupLayout,
}: {
  groups: DueGroup[];
  /** YYYY-MM-DD — the day the amber/red tones count from. */
  today: string;
  onOpen: (route: PlanRoute) => void;
  /** Records an EMI as paid — shown as a Pay button on each EMI row. */
  onPay?: (loanId: string) => void;
  /** Where the card sits inside the section, and each day's group inside the card, so the runway can scroll to one. */
  onCardLayout?: (y: number) => void;
  onGroupLayout?: (date: string, y: number) => void;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  return (
    <Section title="Coming up">
      <View onLayout={(e) => onCardLayout?.(e.nativeEvent.layout.y)}>
        <Glass style={styles.list}>
          {groups.length === 0 ? (
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
            groups.map((g, gi) => (
              <View
                key={g.date}
                style={styles.group}
                onLayout={(e) => onGroupLayout?.(g.date, e.nativeEvent.layout.y)}
              >
                {groups.length > 1 && (
                  <View
                    style={[
                      styles.rail,
                      gi === 0
                        ? { top: 20, bottom: 0 }
                        : gi === groups.length - 1
                          ? { top: 0, height: 20 }
                          : { top: 0, bottom: 0 },
                    ]}
                  />
                )}
                <View style={[styles.node, { borderColor: nodeColor(g, today, ink) }]} />
                <View style={styles.dayHead}>
                  <Text style={styles.dayHeadText}>{weekdayDayMonth(g.date)}</Text>
                  {g.outMinor > 0 && (
                    <Text style={styles.dayHeadAmount}>Total out {formatMoney(g.outMinor)}</Text>
                  )}
                </View>
                <Text style={styles.dueSub}>
                  {g.date > addDaysToIsoDate(today, DUE_SOON_DAYS - 1) ? 'Next scheduled · ' : ''}
                  {g.items.length} {g.items.length === 1 ? 'entry' : 'entries'} · {dueDateLabel(g.date)}
                </Text>
                {g.items.map((it) => (
                  <DueRow key={it.key} item={it} today={today} onOpen={onOpen} onPay={onPay} />
                ))}
              </View>
            ))
          )}
          <View style={styles.links}>
            <LinkCell label="Recurring" onPress={() => onOpen('/recurring')} />
            <LinkCell label="Loans" onPress={() => onOpen('/loans')} divider />
          </View>
        </Glass>
      </View>
    </Section>
  );
}
