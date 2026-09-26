import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { HomeSection } from './HomeSection';
import { homeStyles as h, HOME } from './homeStyles';
import type { NeedsYouItem, NeedsYouTone } from './needsYou';
import type { MonthReview } from './monthReview';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Home's "Needs you" block — at most three things that want action today
 * (see needsYou.ts for the rules). Renders nothing at all when there's
 * nothing, so a calm month leaves Home calmer rather than showing an empty
 * card. Rows are drawn exactly like UpcomingRow (same sizes, same card),
 * so this reads as part of Home's existing language, not a new widget.
 *
 * In the first week of a month, last month's review (see monthReview.ts) is
 * the first row: tap it for that month's report, ✕ to hide it until next
 * month. It used to be a card of its own.
 */
const TONE: Record<
  NeedsYouTone,
  { bg: string; fg: string; icon: React.ComponentProps<typeof Feather>['name'] }
> = {
  urgent: { bg: theme.colors.expenseTint, fg: theme.colors.expense, icon: 'alert-circle' },
  warn: { bg: theme.colors.idGold, fg: theme.colors.idGoldDeep, icon: 'pie-chart' },
  info: { bg: theme.colors.primaryTint, fg: theme.colors.ink, icon: 'folder' },
};

const ACTION_ICON: Partial<Record<NeedsYouItem['action'], React.ComponentProps<typeof Feather>['name']>> = {
  loans: 'calendar',
  backup: 'folder',
};

export function NeedsYouCard({
  items,
  onOpen,
  onSnooze,
  review = null,
  onOpenReview,
  onDismissReview,
}: {
  items: NeedsYouItem[];
  onOpen: (item: NeedsYouItem) => void;
  onSnooze: (item: NeedsYouItem) => void;
  review?: MonthReview | null;
  onOpenReview?: () => void;
  onDismissReview?: () => void;
}) {
  const count = items.length + (review ? 1 : 0);
  if (count === 0) return null;
  return (
    <HomeSection title="Needs you" badge={count}>
      <View style={styles.card}>
        {review && (
          <ReviewRow review={review} onPress={() => onOpenReview?.()} onDismiss={() => onDismissReview?.()} />
        )}
        {items.map((item, i) => (
          <NeedsYouRow
            key={item.key}
            item={item}
            divider={i > 0 || !!review}
            onPress={() => onOpen(item)}
            onSnooze={() => onSnooze(item)}
          />
        ))}
      </View>
    </HomeSection>
  );
}

function ReviewRow({
  review,
  onPress,
  onDismiss,
}: {
  review: MonthReview;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const detail = [
    `Spent ${formatMoney(review.spentMinor)}`,
    review.line ?? (review.keptLabel ? `${review.keptLabel} kept` : null),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${review.monthLabel} in review: ${detail}. Opens ${review.monthLabel}'s report`}
      style={[styles.row, animatedStyle]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryTint }]}>
        <Feather name="bar-chart-2" size={HOME.iconGlyph} color={theme.colors.ink} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {review.monthLabel} in review
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Hide until next month"
        style={styles.close}
      >
        <Feather name="x" size={13} color={theme.colors.textSecondary} />
      </Pressable>
    </AnimatedPressable>
  );
}

function NeedsYouRow({
  item,
  divider,
  onPress,
  onSnooze,
}: {
  item: NeedsYouItem;
  divider: boolean;
  onPress: () => void;
  onSnooze: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const tone = TONE[item.tone];
  const icon = item.tone === 'warn' ? tone.icon : (ACTION_ICON[item.action] ?? tone.icon);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.detail}${item.amountMinor != null ? `, ${formatMoney(item.amountMinor)}` : ''}`}
      style={[styles.row, divider && styles.divider, animatedStyle]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
        <Feather name={icon} size={HOME.iconGlyph} color={tone.fg} />
      </View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.sub, item.tone === 'urgent' && styles.subUrgent]} numberOfLines={1}>
          {item.detail}
        </Text>
      </View>
      {item.amountMinor != null && <Text style={styles.amount}>{formatMoney(item.amountMinor)}</Text>}
      {item.snoozable ? (
        <Pressable
          onPress={onSnooze}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Remind me later"
          style={styles.later}
        >
          <Text style={styles.laterText}>Later</Text>
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: h.card,
  row: h.row,
  divider: h.divider,
  iconWrap: h.iconTile,
  mid: h.mid,
  title: h.title,
  sub: h.sub,
  subUrgent: h.subUrgent,
  amount: { ...h.amount, color: theme.colors.expense },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  later: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  laterText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textSecondary },
});
