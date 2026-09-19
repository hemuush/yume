import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { usePressScale } from '@/lib/usePressScale';

// A readable-as-text shade of the app's own sky-blue accent — `primary`
// itself (#8FCBFF) is too light to read as small bold text on cream, the
// same problem reports.tsx's own moon card already solved for its accent
// text by deriving a deeper shade of the same hue instead of picking an
// unrelated blue.
const TRANSFER_TEXT = shade(theme.colors.primary, 45, 8);

const ACTIONS: {
  type: 'expense' | 'income' | 'transfer';
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
}[] = [
  { type: 'expense', label: 'Expense', icon: 'arrow-up-right', color: theme.colors.idCoralDeep },
  { type: 'income', label: 'Income', icon: 'arrow-down-right', color: theme.colors.income },
  { type: 'transfer', label: 'Transfer', icon: 'repeat', color: TRANSFER_TEXT },
];

/**
 * Three shortcuts to the Add screen, pre-selecting the segment that
 * matters — the nav bar's own + still opens the same screen on the default
 * (Expense) segment, this just skips the extra tap for the other two.
 * Each pill's icon+label carries its type's own colour (matching Income/
 * Spent, Surplus/Debt, and every other figure on Home) instead of a tinted
 * fill — the pill itself stays a plain neutral surface, so colour lives in
 * the figure, not the card, the one rule the whole screen now follows.
 */
function ActionPill({ type, label, icon, color }: (typeof ACTIONS)[number]) {
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
        <Feather name={icon} size={13} color={color} />
        <Text style={[styles.label, { color }]}>{label}</Text>
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
  label: { fontFamily: theme.font.bodyBold, fontSize: 12.5 },
});
