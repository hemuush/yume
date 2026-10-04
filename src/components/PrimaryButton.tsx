import { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { MAX_FONT_SCALE } from '@/components/Text';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { DURATIONS } from '@/lib/motionTimings';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HIT_SLOP = { top: 3, bottom: 3 };
const HIT_SLOP_COMPACT = { top: 9, bottom: 9, left: 4, right: 4 };

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  /**
   * Shows a checkmark in place of the title, for buttons that finish something (Pay, Save, Restore).
   * The caller owns timing: flip it true after the action succeeds, hold ~300-400ms, then close/navigate.
   */
  done?: boolean;
  doneLabel?: string;
  /** A smaller pill for a button that sits inside a row (a Restore beside a backup). */
  compact?: boolean;
}

/**
 * The one button in the app. Primary is a solid ink pill (fixed brand colour, not the user's accent);
 * secondary is a quiet cream pill with a hairline; danger is the red one a confirm dialog uses for Delete.
 */
export function PrimaryButton({
  title,
  variant = 'primary',
  style,
  disabled,
  done,
  doneLabel = 'Done',
  compact,
  ...rest
}: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  // Fires once as the checkmark comes in; every Pay/Save/Restore confirm funnels through `done`,
  // so none needs its own haptic.
  useEffect(() => {
    if (done) haptics.confirm();
  }, [done]);
  const secondary = variant === 'secondary';
  const variantStyle = styles[variant];
  const textStyle = secondary ? styles.textSecondary : styles.textPrimary;
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.base,
        compact && styles.baseCompact,
        variantStyle,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      // Regular buttons are ~42dp tall and compact ones ~30dp; the slop lifts both to 48dp unseen.
      hitSlop={compact ? HIT_SLOP_COMPACT : HIT_SLOP}
      {...rest}
    >
      {/* `key` forces a remount on the label/done swap so `entering` — which
          only plays once, on mount — replays every time instead of just the
          first. There's no matching `exiting`: the old text disappears the
          instant the new one mounts, which reads fine since it's masked by
          the concurrent press-scale settle. */}
      <ReanimatedAnimated.Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        key={done ? 'done' : 'label'}
        entering={FadeIn.duration(DURATIONS.quick)}
        style={[styles.text, compact && styles.textCompact, textStyle]}
      >
        {done ? `✓ ${doneLabel}` : title}
      </ReanimatedAnimated.Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseCompact: { paddingVertical: 7, paddingHorizontal: 14 },
  textCompact: { fontFamily: theme.font.roundedBold, fontSize: 13 },
  primary: { backgroundColor: theme.colors.ink },
  danger: { backgroundColor: theme.colors.expense },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  text: { fontFamily: theme.font.roundedBold, fontSize: 15 },
  textPrimary: { color: theme.colors.surface },
  textSecondary: { color: theme.colors.textPrimary },
  disabled: { opacity: 0.45 },
});
