import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { DURATIONS } from '@/lib/motionTimings';
import { themedStyles } from '@/theme/themedStyles';

/** How far a row must be dragged left before letting go deletes it. */
const TRIGGER_PX = 88;
/** How long a deleted row may stay hidden before it is taken to be still in the list and shown again. */
const STILL_HERE_MS = 1500;
/** Past the trigger the row follows the finger at this share, so the pull feels held, not loose. */
const PAST_TRIGGER = 0.35;

/** What the finger's drag (negative = left) does to the row: free up to the trigger, then resisted. */
export function swipeOffset(dx: number): number {
  if (dx >= 0) return 0;
  const pulled = -dx;
  return -(pulled <= TRIGGER_PX ? pulled : TRIGGER_PX + (pulled - TRIGGER_PX) * PAST_TRIGGER);
}

/** A mostly-horizontal leftward drag: a vertical one is the list scrolling. */
export function claimsSwipe(dx: number, dy: number): boolean {
  return dx < -10 && Math.abs(dx) > Math.abs(dy) * 2;
}

/**
 * A row that deletes when it is dragged left and let go: a red "Delete" shows behind it, past a point the label
 * brightens and a tick tells the finger it will go. `onDelete` says whether it did (false: it springs back, e.g.
 * a linked entry that must be undone from its detail). Delete stays in the detail sheet too, for screen readers.
 */
export function SwipeToDelete({
  children,
  onDelete,
  enabled = true,
}: {
  children: ReactNode;
  onDelete: () => Promise<boolean>;
  enabled?: boolean;
}) {
  const reduce = useReduceMotion();
  const [x] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(360);
  const latest = useRef({ enabled, onDelete, reduce, width });
  useEffect(() => {
    latest.current = { enabled, onDelete, reduce, width };
  });
  const armed = useRef(false);
  const busy = useRef(false);
  // After a delete the list is meant to drop this row; if it is still here a moment later (the reload failed) it comes
  // back into view rather than staying hidden.
  const stillHere = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (stillHere.current) clearTimeout(stillHere.current);
    },
    []
  );
  // Only while a drag is on (or the row is leaving) does the row carry the red layer, its clipping and its own
  // surface: at rest it is exactly what it wraps, with nothing behind it to show at its corners.
  const [active, setActive] = useState(false);

  const settle = (to: number, ms: number) => {
    const done = () => {
      if (to === 0) setActive(false);
    };
    if (latest.current.reduce) {
      x.setValue(to);
      done();
    } else {
      Animated.timing(x, { toValue: to, duration: ms, useNativeDriver: true }).start(({ finished }) => {
        if (finished) done();
      });
    }
  };

  // The refs are only read inside gesture callbacks (as in useSwipeStep).
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        latest.current.enabled && !busy.current && claimsSwipe(g.dx, g.dy),
      // The list's scroll must not take the row back mid-drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setActive(true),
      onPanResponderMove: (_, g) => {
        x.setValue(swipeOffset(g.dx));
        const past = -g.dx >= TRIGGER_PX;
        if (past && !armed.current) haptics.tap();
        armed.current = past;
      },
      onPanResponderRelease: (_, g) => {
        if (-g.dx < TRIGGER_PX) {
          armed.current = false;
          settle(0, DURATIONS.quick);
          return;
        }
        busy.current = true;
        settle(-latest.current.width, DURATIONS.quick);
        void latest.current
          .onDelete()
          .then((deleted) => {
            if (!deleted) settle(0, DURATIONS.standard);
            else stillHere.current = setTimeout(() => settle(0, DURATIONS.standard), STILL_HERE_MS);
          })
          .catch(() => settle(0, DURATIONS.standard))
          .finally(() => {
            busy.current = false;
            armed.current = false;
          });
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        settle(0, DURATIONS.quick);
      },
    })
  );

  // The label brightens as the row passes the trigger.
  const labelOpacity = x.interpolate({
    inputRange: [-TRIGGER_PX, -TRIGGER_PX * 0.5, 0],
    outputRange: [1, 0.55, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={active && styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {active && (
        <View style={styles.action} pointerEvents="none">
          <Animated.View style={[styles.label, { opacity: labelOpacity }]}>
            <Feather name="trash-2" size={16} color={theme.colors.onInk} />
            <Text style={styles.labelText}>Delete</Text>
          </Animated.View>
        </View>
      )}
      <Animated.View style={[active && styles.row, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    // Rounded like the rows' own pressed tint, so the red meets the card's curve at its corners.
    wrap: { overflow: 'hidden', borderRadius: theme.radius.md },
    // Behind the row, on the right: what the drag uncovers.
    action: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.colors.expense,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    label: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 20 },
    labelText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.onInk },
    // The row paints the card's own surface over the red; without one the red would show through it.
    row: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md },
  })
);
