import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ActionSheet } from '@/components/ActionSheet';
import { Text } from '@/components/Text';
import { screenStyles as h } from '@/components/screenStyles';
import { theme } from '@/constants/theme';
import { spendHeatScale } from '@/lib/color';
import { withPressed } from '@/lib/pressed';
import { SpendHeatmap } from './SpendHeatmap';
import type { HeatModel } from './reportsInsights';

export interface HeatScope {
  /** Null for "All". */
  id: string | null;
  name: string;
  color: string;
}

/**
 * The heatmap card: its title with one dropdown that colours the grid to a category ("All spending" by
 * default), the grid itself with a short key, and (as children) the inspector for the day picked. A category
 * picked in Breakdown shows here as the dropdown's choice.
 */
export function HeatmapCard({
  model,
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
  const [open, setOpen] = useState(false);
  const scopeName = (x: HeatScope) => (x.id == null ? 'All spending' : x.name);
  const current = scopes.find((x) => x.id === scopeId) ?? scopes[0];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Spending by day</Text>
        {scopes.length > 1 && (
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Colour the heatmap by category: ${scopeName(current)}. Change`}
            style={withPressed(styles.scope)}
          >
            {current.id != null && <View style={[styles.chipDot, { backgroundColor: current.color }]} />}
            <Text style={styles.scopeText} numberOfLines={1}>
              {scopeName(current)}
            </Text>
            <Feather name="chevron-down" size={14} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
      <View style={styles.grid}>
        <SpendHeatmap
          model={model}
          selectedIso={selectedIso}
          onSelect={onSelect}
          onOpenMonth={onOpenMonth}
          usualMinor={usualMinor}
          hue={hue}
        />
      </View>
      <View style={styles.legend} accessibilityLabel="Lighter means less spent, darker means more" accessible>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendBar}>
          {scale.slice(1).map((c, i) => (
            <View key={i} style={[styles.legendStep, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendText}>More</Text>
        <View style={styles.legendBig}>
          <View style={styles.legendBigDot} />
          <Text style={styles.legendText}>Big day</Text>
        </View>
      </View>
      {children}
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Colour by category"
        items={scopes.map((x) => ({
          key: x.id ?? 'all',
          label: scopeName(x),
          icon: x.id === scopeId ? ('check-circle' as const) : ('circle' as const),
          onPress: () => onScope(x.id),
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...h.card, marginHorizontal: 0, paddingTop: 14, paddingBottom: 14, marginBottom: 12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  title: {
    flexShrink: 1,
    fontFamily: theme.font.roundedBold,
    fontSize: theme.typeSize.section,
    color: theme.colors.textPrimary,
  },
  scope: {
    minHeight: 44,
    maxWidth: '55%',
    flexShrink: 1,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.tray,
  },
  scopeText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  grid: { paddingHorizontal: 14, paddingTop: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 8 },
  legendBar: { width: 72, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  legendStep: { flex: 1 },
  legendText: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  legendBig: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  legendBigDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.ink },
});
