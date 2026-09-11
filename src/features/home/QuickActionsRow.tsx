import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const ACTIONS: {
  type: 'expense' | 'income' | 'transfer';
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { type: 'expense', label: 'Expense', icon: 'arrow-down-right' },
  { type: 'income', label: 'Income', icon: 'arrow-up-right' },
  { type: 'transfer', label: 'Transfer', icon: 'repeat' },
];

/**
 * Three shortcuts to the Add screen, pre-selecting the segment that
 * matters — the nav bar's own + still opens the same screen on the default
 * (Expense) segment, this just skips the extra tap for the other two.
 */
function ActionPill({ type, label, icon }: (typeof ACTIONS)[number]) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <Pressable
      onPress={() => router.push(`/add-transaction?type=${type}`)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.pillWrap}
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
    >
      <Animated.View style={[styles.pill, animatedStyle]}>
        <Feather name={icon} size={14} color={theme.colors.ink} />
        <Text style={styles.label}>{label}</Text>
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
  row: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 14 },
  pillWrap: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  label: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
});
