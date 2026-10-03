import { Animated, Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { SCREEN } from '@/components/screenStyles';

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
      style={[styles.tile, { backgroundColor: tone }, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** Entries, active loans and friends as three pale tiles, each opening its screen. */
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
      <Tile value={entries} label="Entries" tone={theme.colors.primaryTint} onPress={onEntries} />
      <Tile value={loans} label="Active loans" tone={theme.colors.idGold} onPress={onLoans} />
      <Tile value={friends} label="Friends" tone={theme.colors.idCoral} onPress={onFriends} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginHorizontal: SCREEN.gutter, marginTop: 10 },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  value: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
});
