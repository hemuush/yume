import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CategoryBreakdownItem } from '@/db/reports';
import { formatPctChange } from '@/lib/format';
import { allocateRoundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { AnimatedCategoryFill } from './AnimatedCategoryFill';
import { styles } from './reports.styles';

/** Categories shown before "N more" — like every other long list in the app. */
const COLLAPSED_COUNT = 5;
/** A change smaller than this (in %) against the previous period isn't worth an arrow. */
const DELTA_MIN_PCT = 10;
/** Stagger each bar's fill a little, capped so a long list doesn't lag. */
const FILL_STAGGER_MS = 60;
const FILL_STAGGER_MAX_ROWS = 8;

/**
 * "Where it went": each category's share, amount, change against the
 * previous period and a bar. A category with subcategories opens its split;
 * one without opens its transactions.
 */
export function CategoryList({
  breakdown,
  spentMinor,
  deltas,
  expanded,
  onToggleExpanded,
  onPressCategory,
}: {
  breakdown: CategoryBreakdownItem[];
  /** The period's rounded total — the rows' rounded amounts add up to it. */
  spentMinor: number;
  /** % change per category id against the previous period. */
  deltas: Map<string, number | null>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onPressCategory: (c: CategoryBreakdownItem) => void;
}) {
  const shown = expanded ? breakdown : breakdown.slice(0, COLLAPSED_COUNT);
  const rounded = allocateRoundedMinor(
    breakdown.map((c) => c.totalMinor),
    spentMinor
  );
  const maxCat = Math.max(1, ...breakdown.map((c) => c.totalMinor));
  return (
    <View style={styles.catCard}>
      {shown.map((c, i) => {
        const d = deltas.get(c.categoryId);
        const pct = spentMinor > 0 ? Math.round((c.totalMinor / spentMinor) * 100) : 0;
        return (
          <Pressable key={c.categoryId} onPress={() => onPressCategory(c)} style={styles.catRow}>
            <View style={styles.catTop}>
              <View style={[styles.catDot, { backgroundColor: c.color }]} />
              <Text style={styles.catName} numberOfLines={1}>
                {c.name}
                {c.hasSubcategories ? ' ›' : ''}
              </Text>
              <Text style={styles.catPct}>{pct}%</Text>
              <View style={styles.catRight}>
                <Amount minor={rounded[i]} sensitive={c.isSensitive} style={styles.catAmt} />
                {d != null && Math.abs(d) >= DELTA_MIN_PCT && (
                  <Text
                    style={[styles.catDelta, { color: d > 0 ? theme.colors.expense : theme.colors.income }]}
                  >
                    {d > 0 ? '↑' : '↓'}
                    {formatPctChange(d)}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.catTrack}>
              <AnimatedCategoryFill
                targetPct={Math.max(3, (c.totalMinor / maxCat) * 100)}
                color={c.color}
                delay={Math.min(i, FILL_STAGGER_MAX_ROWS) * FILL_STAGGER_MS}
              />
            </View>
          </Pressable>
        );
      })}
      {breakdown.length > COLLAPSED_COUNT && (
        <Pressable onPress={onToggleExpanded} style={styles.catMore}>
          <Text style={styles.catMoreText}>
            {expanded ? 'Show less ︿' : `${breakdown.length - COLLAPSED_COUNT} more ⌄`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
