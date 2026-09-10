import { useState, useEffect } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ value, onChange, disabled }: Props) {
  const { accent } = useAccent();
  const [anim] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, anim]);

  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
    >
      {/* Track colour is driven straight off `value`, not the animation, so
          the switch always shows its true state even if the slide animation
          was skipped (e.g. this screen re-rendered after being off-screen).
          `anim` only slides the knob. */}
      <View
        style={[
          styles.track,
          { backgroundColor: value ? accent : theme.colors.surface },
          disabled && styles.disabled,
        ]}
      >
        <Animated.View style={[styles.knob, { left: knobLeft }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    justifyContent: 'center',
  },
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
