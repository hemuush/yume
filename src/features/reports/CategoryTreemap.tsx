import { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { ROW_LAYOUT } from '@/lib/animation';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import type { CategoryBreakdownItem } from '@/db/reports';
import { treemapLayout } from './reportsInsights';

const HEIGHT = 176;
/** A tile smaller than this share of the box has no room for its name. */
const LABEL_MIN_AREA = 700;

/**
 * The period's split as tiles whose area is their share, in each category's colour: the biggest spend reads at
 * a glance. Tap a tile to pick it (the others fade back), tap again to put it away. Same selection as the rows.
 */
export function CategoryTreemap({
  breakdown,
  selectedId,
  onSelect,
}: {
  breakdown: CategoryBreakdownItem[];
  selectedId: string | null;
  onSelect: (row: CategoryBreakdownItem) => void;
}) {
  const total = breakdown.reduce((s, c) => s + Math.max(0, c.totalMinor), 0);
  const tiles = useMemo(
    () => treemapLayout(breakdown.map((c) => ({ id: c.categoryId, value: c.totalMinor }))),
    [breakdown]
  );
  const byId = new Map(breakdown.map((c) => [c.categoryId, c]));
  return (
    <View style={styles.box}>
      {tiles.map((t, i) => {
        const row = byId.get(t.id)!;
        const dim = selectedId != null && selectedId !== t.id;
        const share = total > 0 ? Math.round((row.totalMinor / total) * 100) : 0;
        const roomy = t.w * t.h > LABEL_MIN_AREA;
        return (
          <Animated.View
            key={t.id}
            layout={ROW_LAYOUT}
            entering={FadeIn.duration(260)
              .delay(i * 40)
              .reduceMotion(ReduceMotion.System)}
            style={[
              styles.tile,
              { left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` },
              dim && styles.dim,
            ]}
          >
            <Pressable
              onPress={() => {
                haptics.tap();
                onSelect(row);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${row.name}, ${share} percent`}
              accessibilityState={{ selected: selectedId === t.id }}
              style={withPressed([styles.press, { backgroundColor: row.color }])}
            >
              {roomy && (
                <>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={styles.share}>{share}%</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: HEIGHT, marginTop: 14, borderRadius: 18, overflow: 'hidden' },
  tile: { position: 'absolute', padding: 2 },
  press: { flex: 1, borderRadius: 12, padding: 8, justifyContent: 'flex-end' },
  dim: { opacity: 0.3 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.ink },
  share: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.ink, opacity: 0.8 },
});
