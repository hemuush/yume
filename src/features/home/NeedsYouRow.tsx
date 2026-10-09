import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import type { NeedsYouItem } from './needsYou';
import { NEEDS_TONE } from './needsTone';
import { withPressed } from '@/lib/pressed';
import { GLASS } from '@/components/Glass';
import { softTint } from '@/components/softTint';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ACTION_ICON: Partial<Record<NeedsYouItem['action'], React.ComponentProps<typeof Feather>['name']>> = {
  loans: 'calendar',
  backup: 'folder',
  reports: 'trending-up',
  tidy: 'check-square',
  recurring: 'repeat',
  payCard: 'credit-card',
};

/**
 * One Needs you item on the bell's screen, in a glass list: a rail on its left edge and its icon in the colour
 * of how urgent it is, title and line, amount, then Later or ✕. `onDismiss` adds the ✕; without it the row
 * ends in a chevron.
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
  const tone = NEEDS_TONE[item.tone];
  const icon = ACTION_ICON[item.action] ?? tone.icon;
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.detail}${item.amountMinor != null ? `, ${formatMoney(item.amountMinor)}` : ''}`}
      style={[styles.row, divider && styles.divider, animatedStyle]}
    >
      <View style={[styles.rail, { backgroundColor: tone.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: softTint(tone.color, 0.14) }]}>
        <Feather name={icon} size={SCREEN.iconGlyph} color={tone.color} />
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
  row: { ...h.row, paddingLeft: 20 },
  // How urgent, at a glance down the list's left edge.
  rail: { position: 'absolute', left: 8, top: 14, bottom: 14, width: 4, borderRadius: 2 },
  divider: h.divider,
  // A circle rather than the square tile (the Home A sign-off: round icons on Home).
  iconWrap: { ...h.iconTile, borderRadius: SCREEN.iconTile / 2 },
  mid: h.mid,
  title: h.title,
  sub: h.sub,
  subUrgent: h.subUrgent,
  amount: h.amount,
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,32,51,0.06)',
  },
  later: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  laterText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textSecondary },
});
