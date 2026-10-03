import { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Easing, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { usePressScale } from '@/lib/usePressScale';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The track's inner padding, which the pill sits inside. */
const PAD = 3;

interface Props<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A pill switch: one white pill, measured from the track and moved with the native driver, glides to the
 * tapped choice instead of each segment snapping its own background. Reduce motion: it jumps.
 */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const reduce = useReduceMotion();
  // The track's inner width; each segment's share is worked out per render, so
  // a switch whose options change (Add in edit mode) still sizes its pill right.
  const [innerWidth, setInnerWidth] = useState(0);
  const segWidth = options.length > 0 ? innerWidth / options.length : 0;
  const [x] = useState(() => new Animated.Value(0));
  const placed = useRef(false);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  useEffect(() => {
    if (segWidth === 0) return;
    const to = index * segWidth;
    // The first placement (and reduce motion) lands straight on the choice.
    if (!placed.current || reduce) {
      placed.current = true;
      x.setValue(to);
      return;
    }
    Animated.timing(x, {
      toValue: to,
      duration: DURATIONS.quick,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, segWidth, reduce, x]);

  const onLayout = (e: LayoutChangeEvent) => {
    setInnerWidth(e.nativeEvent.layout.width - PAD * 2);
  };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {segWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: segWidth, transform: [{ translateX: x }] }]}
        />
      )}
      {options.map((opt) => (
        <Segment
          key={opt.value}
          active={opt.value === value}
          label={opt.label}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <AnimatedPressable
      style={[styles.segment, animatedStyle]}
      onPress={() => {
        // A light tick when the choice actually changes — every switch in the app gets it here.
        if (!active) haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    padding: PAD,
    marginBottom: 14,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    // A hairline, not elevation: on Android an elevated view draws above its
    // later siblings, which would put the pill on top of the labels.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.pill, alignItems: 'center' },
  segmentText: { fontSize: 12.5, fontFamily: theme.font.roundedMedium, color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.textPrimary, fontFamily: theme.font.roundedBold },
});
