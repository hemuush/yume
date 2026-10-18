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

/**
 * Budgets or goals as rows of exactly three equal tiles, so the left and right edges line up with every card
 * above and below (percentage widths and wrapping left a ragged gap). The add button takes the next free slot,
 * or a slim full-width row of its own when the last row is full; short rows are padded with empty slots.
 */
export function TileGrid({
  tiles,
  label,
  accessibilityLabel,
  onAdd,
}: {
  tiles: React.ReactNode[];
  label: string;
  accessibilityLabel: string;
  onAdd: () => void;
}) {
  const shown = tiles.slice(0, GRID_SHOWN);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < shown.length; i += GRID_COLUMNS) rows.push(shown.slice(i, i + GRID_COLUMNS));
  const add = (
    <AddSlot
      key="add"
      count={shown.length}
      label={label}
      accessibilityLabel={accessibilityLabel}
      onPress={onAdd}
    />
  );
  const hasAdd = shown.length < GRID_SHOWN;
  // A full last row sends the add button to a row of its own; it then fills that row (the slim button).
  const slimRow = hasAdd && shown.length % GRID_COLUMNS === 0;
  if (hasAdd) {
    if (slimRow) rows.push([add]);
    else rows[rows.length - 1].push(add);
  }
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.gridRow}>
          {row}
          {!(slimRow && r === rows.length - 1) &&
            Array.from({ length: GRID_COLUMNS - row.length }, (_, k) => (
              <View key={`gap${k}`} style={styles.tileWrap} />
            ))}
        </View>
      ))}
    </View>
  );
}
