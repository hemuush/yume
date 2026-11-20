import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { softTint } from '@/components/softTint';
import { useAccent } from '@/theme/AccentContext';
import { themedStyles } from '@/theme/themedStyles';

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
  ledgerStyle?: boolean;
}

// The selectable pill used for account/category/type pickers across every
// "Add ___" modal — one accent-aware component instead of four copy-pastes.
export function Chip({
  label,
  active,
  onPress,
  activeBorderColor,
  icon,
  iconColor,
  more,
  ledgerStyle = false,
}: Props) {
  const tinted = active && activeBorderColor;
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);
  const { accent } = useAccent();
  return (
    <AnimatedPressable
      style={[
        styles.chip,
        icon && styles.chipWithIcon,
        // Chosen: filled with ink, like the picked filter chips on Activity.
        ledgerStyle && styles.ledgerChip,
        ledgerStyle && active && styles.ledgerSelected,
        !ledgerStyle &&
          active &&
          !tinted && { backgroundColor: theme.colors.action, borderColor: theme.colors.ink },
        !ledgerStyle &&
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
          <CategoryGlyph name={icon} size={13} color={theme.colors.ink} />
        </View>
      )}
      <Text
        style={[
          styles.text,
          ledgerStyle && styles.ledgerText,
          active && styles.textActive,
          active && !tinted && !ledgerStyle && styles.textOnInk,
        ]}
      >
        {label}
        {more ? ' ›' : ''}
      </Text>
    </AnimatedPressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      maxWidth: '100%',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
    },
    chipWithIcon: { paddingLeft: 4, paddingVertical: 4 },
    ledgerChip: {
      minHeight: 36,
      backgroundColor: theme.colors.home.surface,
      borderColor: theme.colors.home.edge,
    },
    ledgerSelected: { backgroundColor: theme.colors.home.selected, borderColor: theme.colors.home.selected },
    ledgerText: { color: theme.colors.home.secondaryText },
    iconDisc: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    text: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontFamily: theme.font.body,
      flexShrink: 1,
    },
    textActive: { color: theme.colors.textPrimary, fontFamily: theme.font.bodyMedium },
    textOnInk: { color: theme.colors.onInk },
  })
);
