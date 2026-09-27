import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { HomeSection } from './HomeSection';
import { homeStyles as h, HOME } from './homeStyles';
import type { NeedsYouItem, NeedsYouTone } from './needsYou';
import { withPressed } from '@/lib/pressed';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Home's "Needs you" block — the top three things that want action (see
 * needsYou.ts for the rules), with "See all" opening the bell's full list
 * when there are more; the badge counts all of them. Renders nothing at all when there's
 * nothing, so a calm month leaves Home calmer rather than showing an empty
 * card. Rows are drawn exactly like UpcomingRow (same sizes, same card),
 * so this reads as part of Home's existing language, not a new widget.
 * (Last month's Wrap used to be a row here; it's the Wrap button in Home's
 * header now, see WrapButton.tsx.)
 */
/** How many items the Home card shows; the rest are one tap away. */
const NEEDS_YOU_ON_HOME = 3;

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
  reports: 'trending-up',
  tidy: 'check-square',
  recurring: 'repeat',
  payCard: 'credit-card',
};

export function NeedsYouCard({
  items,
  onOpen,
  onSnooze,
  onSeeAll,
}: {
  items: NeedsYouItem[];
  onOpen: (item: NeedsYouItem) => void;
  onSnooze: (item: NeedsYouItem) => void;
  onSeeAll: () => void;
}) {
  const count = items.length;
  if (count === 0) return null;
  const shown = items.slice(0, NEEDS_YOU_ON_HOME);
  return (
    <HomeSection
      title="Needs you"
      badge={count}
      onSeeAll={items.length > shown.length ? onSeeAll : undefined}
    >
      <View style={styles.card}>
        {shown.map((item, i) => (
          <NeedsYouRow
            key={item.key}
            item={item}
            divider={i > 0}
            onPress={() => onOpen(item)}
            onSnooze={() => onSnooze(item)}
          />
        ))}
      </View>
    </HomeSection>
  );
}

/**
 * One Needs you item. `onDismiss` adds a ✕ (the full list on the bell's
 * screen); without it the row ends in a chevron, as on Home.
 */
export function NeedsYouRow({
  item,
  divider,
  onPress,
  onSnooze,
  onDismiss,
  dismissLabel = 'Dismiss',
}: {
  item: NeedsYouItem;
  divider: boolean;
  onPress: () => void;
  onSnooze: () => void;
  onDismiss?: () => void;
  /** The ✕'s spoken label — "Show again" on an already-dismissed row. */
  dismissLabel?: string;
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
          style={withPressed(styles.later)}
        >
          <Text style={styles.laterText}>Later</Text>
        </Pressable>
      ) : onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${dismissLabel}: ${item.title}`}
          style={withPressed(styles.close)}
        >
          <Feather
            name={dismissLabel === 'Dismiss' ? 'x' : 'rotate-ccw'}
            size={13}
            color={theme.colors.textSecondary}
          />
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
