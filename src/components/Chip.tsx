import { Animated, Pressable, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  /** When set, the active chip tints to this colour (used for category chips). */
  activeBorderColor?: string;
}

// The selectable pill used for account/category/type pickers across every
// "Add ___" modal — one accent-aware component instead of four copy-pastes.
export function Chip({ label, active, onPress, activeBorderColor }: Props) {
  const tinted = active && activeBorderColor;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);
  return (
    <AnimatedPressable
      style={[
        styles.chip,
        active && !tinted && styles.chipActive,
        tinted && { backgroundColor: activeBorderColor + '1A', borderColor: activeBorderColor },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryTint,
    borderColor: theme.colors.secondary,
  },
  text: { fontSize: 12.5, color: theme.colors.textSecondary, fontFamily: theme.font.roundedMedium },
  textActive: { color: theme.colors.textPrimary, fontFamily: theme.font.roundedBold },
});
