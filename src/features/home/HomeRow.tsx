import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { StatusBadge } from '@/components/StatusBadge';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { useCardGrow } from '@/lib/cardGrow';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';

import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One shape for the rows of Home's Upcoming, Budgets and Goals pages, so the three read as one list. */
const HOME_ROW_HEIGHT = 64;

export type HomeRowChipTone = 'neutral' | 'due' | 'warning' | 'complete';

/**
 * A leading mark (date tile or progress ring), a title with one grey line under it, and the value on the right
 * with a small status chip under it; an optional pill button ("Pay") takes the chevron's place. `grow`: the page
 * it opens expands out of this row (the caller marks that push with `growHref`).
 */
export function HomeRow({
  leading,
  title,
  subtitle,
  subtitleTone,
  value,
  valueTone,
  chip,
  action,
  onPress,
  divider,
  highlight,
  grow,
  accessibilityLabel,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle?: string;
  subtitleTone?: 'urgent' | 'soon';
  value?: string;
  valueTone?: 'over' | 'income';
  chip?: { label: string; tone: HomeRowChipTone };
  action?: string;
  onPress: () => void;
  divider?: boolean;
  /** A pale amber panel behind the row (a bill due soon). */
  highlight?: boolean;
  grow?: boolean;
  accessibilityLabel: string;
}) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const { ref, growFrom } = useCardGrow();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      ref={ref}
      collapsable={false}
      onPress={grow ? () => growFrom(onPress) : onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, divider && styles.divider, highlight && styles.highlight, animatedStyle]}
    >
      <View style={styles.lead}>{leading}</View>
      <View style={styles.mid}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.sub,
              subtitleTone === 'urgent' ? h.subUrgent : subtitleTone === 'soon' && h.subSoon,
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {(value || chip) && (
        <View style={styles.end}>
          {value ? (
            <Text
              style={[styles.value, valueTone === 'over' && h.expense, valueTone === 'income' && h.income]}
              numberOfLines={1}
            >
              {value}
            </Text>
          ) : null}
          {chip ? <StatusBadge label={chip.label} tone={chip.tone} /> : null}
        </View>
      )}
      {action ? (
        <View style={[styles.action, { backgroundColor: ink }]}>
          <Text style={styles.actionText}>{action}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { ...h.row, minHeight: HOME_ROW_HEIGHT, gap: 12 },
  divider: h.divider,
  lead: { width: SCREEN.lead, alignItems: 'center', justifyContent: 'center' },
  highlight: {
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderTopWidth: 0,
    backgroundColor: theme.colors.dueRow,
  },
  mid: h.mid,
  title: h.title,
  sub: { ...h.sub, marginTop: 2, lineHeight: 18 },
  end: { flexShrink: 0, alignItems: 'flex-end', gap: 4, maxWidth: '45%' },
  value: h.amount,
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  actionText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.white },
});
