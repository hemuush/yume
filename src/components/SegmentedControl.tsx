import { selectedFill } from '@/theme/interactionColors';
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { GLASS } from '@/components/Glass';
import { haptics } from '@/lib/haptics';
import { usePressScale } from '@/lib/usePressScale';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS, EASE_OUT } from '@/lib/motionTimings';

import { useAccent } from '@/theme/AccentContext';

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
  /** A smaller switch inside a card's heading row: 32 tall, with the touch area kept at 44. */
  compact?: boolean;
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
  compact = false,
}: Props<T>) {
  const reduce = useReduceMotion();
  const { accent } = useAccent();
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
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
    return () => x.stopAnimation();
  }, [index, segWidth, reduce, x]);

  const onLayout = (e: LayoutChangeEvent) => {
    setInnerWidth(Math.max(0, e.nativeEvent.layout.width - PAD * 2));
  };

  return (
    <View
      style={[
        styles.wrap,
        onBand && styles.wrapBand,
        compact && styles.wrapCompact,
        disabled && styles.disabled,
      ]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      {segWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { backgroundColor: selectedFill(accent) },
            { width: segWidth, transform: [{ translateX: x }] },
          ]}
        />
      )}
      {options.map((opt) => (
        <Segment
          key={opt.value}
          active={opt.value === value}
          fallbackInk={segWidth <= 0 ? selectedFill(accent) : undefined}
          label={opt.label}
          disabled={disabled}
          compact={compact}
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
  compact,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  fallbackInk?: string;
  disabled: boolean;
  compact: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <AnimatedPressable
      style={[
        styles.segment,
        compact && styles.segmentCompact,
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
      hitSlop={compact ? { top: 6, bottom: 6 } : undefined}
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
    // The chosen segment is the theme colour with ink text, not a dark fill: ink is for the one primary button.
    // No border and no elevation (on Android an elevated view draws above its later siblings, over the labels).
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 6,
    // Little side padding: the pill is drawn behind the whole segment, and a label such as "Money plan" in the
    // heavier selected weight must stay on one line in a quarter of a 360 dp phone.
    paddingHorizontal: 2,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontFamily: theme.font.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  wrapCompact: { marginBottom: 0, backgroundColor: theme.colors.tray, borderWidth: 0 },
  segmentCompact: { minHeight: 32, paddingVertical: 4, paddingHorizontal: 12 },
  segmentTextActive: { color: theme.colors.textPrimary, fontFamily: theme.font.bodyMedium },
  // On a wallpaper (Add's header): a frosted track and an ink pill.
  wrapBand: {
    backgroundColor: GLASS.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    marginBottom: 0,
  },
  disabled: { opacity: theme.opacity.disabled },
});
