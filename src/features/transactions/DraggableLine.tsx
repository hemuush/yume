import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/**
 * One line of a day that can be dragged once it has been held (TimelineDay
 * lifts it on a long press). While it is lifted this takes over the touch from
 * the row's own press and the list's scroll, and follows the finger; the
 * other lines slide aside by `shift`. The day decides where it lands.
 */
export function DraggableLine({
  lifted,
  shift,
  dy,
  onHeight,
  onMove,
  onEnd,
  children,
}: {
  lifted: boolean;
  /** How far this line makes room for the lifted one (px, + down). */
  shift: number;
  dy: Animated.Value;
  onHeight: (height: number) => void;
  onMove: (dy: number) => void;
  /** The finger lifted, or the touch was taken away. Called possibly twice; the day ignores the repeat. */
  onEnd: () => void;
  children: ReactNode;
}) {
  const latest = useRef({ lifted, dy, onMove, onEnd });
  useEffect(() => {
    latest.current = { lifted, dy, onMove, onEnd };
  });
  // eslint-disable-next-line react-hooks/refs -- `latest` is only read inside gesture callbacks, as in useSwipeStep
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: () => latest.current.lifted,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        latest.current.dy.setValue(g.dy);
        latest.current.onMove(g.dy);
      },
      onPanResponderRelease: () => latest.current.onEnd(),
      onPanResponderTerminate: () => latest.current.onEnd(),
    })
  );

  return (
    <Animated.View
      {...pan.panHandlers}
      onTouchEnd={() => latest.current.lifted && latest.current.onEnd()}
      onTouchCancel={() => latest.current.lifted && latest.current.onEnd()}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[
        lifted && styles.lifted,
        { transform: lifted ? [{ translateY: dy }] : [{ translateY: shift }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lifted: {
    zIndex: 2,
    backgroundColor: theme.colors.primaryTint,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
});
