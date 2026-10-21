import { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Easing, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { GLASS } from '@/components/Glass';
import { haptics } from '@/lib/haptics';
import { usePressScale } from '@/lib/usePressScale';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';

import { useAccent } from '@/theme/AccentContext';
import { interactionColors } from '@/theme/interactionColors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The track's inner padding, which the pill sits inside. */
const PAD = 4;

interface Props<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  /** On a coloured band (Add's sky header): a see-through track and an ink pill. */
  onBand?: boolean;
  disabled?: boolean;
}

/**
 * A pill switch: one theme-ink pill, measured from the track and moved with the native driver, glides to the
 * tapped choice instead of each segment snapping its own background. Reduce motion: it jumps.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  onBand,
  disabled = false,
}: Props<T>) {
  const reduce = useReduceMotion();
  const { accent } = useAccent();
  const colors = interactionColors(accent);
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
    x.stopAnimation();
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
    return () => x.stopAnimation();
  }, [index, segWidth, reduce, x]);

  const onLayout = (e: LayoutChangeEvent) => {
    setInnerWidth(Math.max(0, e.nativeEvent.layout.width - PAD * 2));
  };

  return (
    <View
      style={[styles.wrap, onBand && styles.wrapBand, disabled && styles.disabled]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      {segWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { backgroundColor: colors.ink, borderColor: colors.ink },
            { width: segWidth, transform: [{ translateX: x }] },
          ]}
        />
      )}
      {options.map((opt) => (
        <Segment
          key={opt.value}
          active={opt.value === value}
          fallbackInk={segWidth <= 0 ? colors.ink : undefined}
          label={opt.label}
          disabled={disabled}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

function Segment({
  active,
  label,
  onPress,
  fallbackInk,
  disabled,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  fallbackInk?: string;
  disabled: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <AnimatedPressable
      style={[
        styles.segment,
        active && fallbackInk ? { backgroundColor: fallbackInk } : undefined,
        animatedStyle,
      ]}
      onPress={() => {
        // A light tick when the choice actually changes — every switch in the app gets it here.
        if (active || disabled) return;
        haptics.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
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
  segment: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontFamily: theme.font.roundedMedium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  segmentTextActive: { color: theme.colors.surface, fontFamily: theme.font.roundedBold },
  // On a wallpaper (Add's header): a frosted track and an ink pill.
  wrapBand: { backgroundColor: GLASS.fill, borderWidth: 1, borderColor: GLASS.edge, marginBottom: 0 },
  disabled: { opacity: 0.5 },
});
