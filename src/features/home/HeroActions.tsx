import { View, Pressable, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { pushOnce } from '@/lib/pushOnce';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/hooks/usePressScale';
import { haptics } from '@/lib/haptics';
import { themedStyles } from '@/theme/themedStyles';

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
        { flexBasis: 88 * Math.max(1, fontScale) },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={type === 'expense' ? 'Add expense' : `Add ${label.toLowerCase()}`}
    >
      <Animated.View style={[styles.action, animatedStyle]}>
        <View style={[styles.chip, type === 'expense' && styles.chipCoral]}>
          <Feather
            name={icon}
            size={16}
            color={
              type === 'expense'
                ? theme.colors.onCoral
                : type === 'income'
                  ? theme.colors.incomeText
                  : theme.colors.link
            }
          />
        </View>
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
    row: { marginHorizontal: 16, marginTop: 8, flexDirection: 'row', gap: 8 },
    wrap: {
      flexGrow: 1,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.home.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    chipCoral: { backgroundColor: theme.colors.coral },
    chip: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.home.control,
    },
    pressed: { backgroundColor: theme.colors.home.pressed },
    // One slim line, icon beside its name, so the three shortcuts take less of the first screen.
    action: {
      minHeight: 48,
      paddingHorizontal: 6,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    label: {
      fontFamily: theme.font.bodyMedium,
      flexShrink: 1,
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
  })
);
