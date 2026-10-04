import { useState, useEffect } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { haptics } from '@/lib/haptics';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/lib/useReduceMotion';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** A smaller switch for a row of a list. */
  small?: boolean;
  accessibilityLabel?: string;
}

export function ToggleSwitch({ value, onChange, disabled, small, accessibilityLabel }: Props) {
  const { accent } = useAccent();
  const [anim] = useState(() => new Animated.Value(value ? 1 : 0));
  const reduce = useReduceMotion();

  useEffect(() => {
    // Reduce motion: the knob jumps to its place instead of sliding.
    if (reduce) {
      anim.setValue(value ? 1 : 0);
      return;
    }
    const slide = Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: DURATIONS.quick,
      useNativeDriver: false,
    });
    slide.start();
    return () => slide.stop();
  }, [value, anim, reduce]);

  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: small ? [2, 19] : [2, 22] });

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        haptics.tap();
        onChange(!value);
      }}
      disabled={disabled}
      // The track is 22-26dp tall; the slop lifts the touch target to 48dp without changing how it looks.
      hitSlop={{ top: small ? 13 : 11, bottom: small ? 13 : 11, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
    >
      {/* Track colour is driven straight off `value`, not the animation, so
          the switch always shows its true state even if the slide animation
          was skipped (e.g. this screen re-rendered after being off-screen).
          `anim` only slides the knob. */}
      <View
        style={[
          styles.track,
          small && styles.trackSmall,
          { backgroundColor: value ? accent : theme.colors.surface },
          disabled && styles.disabled,
        ]}
      >
        <Animated.View style={[styles.knob, small && styles.knobSmall, { left: knobLeft }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    justifyContent: 'center',
  },
  trackSmall: { width: 38, height: 22, borderRadius: 11 },
  knobSmall: { width: 16, height: 16, borderRadius: 8 },
  knob: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.ink,
  },
  disabled: { opacity: 0.5 },
});
