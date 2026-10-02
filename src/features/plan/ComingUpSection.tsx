import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dueDateLabel } from '@/lib/dueDate';
import { usePressScale } from '@/lib/usePressScale';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h, HOME } from '@/features/home/homeStyles';
import { DueGroup, PlanDueItem, PlanRoute, dueTone } from './planOverview';
import { weekdayDayMonth } from '@/lib/dateLabels';

import { styles } from './plan.styles';
import { withPressed } from '@/lib/pressed';
import { DateTile } from '@/components/DateTile';

/**
 * Plan's Coming up: everything due in the next 14 days, grouped under its
 * date with the day's total going out. EMIs keep their Pay button.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/* ---------- Coming up ---------- */

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
  const when = dueDateLabel(item.dueDate);
  const tone = dueTone(item);
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
      <DateTile iso={item.dueDate} urgent={tone === 'urgent'} soon={tone === 'soon'} />
      <View style={h.mid}>
        <Text style={h.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text
          style={[h.sub, tone === 'urgent' ? h.subUrgent : tone === 'soon' && h.subSoon]}
          numberOfLines={1}
        >
          {KIND_LABEL[item.kind]} · {when}
        </Text>
      </View>
      {item.loanId && onPay ? (
        <View style={styles.payWrap}>
          {amount}
          <Pressable
            onPress={() => onPay(item.loanId!)}
            hitSlop={8}
            style={withPressed(styles.payBtn)}
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

/**
 * Everything due in the next 14 days, grouped under its date with the day's
 * total going out — not just the first few. EMIs keep their Pay button.
 */
export function ComingUpSection({
  groups,
  onOpen,
  onPay,
  onCardLayout,
  onGroupLayout,
}: {
  groups: DueGroup[];
  onOpen: (route: PlanRoute) => void;
  /** Records an EMI as paid — shown as a Pay button on each EMI row. */
  onPay?: (loanId: string) => void;
  /** Where the card sits inside the section, and each day's group inside the card, so the strip can scroll to one. */
  onCardLayout?: (y: number) => void;
  onGroupLayout?: (date: string, y: number) => void;
}) {
  return (
    <HomeSection title="Coming up">
      <View style={h.card} onLayout={(e) => onCardLayout?.(e.nativeEvent.layout.y)}>
        {groups.length === 0 ? (
          <Pressable
            onPress={() => onOpen('/recurring')}
            style={withPressed(h.row)}
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
            <View key={g.date} onLayout={(e) => onGroupLayout?.(g.date, e.nativeEvent.layout.y)}>
              <View style={[styles.dayHead, gi > 0 && h.divider]}>
                <Text style={styles.dayHeadText}>{weekdayDayMonth(g.date)}</Text>
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
