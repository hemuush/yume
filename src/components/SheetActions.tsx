import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/hooks/usePressScale';
import { themedStyles } from '@/theme/themedStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A sheet's pinned action bar: the main button(s), with an optional round button in front, a red bin for
 * Delete (never a full-width Delete as loud as Save) or ⋯ for a menu of rarer actions.
 */
export function SheetFooter({
  children,
  onDelete,
  deleteLabel = 'Delete',
  onMore,
  moreLabel = 'More actions',
  disabled,
}: {
  children?: React.ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
  onMore?: () => void;
  moreLabel?: string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.footerRow}>
      {onDelete && (
        <RoundFooterButton icon="trash-2" label={deleteLabel} onPress={onDelete} disabled={disabled} danger />
      )}
      {onMore && (
        <RoundFooterButton icon="more-horizontal" label={moreLabel} onPress={onMore} disabled={disabled} />
      )}
      {children}
    </View>
  );
}

/**
 * A quiet text action at the end of a sheet ("Delete recurring entry", "Archive goal") for rarer, riskier
 * things, so they never sit in the footer beside Save.
 */
export function SheetLink({
  label,
  onPress,
  danger = true,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, (pressed || disabled) && styles.disabled]}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="button"
    >
      <Text style={[styles.linkText, danger && styles.linkDanger]}>{label}</Text>
    </Pressable>
  );
}

function RoundFooterButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: 'trash-2' | 'more-horizontal';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      style={[styles.roundBtn, danger && styles.roundBtnDanger, animatedStyle, disabled && styles.disabled]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color={danger ? theme.colors.expense : theme.colors.ink} />
    </AnimatedPressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    footerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    roundBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundBtnDanger: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.expenseTint },
    disabled: { opacity: theme.opacity.disabled },
    link: {
      alignSelf: 'center',
      minHeight: 44,
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    linkText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textPrimary },
    linkDanger: { color: theme.colors.expenseText },
  })
);
