import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { pushOnce } from '@/lib/pushOnce';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const ACTIONS: {
  type: 'expense' | 'income' | 'transfer';
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  /** The icon's colour. */
  color: string;
  primary?: boolean;
}[] = [
  { type: 'expense', label: 'Expense', icon: 'plus', color: theme.colors.surface, primary: true },
  {
    type: 'income',
    label: 'Income',
    icon: 'plus',
    color: theme.colors.ink,
  },
  {
    type: 'transfer',
    label: 'Transfer',
    icon: 'repeat',
    color: theme.colors.ink,
  },
];

/**
 * Shortcuts to Add with a segment preselected (nav + still opens Expense), just under the month card where a
 * thumb reaches. Expense is the one filled ink button; Income and Transfer are quiet outlined cards with a plain icon.
 */
function ActionPill({ type, label, icon, color, primary }: (typeof ACTIONS)[number]) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <Pressable
      onPress={() => pushOnce(`/add-transaction?type=${type}`)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.pillWrap}
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
    >
      <Animated.View style={[styles.pill, primary && styles.pillPrimary, animatedStyle]}>
        <Feather name={icon} size={16} color={color} />
        <Text style={[styles.label, primary && styles.labelPrimary]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function QuickActionsRow() {
  return (
    <View style={styles.row}>
      {ACTIONS.map((a) => (
        <ActionPill key={a.type} {...a} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 16 },
  pillWrap: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  pillPrimary: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  label: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  labelPrimary: { color: theme.colors.surface },
});
