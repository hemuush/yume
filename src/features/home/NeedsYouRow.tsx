import { useState } from 'react';
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
import { softTint } from '@/components/softTint';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ACTION_ICON: Partial<Record<NeedsYouItem['action'], React.ComponentProps<typeof Feather>['name']>> = {
  loans: 'calendar',
  backup: 'folder',
  reports: 'trending-up',
  tidy: 'check-square',
  recurring: 'repeat',
  payCard: 'credit-card',
};

/** The one word on the row's button: what tapping it does. */
const ACTION_VERB: Record<NeedsYouItem['action'], string> = {
  loans: 'Pay',
  payCard: 'Pay',
  budgets: 'Open',
  backup: 'Set up',
  tidy: 'Review',
  recurring: 'Set up',
  reports: 'See why',
};

/**
 * One Needs you item on the bell's screen, in a flat card: its icon in a circle tinted by how urgent it is,
 * title and line, amount, then a button saying what it does. "…" opens Later (a backup reminder) and Dismiss
 * under the row. Without `onDismiss` (an item already dismissed) the button is "Show again" instead.
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
  /** The dismiss action's spoken label — "Show again" on an already-dismissed row. */
  dismissLabel?: string;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const [menu, setMenu] = useState(false);
  const tone = NEEDS_TONE[item.tone];
  const icon = ACTION_ICON[item.action] ?? tone.icon;
  const restoring = dismissLabel !== 'Dismiss';
  return (
    <View style={divider && styles.divider}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.detail}${item.amountMinor != null ? `, ${formatMoney(item.amountMinor, item.currency)}` : ''}`}
        style={[styles.row, animatedStyle]}
      >
        <View style={[styles.iconWrap, { backgroundColor: softTint(tone.color, 0.16) }]}>
          <Feather name={icon} size={SCREEN.iconGlyph} color={tone.color} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={[styles.sub, item.tone === 'urgent' && styles.subUrgent]}>{item.detail}</Text>
        </View>
        {item.amountMinor != null && (
          <Text style={styles.amount}>{formatMoney(item.amountMinor, item.currency)}</Text>
        )}
        {restoring ? (
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={`${dismissLabel}: ${item.title}`}
            style={withPressed(styles.ghost)}
          >
            <Text style={styles.ghostText}>{dismissLabel}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={`${ACTION_VERB[item.action]}: ${item.title}`}
              style={withPressed([styles.cta, { backgroundColor: softTint(accent, 0.42) }])}
            >
              <Text style={[styles.ctaText, { color: ink }]}>{ACTION_VERB[item.action]}</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenu((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: menu }}
              accessibilityLabel={`More for ${item.title}`}
              style={withPressed(styles.more)}
            >
              <Feather name="more-horizontal" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          </>
        )}
      </AnimatedPressable>
      {menu && !restoring && (
        <View style={styles.menu}>
          {item.snoozable && (
            <Pressable
              onPress={() => {
                setMenu(false);
                onSnooze();
              }}
              accessibilityRole="button"
              accessibilityLabel="Remind me later"
              style={withPressed(styles.ghost)}
            >
              <Text style={styles.ghostText}>Later</Text>
            </Pressable>
          )}
          {onDismiss && (
            <Pressable
              onPress={() => {
                setMenu(false);
                onDismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${dismissLabel}: ${item.title}`}
              style={withPressed(styles.ghost)}
            >
              <Text style={styles.ghostText}>Dismiss</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { ...h.row },
  divider: h.divider,
  iconWrap: { ...h.iconTile, borderRadius: SCREEN.iconTile / 2 },
  mid: h.mid,
  title: h.title,
  sub: h.sub,
  subUrgent: h.subUrgent,
  amount: h.amount,
  cta: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: theme.font.bodyBold, fontSize: 12.5 },
  more: { width: 44, minHeight: 44, marginRight: -10, alignItems: 'center', justifyContent: 'center' },
  menu: { flexDirection: 'row', gap: 8, paddingLeft: 56, paddingBottom: 10, paddingRight: 12 },
  ghost: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.tray,
  },
  ghostText: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textPrimary },
});
