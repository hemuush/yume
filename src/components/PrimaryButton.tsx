import { Animated, Pressable, Text, StyleSheet, PressableProps } from 'react-native';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary';
}

/**
 * The one button in the app. Primary is a solid ink pill (fixed brand
 * colour, not the user's accent — a CTA shouldn't turn blue/pink with the
 * accent setting); secondary is a quiet hairline-outlined pill.
 */
export function PrimaryButton({ title, variant = 'primary', style, disabled, ...rest }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const secondary = variant === 'secondary';
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.base,
        secondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        animatedStyle,
        style as any,
      ]}
      {...rest}
    >
      <Text style={[styles.text, secondary ? styles.textSecondary : styles.textPrimary]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: theme.colors.ink },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  text: { fontFamily: theme.font.roundedBold, fontSize: 15 },
  textPrimary: { color: theme.colors.surface },
  textSecondary: { color: theme.colors.textPrimary },
  disabled: { opacity: 0.45 },
});
