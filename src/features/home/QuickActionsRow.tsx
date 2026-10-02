import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { Text } from '@/components/Text';
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
  primary?: boolean;
}[] = [
  { type: 'expense', label: 'Expense', icon: 'plus', color: theme.colors.white, primary: true },
  { type: 'income', label: 'Income', icon: 'plus', color: theme.colors.incomeText },
  { type: 'transfer', label: 'Transfer', icon: 'repeat', color: TRANSFER_TEXT },
];

/**
 * Three shortcuts to the Add screen, pre-selecting the segment that
 * matters — the nav bar's own + still opens the same screen on the default
 * (Expense) segment, this just skips the extra tap for the other two.
 * Expense is the one filled (ink) pill, as it is the thing logged most;
 * Income and Transfer are plain frosted pills whose icon+label carry their
 * type's own colour, so colour lives in the label, not the card.
 *
 * Lives inside Home's sky header band (HomeHeader's `children`), so the
 * pills are a soft frosted surface there rather than outlined cards.
 */
function ActionPill({ type, label, icon, color, primary }: (typeof ACTIONS)[number]) {
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
      <Animated.View style={[styles.pill, primary && styles.pillPrimary, animatedStyle]}>
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
  row: { flexDirection: 'row', gap: 8 },
  pillWrap: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 38,
    paddingVertical: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.glass,
  },
  pillPrimary: { backgroundColor: theme.colors.ink },
  label: { fontFamily: theme.font.bodyBold, fontSize: 12.5 },
});
