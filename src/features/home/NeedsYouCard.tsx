import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import { HomeSection } from './HomeSection';
import type { NeedsYouItem, NeedsYouTone } from './needsYou';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Home's "Needs you" block — at most three things that want action today
 * (see needsYou.ts for the rules). Renders nothing at all when there's
 * nothing, so a calm month leaves Home calmer rather than showing an empty
 * card. Rows are drawn exactly like UpcomingRow (same sizes, same card),
 * so this reads as part of Home's existing language, not a new widget.
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
}: {
  items: NeedsYouItem[];
  onOpen: (item: NeedsYouItem) => void;
  onSnooze: (item: NeedsYouItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <HomeSection title="Needs you">
      <View style={styles.card}>
        {items.map((item, i) => (
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
        <Feather name={icon} size={14} color={tone.fg} />
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
  card: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 1 },
  subUrgent: { color: theme.colors.expense, fontFamily: theme.font.bodyBold },
  amount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.expense },
  later: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  laterText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textSecondary },
});
