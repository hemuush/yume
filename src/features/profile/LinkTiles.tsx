import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { screenStyles as h } from '@/components/screenStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Stat({
  value,
  label,
  divider,
  onPress,
}: {
  value: number;
  label: string;
  divider: boolean;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  return (
    <AnimatedPressable
      style={[styles.stat, divider && h.dividerLeft, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </AnimatedPressable>
  );
}

/** Entries, active loans and friends as one strip of three counts, each opening its screen. */
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
  return (
    <View style={styles.row}>
      <Stat value={entries} label="Entries" divider={false} onPress={onEntries} />
      <Stat value={loans} label="Active loans" divider onPress={onLoans} />
      <Stat value={friends} label="Friends" divider onPress={onFriends} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { ...h.card, flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1, minWidth: 0, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 1 },
  value: { fontFamily: theme.font.bodyBold, fontSize: 18, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
});
