import { Animated, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { softTint } from '@/components/softTint';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HIT_SLOP = { top: 9, bottom: 9, left: 4, right: 4 };

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  /** When set, the active chip tints to this colour (used for category chips). */
  activeBorderColor?: string;
  /** A small round icon before the label (a category's or an account's). */
  icon?: string;
  /** The icon disc's colour; defaults to a pale wash of `activeBorderColor`. */
  iconColor?: string;
  /** A "›" after the label: tapping opens more (a category's subcategories). */
  more?: boolean;
}

// The selectable pill used for account/category/type pickers across every
// "Add ___" modal — one accent-aware component instead of four copy-pastes.
export function Chip({ label, active, onPress, activeBorderColor, icon, iconColor, more }: Props) {
  const tinted = active && activeBorderColor;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);
  const { accent, secondary } = useAccent();
  return (
    <AnimatedPressable
      style={[
        styles.chip,
        icon && styles.chipWithIcon,
        active && !tinted && { backgroundColor: shade(accent, 95), borderColor: secondary },
        tinted && { backgroundColor: softTint(activeBorderColor, 0.1), borderColor: activeBorderColor },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      // The pill is ~30dp tall; the slop lifts the touch target to 48dp without changing how it looks.
      hitSlop={HIT_SLOP}
    >
      {icon && (
        <View
          style={[
            styles.iconDisc,
            { backgroundColor: iconColor ?? softTint(activeBorderColor ?? accent, 0.3) },
          ]}
        >
          <MaterialCommunityIcons name={icon as McIconName} size={13} color={theme.colors.ink} />
        </View>
      )}
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
        {more ? ' ›' : ''}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  chipWithIcon: { paddingLeft: 4, paddingVertical: 4 },
  iconDisc: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 12.5, color: theme.colors.textSecondary, fontFamily: theme.font.roundedMedium },
  textActive: { color: theme.colors.textPrimary, fontFamily: theme.font.roundedBold },
});
