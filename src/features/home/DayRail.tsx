import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, PanResponder, Animated, Easing } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { Rail, railDayLabel, tickLevels } from './dayRail';

const MAX_TICK = 28;
const MIN_TICK = 6;
const FUTURE_TICK = 4;

/**
 * The month as a row of spending ticks, one per day. Drag across it to travel through the month: Home's
 * figures, ring and moon show that day, and letting go glides them back to today. `selected` is the day
 * being shown, or null for today. A screen reader steps one day at a time.
 */
export function DayRail({
  rail,
  monthName,
  selected,
  onSelect,
}: {
  rail: Rail;
  monthName: string;
  selected: number | null;
  onSelect: (day: number | null) => void;
}) {
  const reduce = useReduceMotion();
  const levels = tickLevels(rail);
  const width = useRef(0);
  const shown = useRef<number | null>(selected);
  const latest = useRef({ rail, onSelect });
  useEffect(() => {
    latest.current = { rail, onSelect };
    shown.current = selected;
  });

  const dayAt = (x: number) => {
    const { rail: r } = latest.current;
    const day = Math.floor((x / Math.max(1, width.current)) * r.days.length) + 1;
    return Math.max(1, Math.min(r.todayDay, day));
  };
  const travel = (day: number) => {
    if (day === shown.current) return;
    shown.current = day;
    haptics.tap();
    latest.current.onSelect(day);
  };

  // The responder is made once and reads the latest props through refs, like the hero's swipe.
  // eslint-disable-next-line react-hooks/refs -- the refs are only read inside gesture callbacks
  const [pan] = useState(() => {
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Once a finger is on the rail it keeps the gesture: the page scroll and the hero's swipe stand aside.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX = e.nativeEvent.locationX;
        travel(dayAt(startX));
      },
      onPanResponderMove: (_, g) => travel(dayAt(startX + g.dx)),
      onPanResponderRelease: () => {
        shown.current = null;
        latest.current.onSelect(null);
      },
      onPanResponderTerminate: () => {
        shown.current = null;
        latest.current.onSelect(null);
      },
    });
  });

  const [grow] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      grow.setValue(1);
      return;
    }
    const animation = Animated.timing(grow, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduce, grow]);

  const day = selected ?? rail.todayDay;
  const traveling = selected != null && selected < rail.todayDay;
  const label = traveling ? railDayLabel(rail, day) : `Today, ${railDayLabel(rail, rail.todayDay)}`;
  const step = (delta: number) => {
    const next = Math.min(rail.todayDay, Math.max(1, day + delta));
    onSelect(next >= rail.todayDay ? null : next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>
          {traveling ? `Travelling through ${monthName}` : `Drag to travel through ${monthName}`}
        </Text>
        <Text style={styles.day}>{label}</Text>
      </View>
      <View
        {...pan.panHandlers}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Travel through ${monthName}`}
        accessibilityValue={{ text: label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        style={styles.ticks}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.ticksInner, { opacity: grow, transform: [{ scaleY: grow }] }]}
        >
          {rail.days.map((d, i) => {
            const isSelected = d.day === day && (traveling || d.day === rail.todayDay);
            const height = d.elapsed
              ? Math.max(isSelected ? 12 : MIN_TICK, Math.round(MIN_TICK + levels[i] * (MAX_TICK - MIN_TICK)))
              : FUTURE_TICK;
            return (
              <View key={d.day} style={styles.slot}>
                <View
                  style={[
                    styles.tick,
                    {
                      height,
                      backgroundColor: isSelected
                        ? theme.colors.ink
                        : d.elapsed
                          ? theme.colors.spentSoft
                          : theme.colors.trayTrack,
                    },
                  ]}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: theme.colors.tray,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },
  day: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textPrimary },
  // Taller than the ticks: a finger finds it easily.
  ticks: { marginTop: 4, height: 44, justifyContent: 'flex-end' },
  ticksInner: {
    height: MAX_TICK,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    transformOrigin: 'bottom',
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: MAX_TICK },
  tick: { width: '100%', maxWidth: 6, borderRadius: 3 },
});
