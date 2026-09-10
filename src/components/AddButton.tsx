import { Animated, Pressable, Text, StyleSheet, PressableProps } from 'react-native';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  label?: string;
}

// The small "+ Add" header button repeated across Accounts, Loans,
// Transactions, Categories and People — a compact ink pill matching the
// app's one PrimaryButton, not a bordered doodle chip.
export function AddButton({ label = '+ Add', disabled, style, ...rest }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.btn, disabled && styles.disabled, animatedStyle, style as any]}
      {...rest}
    >
      <Text style={styles.text}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  text: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.surface },
  disabled: { opacity: 0.45 },
});
