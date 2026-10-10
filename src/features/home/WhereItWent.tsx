import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import type { McIconName } from '@/components/iconName';
import type { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { DIAL, dialPill, dialPoint, dialSpans } from './categoryDial';
import { homeInk } from './homeInk';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Categories on the dial; the rest are one tap away in Reports (the last bubble). */
export const DIAL_CATEGORIES = 4;

/**
 * "Where it went": the period's spending on the left, and a curved dial of its biggest categories on the
 * right. The picked category stretches into a dark pill with its share; tap another bubble and the pill
 * glides there. The last bubble opens Reports.
 */
export function WhereItWent({
  breakdown,
  iconFor,
  spentMinor,
  previousSpentMinor,
  periodName,
  previousName,
  onOpenReports,
}: {
  /** The period's spending by category, biggest first, with hidden (sensitive) groups already left out. */
  breakdown: CategoryBreakdownItem[];
  iconFor: (categoryId: string) => string | undefined;
  spentMinor: number;
  previousSpentMinor: number;
  /** "October", "2026" */
  periodName: string;
  /** "Sep", "2025" */
  previousName: string;
  onOpenReports: () => void;
}) {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const reduce = useReduceMotion();
  const top = breakdown.filter((c) => c.totalMinor > 0).slice(0, DIAL_CATEGORIES);
  const count = top.length + 1; // + the Reports bubble
  const total = breakdown.reduce((s, c) => s + Math.max(0, c.totalMinor), 0);
  const [picked, setPicked] = useState(top[0]?.categoryId);
  const [settled, setSettled] = useState(top[0]?.categoryId);
  const [width, setWidth] = useState(0);
  const sel = useSharedValue(0);
  const index = Math.max(
    0,
    top.findIndex((c) => c.categoryId === picked)
  );
  const targetKey = top[index]?.categoryId;

  useEffect(() => {
    let active = true;
    cancelAnimation(sel);
    const commit = () => {
      if (active) setSettled(targetKey);
    };
    if (reduce) {
      sel.value = index;
      commit();
    } else {
      sel.value = withTiming(index, timing(420), (finished) => {
        if (finished) runOnJS(commit)();
      });
    }
    return () => {
      active = false;
      cancelAnimation(sel);
    };
  }, [index, targetKey, count, reduce, sel]);

  const pillProps = useAnimatedProps(() => {
    const [a0, a1] = dialPill(count, sel.value);
    const inset = 6.5; // the round caps add half the pill's thickness at each end
    const p0 = dialPoint(a0 + inset);
    const p1 = dialPoint(a1 - inset);
    return { d: `M${p0.x} ${p0.y} A${DIAL.r} ${DIAL.r} 0 0 1 ${p1.x} ${p1.y}` };
  });
  const iconStyle = useAnimatedStyle(() => {
    const [a0] = dialPill(count, sel.value);
    const p = dialPoint(a0 + 7.5);
    return { transform: [{ translateX: p.x - 15 }, { translateY: p.y - 15 }] };
  });
  const shareStyle = useAnimatedStyle(() => {
    const [, a1] = dialPill(count, sel.value);
    const a = a1 - 10.5;
    const p = dialPoint(a);
    return { transform: [{ translateX: p.x - 24 }, { translateY: p.y - 9 }, { rotate: `${a + 90}deg` }] };
  });

  if (top.length === 0) return null;
  const current = top.find((c) => c.categoryId === settled) ?? top[0];
  const share = total > 0 ? Math.round((current.totalMinor / total) * 100) : 0;
  const diff = spentMinor - previousSpentMinor;

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.text, width > 0 && { maxWidth: Math.min(200, Math.max(0, width - 125)) }]}>
        <Text style={styles.k}>Spent in {periodName}</Text>
        <Text style={styles.v} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(spentMinor)}
        </Text>
        {previousSpentMinor > 0 && diff !== 0 && (
          <View style={styles.chip}>
            <Feather
              name={diff < 0 ? 'arrow-down-right' : 'arrow-up-right'}
              size={13}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {formatMoney(Math.abs(diff))} {diff < 0 ? 'less' : 'more'} than {previousName}
            </Text>
          </View>
        )}
        <View style={styles.sel}>
          <Text style={styles.selName} numberOfLines={1}>
            {current.name}
          </Text>
          <Text style={styles.selSub} numberOfLines={1}>
            {formatMoney(current.totalMinor)} · {share}% of spending
          </Text>
        </View>
      </View>

      <View style={styles.dial}>
        <Svg width={DIAL.width} height={DIAL.height} style={StyleSheet.absoluteFill}>
          <AnimatedPath
            animatedProps={pillProps}
            stroke={ink}
            strokeWidth={DIAL.thick}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        {top.map((c, i) => (
          <Bubble
            key={c.categoryId}
            i={i}
            count={count}
            sel={sel}
            label={`${c.name}, ${total > 0 ? Math.round((c.totalMinor / total) * 100) : 0}% of spending`}
            selected={i === index}
            onPress={() => {
              if (i === index) return;
              haptics.tap();
              setPicked(c.categoryId);
            }}
          >
            <MaterialCommunityIcons
              name={(iconFor(c.categoryId) ?? 'tag') as McIconName}
              size={16}
              color={theme.colors.ink}
            />
          </Bubble>
        ))}
        <Bubble
          i={top.length}
          count={count}
          sel={sel}
          label="All categories in Reports"
          onPress={onOpenReports}
        >
          <Feather name="more-horizontal" size={16} color={theme.colors.textSecondary} />
        </Bubble>
        <Animated.View pointerEvents="none" style={[styles.pillIcon, iconStyle]}>
          <MaterialCommunityIcons
            name={(iconFor(current.categoryId) ?? 'tag') as McIconName}
            size={16}
            color={theme.colors.white}
          />
        </Animated.View>
        <Animated.Text pointerEvents="none" maxFontSizeMultiplier={1} style={[styles.share, shareStyle]}>
          {share}%
        </Animated.Text>
      </View>
    </View>
  );
}

function Bubble({
  i,
  count,
  sel,
  label,
  selected = false,
  onPress,
  children,
}: {
  i: number;
  count: number;
  sel: { value: number };
  label: string;
  selected?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const [a0, a1] = dialSpans(count, sel.value)[i];
    const p = dialPoint((a0 + a1) / 2);
    return {
      transform: [{ translateX: p.x - DIAL.dot / 2 }, { translateY: p.y - DIAL.dot / 2 }],
      // The picked one melts into the pill.
      opacity: Math.min(1, Math.abs(i - sel.value) * 1.4),
    };
  });
  return (
    <Animated.View style={[styles.bubbleSlot, style]}>
      <Pressable
        onPress={onPress}
        hitSlop={4}
        style={styles.bubble}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, height: DIAL.height, justifyContent: 'center' },
  text: { maxWidth: 200, gap: 6 },
  k: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textMuted },
  v: {
    fontFamily: theme.font.bodyLight,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1,
    color: theme.colors.textPrimary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(18,19,15,0.1)',
  },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  sel: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(18,19,15,0.12)',
  },
  selName: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  selSub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, marginTop: 2 },
  dial: { position: 'absolute', right: 0, top: 0, width: DIAL.width, height: DIAL.height },
  bubbleSlot: { position: 'absolute', left: 0, top: 0, width: DIAL.dot, height: DIAL.dot },
  bubble: {
    flex: 1,
    borderRadius: DIAL.dot / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  pillIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  share: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.white,
  },
});
