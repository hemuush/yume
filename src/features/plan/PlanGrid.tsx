import { View, Pressable, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { styles } from './plan.styles';

/** Budgets and goals use three columns normally, two on narrow screens and one with enlarged text. */
const GRID_COLUMNS = 3;
export const GRID_SHOWN = GRID_COLUMNS * 2;

/**
 * The add button of a budgets or goals grid. It takes the next free slot of the row; when the row is already
 * full for the current column count it starts a new row as a slim full-width button, so it never stretches into a blank block.
 * Nothing is drawn once the configured item limit is reached.
 */
export function AddSlot({
  count,
  limit = GRID_SHOWN,
  label,
  accessibilityLabel,
  onPress,
  columns = GRID_COLUMNS,
}: {
  /** How many tiles are already in the grid. */
  count: number;
  columns?: number;
  /** Tiles shown at most; the button is left out once they are all there. */
  limit?: number;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  if (count >= limit) return null;
  const slim = count % columns === 0;
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
 * Budgets or goals as rows of equal tiles adapted to screen width and text scale, so the left and right edges line up with every card
 * above and below (percentage widths and wrapping left a ragged gap). The add button takes the next free slot,
 * or a slim full-width row of its own when the last row is full; short rows are padded with empty slots.
 */
export function TileGrid({
  tiles,
  label,
  accessibilityLabel,
  onAdd,
  limit = GRID_SHOWN,
}: {
  tiles: React.ReactNode[];
  label: string;
  accessibilityLabel: string;
  onAdd: () => void;
  /** How many items show: three on Overview, six for goals, all loaded budgets on Budgets. */
  limit?: number;
}) {
  const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.2 ? 1 : width < 360 ? 2 : GRID_COLUMNS;
  const shown = tiles.slice(0, limit);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < shown.length; i += columns) rows.push(shown.slice(i, i + columns));
  const add = (
    <AddSlot
      key="add"
      count={shown.length}
      columns={columns}
      limit={limit}
      label={label}
      accessibilityLabel={accessibilityLabel}
      onPress={onAdd}
    />
  );
  const hasAdd = shown.length < limit;
  // A full last row sends the add button to a row of its own; it then fills that row (the slim button).
  const slimRow = hasAdd && shown.length % columns === 0;
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
            Array.from({ length: columns - row.length }, (_, k) => (
              <View key={`gap${k}`} style={styles.tileWrap} />
            ))}
        </View>
      ))}
    </View>
  );
}
