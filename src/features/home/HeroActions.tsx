import { View, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { pushOnce } from '@/lib/pushOnce';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

const ACTIONS: {
  type: 'expense' | 'income' | 'transfer';
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { type: 'expense', label: 'Add expense', icon: 'arrow-up-right' },
  { type: 'income', label: 'Income', icon: 'arrow-down-left' },
  { type: 'transfer', label: 'Transfer', icon: 'repeat' },
];

/**
 * Add shortcuts beneath the month card, each opening Add with its kind picked. Expense is the one filled
 * button (deep ink); Income and Transfer are bright glass.
 */
function Action({ type, label, icon, ink }: (typeof ACTIONS)[number] & { ink: string }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const { fontScale } = useWindowDimensions();
  const primary = type === 'expense';
  return (
    <Pressable
      onPress={() => pushOnce(`/add-transaction?type=${type}`)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.wrap,
        { flexBasis: (primary ? 104 : 80) * Math.max(1, fontScale), flexGrow: primary ? 1.45 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={type === 'expense' ? 'Add expense' : `Add ${label.toLowerCase()}`}
    >
      <Animated.View
        style={[styles.action, primary && { backgroundColor: ink, borderColor: ink }, animatedStyle]}
      >
        <Feather name={icon} size={16} color={primary ? theme.colors.white : theme.colors.ink} />
        <Text style={[styles.label, primary && styles.labelPrimary]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function HeroActions() {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  return (
    <View style={styles.row}>
      {ACTIONS.map((a) => (
        <Action key={a.type} {...a} ink={ink} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wrap: { flexGrow: 1, flexBasis: 88 },
  action: {
    minHeight: 50,
    paddingHorizontal: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 0,
  },
  label: {
    fontFamily: theme.font.bodyMedium,
    flexShrink: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  labelPrimary: { color: theme.colors.white },
});
