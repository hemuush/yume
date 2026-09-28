import { View, Pressable, Animated, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { homeStyles as h } from '@/features/home/homeStyles';
import type { McIconName } from '@/components/iconName';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One settings row: a tinted icon tile, a label with an optional line
 * under it, then a value, a switch (`right`) or a chevron. Rows sit inside
 * one card per group (`h.card`) with a hairline between them, on Profile's
 * settings and on Notification settings alike.
 */
export function SettingsRow({
  icon,
  iconBg,
  label,
  sub,
  subColor,
  value,
  onPress,
  right,
  divider,
  expanded,
  dimmed,
  round,
}: {
  icon: string;
  iconBg: string;
  label: string;
  sub?: string;
  /** Overrides the sub text colour — used for a "never backed up" nudge, otherwise left at the default muted tone. */
  subColor?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  /** A hairline above this row — every row but a group's first. */
  divider?: boolean;
  /** Set on a row that opens in place (currency, daily goal): its chevron points up or down instead of right. */
  expanded?: boolean;
  /** Greyed out while something it depends on is off. */
  dimmed?: boolean;
  /** A round icon, as in Home's rows and every sheet's rows. */
  round?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.99);
  const chevron = expanded === undefined ? 'chevron-right' : expanded ? 'chevron-up' : 'chevron-down';
  const content = (
    <>
      <View style={[h.iconTile, round && styles.round, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon as McIconName} size={17} color={theme.colors.ink} />
      </View>
      <View style={h.mid}>
        <Text style={h.title} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={[h.sub, subColor && { color: subColor }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {right ?? (onPress ? <Feather name={chevron} size={18} color={theme.colors.textMuted} /> : null)}
    </>
  );

  if (!onPress) {
    return <View style={[h.row, divider && h.divider, dimmed && styles.dimmed]}>{content}</View>;
  }
  return (
    <AnimatedPressable
      style={[h.row, divider && h.divider, dimmed && styles.dimmed, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={expanded === undefined ? undefined : { expanded }}
    >
      {content}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  value: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  dimmed: { opacity: 0.45 },
  round: { borderRadius: 19 },
});
