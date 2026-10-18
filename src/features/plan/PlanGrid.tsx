import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { styles } from './plan.styles';

/** Budgets and goals sit three to a row; the rest are under See all. */
const GRID_COLUMNS = 3;
export const GRID_SHOWN = GRID_COLUMNS * 2;

/**
 * The add button of a budgets or goals grid. It takes the next free slot of the row; when the row is already
 * full (3, or 6 shown) it starts a new row as a slim full-width button, so it never stretches into a blank block.
 * Nothing is drawn once the grid is full.
 */
export function AddSlot({
  count,
  label,
  accessibilityLabel,
  onPress,
}: {
  /** How many tiles are already in the grid. */
  count: number;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  if (count >= GRID_SHOWN) return null;
  const slim = count % GRID_COLUMNS === 0;
  return (
    <Pressable
      onPress={onPress}
      style={withPressed([styles.gridTile, styles.tileAdd, slim && styles.tileSlim])}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.addDisc, slim && styles.addDiscSmall]}>
        <Feather name="plus" size={17} color={theme.colors.ink} />
      </View>
      <Text style={styles.addText}>{label}</Text>
    </Pressable>
  );
}
