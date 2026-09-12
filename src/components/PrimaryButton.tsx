import { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, PressableProps } from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary';
  /**
   * Shows a checkmark in place of the title, fading in — the "Confirm
   * Morph" reserved for the handful of buttons that actually finish
   * something (Pay, Save, Restore, a destructive delete inside a custom
   * sheet). The caller owns the timing: flip this true right after the real
   * action succeeds, hold it briefly (~300-400ms reads as a genuine "done"
   * beat without feeling slow), then do whatever used to happen immediately
   * (close the sheet, navigate away). Most buttons never pass this at all.
   */
  done?: boolean;
  doneLabel?: string;
}

/**
 * The one button in the app. Primary is a solid ink pill (fixed brand
 * colour, not the user's accent — a CTA shouldn't turn blue/pink with the
 * accent setting); secondary is a quiet hairline-outlined pill.
 */
export function PrimaryButton({
  title,
  variant = 'primary',
  style,
  disabled,
  done,
  doneLabel = 'Done',
  ...rest
}: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  // Fires once, right as the checkmark comes in — covers every Pay/Save/
  // Restore confirm in the app for free, since they all funnel through this
  // one `done` prop rather than each caller wiring its own haptic.
  useEffect(() => {
    if (done) haptics.confirm();
  }, [done]);
  const secondary = variant === 'secondary';
  const variantStyle = secondary ? styles.secondary : styles.primary;
  const textStyle = secondary ? styles.textSecondary : styles.textPrimary;
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.base, variantStyle, disabled && styles.disabled, animatedStyle, style as any]}
      {...rest}
    >
      {/* `key` forces a remount on the label/done swap so `entering` — which
          only plays once, on mount — replays every time instead of just the
          first. There's no matching `exiting`: the old text disappears the
          instant the new one mounts, which reads fine since it's masked by
          the concurrent press-scale settle. */}
      <ReanimatedAnimated.Text
        key={done ? 'done' : 'label'}
        entering={FadeIn.duration(140)}
        style={[styles.text, textStyle]}
      >
        {done ? `✓ ${doneLabel}` : title}
      </ReanimatedAnimated.Text>
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
