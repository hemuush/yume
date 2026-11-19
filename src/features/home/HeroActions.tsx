import { View, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { pushOnce } from '@/lib/pushOnce';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { themedStyles } from '@/theme/themedStyles';

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
 * Quick entry shortcuts. Each opens Add with its entry type selected.
 */
function Action({ type, label, icon }: (typeof ACTIONS)[number]) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        pushOnce(`/add-transaction?type=${type}`);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.wrap,
        { flexBasis: 90 * Math.max(1, fontScale) },
        type === 'expense' && styles.primary,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={type === 'expense' ? 'Add expense' : `Add ${label.toLowerCase()}`}
    >
      <Animated.View style={[styles.action, animatedStyle]}>
        <Feather
          name={icon}
          size={16}
          color={type === 'income' ? theme.colors.incomeText : theme.colors.link}
        />
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function HeroActions() {
  return (
    <View style={styles.row}>
      {ACTIONS.map((a) => (
        <Action key={a.type} {...a} />
      ))}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    row: { marginHorizontal: 16, marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    wrap: { flexGrow: 1, borderRadius: theme.radius.lg, backgroundColor: theme.colors.home.control },
    primary: { backgroundColor: theme.colors.home.selected },
    pressed: { backgroundColor: theme.colors.home.pressed },
    action: {
      minHeight: 44,
      paddingHorizontal: 4,
      paddingVertical: 5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    label: {
      fontFamily: theme.font.bodyMedium,
      flexShrink: 1,
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
  })
);
