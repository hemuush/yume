import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { MAX_FONT_SCALE } from '@/components/Text';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { useUiScale } from '@/lib/uiScale';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/lib/useReduceMotion';

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
  /** A small icon before the title (Add's ✓ on Save). Hidden while `done` shows its own tick. */
  icon?: React.ComponentProps<typeof Feather>['name'];
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
  icon,
  ...rest
}: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const uiScale = useUiScale();
  const reduceMotion = useReduceMotion();
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
        // Padding follows the font size at half rate; the default (1) leaves the designed 12 / 7.
        { paddingVertical: Math.round((compact ? 7 : 12) * uiScale) },
        variantStyle,
        icon && !done && styles.withIcon,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      // Both variants have a 44dp minimum height; slop gives tightly spaced controls extra reach.
      hitSlop={compact ? HIT_SLOP_COMPACT : HIT_SLOP}
      {...rest}
    >
      {/* `key` forces a remount on the label/done swap so `entering` — which
          only plays once, on mount — replays every time instead of just the
          first. There's no matching `exiting`: the old text disappears the
          instant the new one mounts, which reads fine since it's masked by
          the concurrent press-scale settle. */}
      {icon && !done && (
        <Feather
          name={icon}
          size={compact ? 14 : 17}
          color={secondary ? theme.colors.textPrimary : theme.colors.white}
        />
      )}
      <ReanimatedAnimated.Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        key={done ? 'done' : 'label'}
        entering={reduceMotion ? undefined : FadeIn.duration(DURATIONS.quick)}
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
    minHeight: 44,
  },
  baseCompact: { paddingVertical: 7, paddingHorizontal: 14 },
  withIcon: { flexDirection: 'row', gap: 8 },
  textCompact: { fontFamily: theme.font.roundedBold, fontSize: 13 },
  primary: { backgroundColor: theme.colors.ink },
  danger: { backgroundColor: theme.colors.expense },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  text: { fontFamily: theme.font.roundedBold, fontSize: 15, textAlign: 'center', flexShrink: 1 },
  textPrimary: { color: theme.colors.surface },
  textSecondary: { color: theme.colors.textPrimary },
  disabled: { opacity: 0.45 },
});
