import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { spendHeatScale } from '@/lib/color';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { compactMoney } from '@/lib/compactMoney';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import type { DailyExpensePoint } from '@/db/reports';
import { SpendHeatmap } from './SpendHeatmap';
import type { HeatModel } from './reportsInsights';

export interface HeatScope {
  /** Null for "All". */
  id: string | null;
  name: string;
  color: string;
}

function ScopeChip({ scope, active, onPress }: { scope: HeatScope; active: boolean; onPress: () => void }) {
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={() => {
        if (!active) haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={scope.id ? `${scope.name} days` : 'All spending'}
      style={withPressed([styles.chip, active && { backgroundColor: themeInk(accent) }])}
    >
      {scope.id != null && <View style={[styles.chipDot, { backgroundColor: scope.color }]} />}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{scope.name}</Text>
    </Pressable>
  );
}

/**
 * Days' heatmap card: a title with the scale, category chips that recolour the grid to one category, the
 * grid itself and (as children) the inspector for the day picked. A category picked in Breakdown shows here
 * as the active chip.
 */
export function HeatmapCard({
  model,
  daily,
  selectedIso,
  onSelect,
  onOpenMonth,
  usualMinor,
  scopes,
  scopeId,
  onScope,
  hue,
  children,
}: {
  model: HeatModel;
  daily: DailyExpensePoint[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  onOpenMonth?: (monthKey: string) => void;
  usualMinor: number;
  scopes: HeatScope[];
  scopeId: string | null;
  onScope: (id: string | null) => void;
  /** The colour the grid is tinted in: the theme's, or the chosen category's. */
  hue: string;
  children?: React.ReactNode;
}) {
  const scale = spendHeatScale(hue);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Spending by day</Text>
        <Text style={styles.hint}>
          {model.kind === 'calendar' ? 'Tap or drag across days' : 'Drag across the grid'}
        </Text>
      </View>
      {scopes.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          accessibilityLabel="Colour the heatmap by category"
        >
          {scopes.map((s) => (
            <ScopeChip
              key={s.id ?? 'all'}
              scope={s}
              active={s.id === scopeId}
              onPress={() => onScope(s.id)}
            />
          ))}
        </ScrollView>
      )}
      <View style={styles.grid}>
        <SpendHeatmap
          model={model}
          daily={daily}
          selectedIso={selectedIso}
          onSelect={onSelect}
          onOpenMonth={onOpenMonth}
          usualMinor={usualMinor}
          hue={hue}
        />
      </View>
      <View style={styles.legend} accessibilityLabel="Lighter means less spent, darker means more" accessible>
        <Text style={styles.legendText}>{compactMoney(0)}</Text>
        <View style={styles.legendBar}>
          {scale.slice(1).map((c, i) => (
            <View key={i} style={[styles.legendStep, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendText}>{compactMoney(model.maxMinor)}</Text>
        <View style={styles.legendBig}>
          <View style={styles.legendBigDot} />
          <Text style={styles.legendText}>Big day</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, marginHorizontal: 0, paddingTop: 14, paddingBottom: 14, marginBottom: 12 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: theme.typeSize.section,
    color: theme.colors.textPrimary,
  },
  hint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.colors.tray,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.white },
  grid: { paddingHorizontal: 14, paddingTop: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 8 },
  legendBar: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  legendStep: { flex: 1 },
  legendText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  legendBig: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendBigDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.ink },
});
