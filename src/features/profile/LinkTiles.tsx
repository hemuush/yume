import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { SCREEN } from '@/components/screenStyles';
import { GLASS } from '@/components/Glass';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Tile({
  value,
  label,
  tone,
  onPress,
}: {
  value: number;
  label: string;
  tone: string;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <AnimatedPressable
      style={[styles.tile, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** Entries, active loans and friends as three glass tiles, each with a dot of its colour, opening its screen. */
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
      <Tile value={entries} label="Entries" tone={theme.colors.slice.free} onPress={onEntries} />
      <Tile value={loans} label="Active loans" tone={theme.colors.slice.due} onPress={onLoans} />
      <Tile value={friends} label="Friends" tone={theme.colors.slice.spent} onPress={onFriends} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginHorizontal: SCREEN.gutter, marginTop: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
    boxShadow: GLASS.shadow,
  },
  dot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4 },
  value: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
});
