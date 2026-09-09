import { Animated, Pressable, Text, View, StyleSheet, PressableProps } from 'react-native';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  label?: string;
}

// The "+ Add" header button repeated identically (and, until now,
// inconsistently colored) across Accounts, Loans, Transactions, Categories,
// and People — one accent-aware component instead of five copies. Carries
// the same hard offset shadow every bordered shape in the Bold Bento
// direction uses — a static shadow layer behind the pressable itself, so
// the press-scale animation still applies only to the visible button.
export function AddButton({ label = '+ Add', disabled, style, ...rest }: Props) {
  const { accent, onAccent } = useAccent();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <View style={styles.wrap}>
      <View style={styles.shadow} pointerEvents="none" />
      <AnimatedPressable
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.btn,
          { backgroundColor: accent },
          disabled && styles.disabled,
          animatedStyle,
          style as any,
        ]}
        {...rest}
      >
        <Text style={[styles.text, { color: onAccent }]}>{label}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  shadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
  },
  text: { fontFamily: theme.font.bodyBold, fontSize: 14 },
  disabled: { opacity: 0.5 },
});
