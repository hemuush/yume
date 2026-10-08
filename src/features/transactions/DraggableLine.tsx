import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

/**
 * A day's line draggable once held (TimelineDay lifts it on long press); lifted, it takes over touch from the
 * row press and list scroll and follows the finger; others slide aside by `shift`. The day picks the landing.
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
  const { accent } = useAccent();
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
        lifted && [styles.lifted, { backgroundColor: shade(accent, 97) }],
        { transform: lifted ? [{ translateY: dy }, { scale: 1.02 }] : [{ translateY: shift }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Lifted out of the card: a white-ish tile with a soft drop, a touch larger than the rest.
  lifted: {
    zIndex: 2,
    borderRadius: 16,
    boxShadow: '0px 10px 24px rgba(16,32,51,0.18)',
  },
});
