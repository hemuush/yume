import { Animated, Pressable, Text, StyleSheet, PressableProps } from 'react-native';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary';
}

export function PrimaryButton({ title, variant = 'primary', style, disabled, ...rest }: Props) {
  const { accent, onAccent } = useAccent();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.base,
        variant === 'secondary' ? styles.secondary : { backgroundColor: accent },
        disabled && styles.disabled,
        animatedStyle,
        style as any,
      ]}
      {...rest}
    >
      <Text style={[styles.text, variant === 'secondary' ? styles.textSecondary : { color: onAccent }]}>
        {title}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
  },
  secondary: { backgroundColor: theme.colors.surfaceAlt },
  text: { fontFamily: theme.font.bodyBold, fontSize: 15 },
  textSecondary: { color: theme.colors.textPrimary },
  disabled: { opacity: 0.5 },
});
