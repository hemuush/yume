import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import type { CategoryBreakdownItem } from '@/db/reports';
import { formatMaskableMoney } from '@/lib/money';
import { formatPctChange } from '@/lib/format';
import { allocateRoundedMinor } from '@/lib/round';
import { usePrivacy } from '@/theme/PrivacyContext';
import { squarify } from './mosaicLayout';
import { styles } from './reports.styles';

const MOSAIC_HEIGHT = 220;
/** A change smaller than this (in %) isn't worth an arrow — the same threshold as the category list. */
const DELTA_MIN_PCT = 10;
/** Below this size a tile shows only its share — a name and amount wouldn't fit. */
const LABEL_MIN_W = 72;
const LABEL_MIN_H = 60;
/** The biggest categories each get a tile; past this many, the rest share one "N more" tile. */
const MAX_TILES = 7;

/**
 * "Where it went" as a mosaic: every category a tile sized by its share of
 * the period (a squarified treemap, see mosaicLayout.ts), in its own colour,
 * with its % and — room permitting — its name, amount and change against
 * the previous period. Tapping a tile does what tapping its row in the list
 * below does: its subcategory split, or its transactions.
 *
 * With many categories the six biggest get tiles and the rest share one
 * "N more" tile (tapping it opens the full list below) — thirteen tiles in
 * one card left most of them too small to read.
 */
export function CategoryMosaic({
  breakdown,
  spentMinor,
  deltas,
  onPressCategory,
  onPressRest,
}: {
  breakdown: CategoryBreakdownItem[];
  spentMinor: number;
  deltas: Map<string, number | null>;
  onPressCategory: (c: CategoryBreakdownItem) => void;
  /** Tapping the "N more" tile — Reports expands the full list. */
  onPressRest: () => void;
}) {
  const { hideAmounts } = usePrivacy();
  const [width, setWidth] = useState(0);
  const grouped = breakdown.length > MAX_TILES;
  const tiled = grouped ? breakdown.slice(0, MAX_TILES - 1) : breakdown;
  const rest = grouped ? breakdown.slice(MAX_TILES - 1) : [];
  const restMinor = rest.reduce((s, c) => s + c.totalMinor, 0);
  const values = [...tiled.map((c) => c.totalMinor), ...(grouped ? [restMinor] : [])];
  const tiles = squarify(values, width, MOSAIC_HEIGHT);
  // Rounded so the amounts shown add up to the period's rounded total.
  const rounded = allocateRoundedMinor(values, spentMinor);

  return (
    <View
      style={[styles.mosaic, { height: MOSAIC_HEIGHT }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {tiles.map((t) => {
        if (t.index >= tiled.length) {
          const pct = spentMinor > 0 ? Math.round((restMinor / spentMinor) * 100) : 0;
          const roomy = t.width >= LABEL_MIN_W && t.height >= LABEL_MIN_H;
          return (
            <Pressable
              key="rest"
              onPress={onPressRest}
              style={[
                styles.tile,
                styles.tileRest,
                { left: t.x, top: t.y, width: t.width, height: t.height },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${rest.length} more categories, ${pct}% of spending. Show the full list`}
            >
              {roomy && <Text style={styles.tileName}>{rest.length} more</Text>}
              <Text style={[styles.tilePct, !roomy && styles.tilePctSmall]} numberOfLines={1}>
                {roomy ? `${pct < 1 ? '<1' : pct}%` : `+${rest.length}`}
              </Text>
            </Pressable>
          );
        }
        const c = tiled[t.index];
        const pct = spentMinor > 0 ? Math.round((c.totalMinor / spentMinor) * 100) : 0;
        const d = deltas.get(c.categoryId);
        const showDelta = d != null && Math.abs(d) >= DELTA_MIN_PCT;
        const roomy = t.width >= LABEL_MIN_W && t.height >= LABEL_MIN_H;
        const amount = formatMaskableMoney(rounded[t.index], { masked: hideAmounts && c.isSensitive });
        return (
          <Pressable
            key={c.categoryId}
            onPress={() => onPressCategory(c)}
            style={[
              styles.tile,
              { left: t.x, top: t.y, width: t.width, height: t.height, backgroundColor: c.color },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${pct}% of spending, ${amount}${
              showDelta ? `, ${d! > 0 ? 'up' : 'down'} ${formatPctChange(d!)}` : ''
            }`}
          >
            {roomy && (
              <Text style={styles.tileName} numberOfLines={2}>
                {c.name}
              </Text>
            )}
            <View>
              <Text style={[styles.tilePct, !roomy && styles.tilePctSmall]} numberOfLines={1}>
                {pct < 1 ? '<1' : pct}%
              </Text>
              {roomy && (
                <Text style={styles.tileAmt} numberOfLines={1}>
                  {amount}
                  {showDelta && (
                    <Text style={d! > 0 ? styles.tileUp : styles.tileDown}>
                      {'  '}
                      {d! > 0 ? '▲' : '▼'} {formatPctChange(d!)}
                    </Text>
                  )}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
