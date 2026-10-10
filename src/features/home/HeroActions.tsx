import { View, Pressable, StyleSheet, Animated } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import { pushOnce } from '@/lib/pushOnce';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from './homeInk';

const ACTIONS: {
  type: 'expense' | 'income' | 'transfer';
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { type: 'expense', label: 'Expense', icon: 'arrow-up-right' },
  { type: 'income', label: 'Income', icon: 'arrow-down-left' },
  { type: 'transfer', label: 'Transfer', icon: 'repeat' },
];

/**
 * Add shortcuts inside the month card, each opening Add with its kind picked. Expense is the one filled
 * button (deep ink); Income and Transfer are bright glass.
 */
function Action({ type, label, icon, ink }: (typeof ACTIONS)[number] & { ink: string }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const primary = type === 'expense';
  return (
    <Pressable
      onPress={() => pushOnce(`/add-transaction?type=${type}`)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
    >
      <Animated.View
        style={[styles.action, primary && { backgroundColor: ink, borderColor: ink }, animatedStyle]}
      >
        <Feather name={icon} size={19} color={primary ? theme.colors.white : theme.colors.ink} />
        <Text style={[styles.label, primary && styles.labelPrimary]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function HeroActions() {
  const { accent } = useAccent();
  const ink = homeInk(accent);
  return (
    <View style={styles.row}>
      {ACTIONS.map((a) => (
        <Action key={a.type} {...a} ink={ink} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  wrap: { flex: 1 },
  action: {
    minHeight: 52,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  labelPrimary: { color: theme.colors.white },
});
