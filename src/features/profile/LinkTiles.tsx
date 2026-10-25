import { Animated, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import Feather from '@expo/vector-icons/Feather';
import { SCREEN } from '@/components/screenStyles';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Stat({
  value,
  label,
  icon,
  color,
  onPress,
}: {
  value: number;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const { fontScale } = useWindowDimensions();
  return (
    <AnimatedPressable
      style={[styles.stat, fontScale > 1.2 && styles.statStack, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Feather name={icon} size={16} color={theme.colors.ink} />
        </View>
        <Feather name="arrow-up-right" size={13} color={theme.colors.textMuted} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Three explicit shortcuts, with counts and arrows that make their destinations clear. */
export function LinkTiles({
  entries,
  loans,
  friends,
  onEntries,
  onLoans,
  onFriends,
}: {
  entries: number;
  loans: number;
  friends: number;
  onEntries: () => void;
  onLoans: () => void;
  onFriends: () => void;
}) {
  const { accent, secondary } = useAccent();
  const { fontScale } = useWindowDimensions();
  return (
    <View style={[styles.row, fontScale > 1.2 && styles.rowStack]}>
      <Stat value={entries} label="Entries" icon="list" color={shade(accent, 88)} onPress={onEntries} />
      <Stat
        value={loans}
        label="Active loans"
        icon="credit-card"
        color={theme.colors.idGold}
        onPress={onLoans}
      />
      <Stat value={friends} label="Friends" icon="users" color={shade(secondary, 88)} onPress={onFriends} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: SCREEN.gutter, marginTop: 12 },
  rowStack: { flexDirection: 'column' },
  statStack: { flexBasis: 'auto', flexGrow: 0 },
  stat: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 0,
    minHeight: 118,
    padding: 12,
    gap: 4,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
  },
  icon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  value: {
    fontFamily: theme.font.bodyBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
});
