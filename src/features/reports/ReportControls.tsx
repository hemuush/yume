import { useState } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useDrawnValue } from '@/lib/useDrawnValue';
import { DURATIONS } from '@/lib/motionTimings';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ActionSheet } from '@/components/ActionSheet';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';

import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

export type ReportTab = 'days' | 'cats' | 'trends';
const TAB_LABELS = [
  ['days', 'Overview'],
  ['cats', 'Breakdown'],
  ['trends', 'Trends'],
] as const;

/** Three lenses as plain labels over one rule; the accent underline slides to the one in view. */
export function ReportTabs({ value, onChange }: { value: ReportTab; onChange: (value: ReportTab) => void }) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  const [width, setWidth] = useState(0);
  const index = TAB_LABELS.findIndex(([key]) => key === value);
  const left = useDrawnValue('reports-tab-underline', index, DURATIONS.standard);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: left.value * (width / 3) }] }));
  return (
    <View style={s.tabs} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {TAB_LABELS.map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => {
            if (value !== key) onChange(key);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
          style={withPressed(s.tab)}
        >
          <Text style={[s.tabText, value === key && s.tabOn]}>{label}</Text>
        </Pressable>
      ))}
      <Animated.View
        pointerEvents="none"
        style={[s.underline, { width: width / 3, backgroundColor: ink }, slide]}
      />
    </View>
  );
}

export function BreakdownControls({
  flow,
  group,
  onFlow,
  onGroup,
  onLabels,
  view,
  onView,
}: {
  flow: 'expense' | 'income';
  group: 'category' | 'account';
  onFlow: (value: 'expense' | 'income') => void;
  onGroup: (value: 'category' | 'account') => void;
  onLabels?: () => void;
  /** The split drawn as tiles or as one bar. */
  view: 'tree' | 'bar';
  onView: (value: 'tree' | 'bar') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.filters}>
      <View style={s.flow}>
        {(
          [
            ['expense', 'Spending'],
            ['income', 'Income'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => onFlow(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: flow === key }}
            style={withPressed([s.flowButton, flow === key && s.flowOn])}
          >
            <Text style={[s.filterText, flow === key && s.activeText]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.flow}>
        {(
          [
            ['tree', 'grid', 'Tiles'],
            ['bar', 'bar-chart-2', 'Bar'],
          ] as const
        ).map(([key, icon, label]) => (
          <Pressable
            key={key}
            onPress={() => onView(key)}
            accessibilityRole="button"
            accessibilityLabel={`Show as ${label.toLowerCase()}`}
            accessibilityState={{ selected: view === key }}
            style={withPressed([s.viewButton, view === key && s.flowOn])}
          >
            <Feather
              name={icon}
              size={16}
              color={view === key ? theme.colors.ink : theme.colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Group breakdown: By ${group}. Change`}
        style={withPressed(s.group)}
      >
        <Text style={s.filterText}>{group === 'category' ? 'By category' : 'By account'}</Text>
        <Feather name="chevron-down" size={14} color={theme.colors.textSecondary} />
      </Pressable>
      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Group breakdown"
        items={[
          ...(['category', 'account'] as const).map((key) => ({
            key,
            label: key === 'category' ? 'By category' : 'By account',
            icon: group === key ? ('check-circle' as const) : ('circle' as const),
            onPress: () => onGroup(key),
          })),
          ...(flow === 'expense' && onLabels
            ? [{ key: 'label', label: 'Explore expense labels', icon: 'tag' as const, onPress: onLabels }]
            : []),
        ]}
      />
    </View>
  );
}

export function ComparisonNote({ label, partial }: { label: string; partial: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}. About comparisons`}
        style={withPressed(s.comparison)}
      >
        <Text style={s.note}>{label}</Text>
        <Feather name="info" size={14} color={theme.colors.textMuted} />
      </Pressable>
      <ModalSheet visible={open} onClose={() => setOpen(false)} title="About comparisons">
        <Text style={s.explanation}>
          {partial
            ? 'This period is still in progress. Changes compare the amount recorded so far with the full previous period. They do not predict the final total.'
            : 'Changes compare this selected period with the full previous period.'}
        </Text>
        <Text style={s.explanation}>
          A decrease is favourable for spending; an increase is favourable for income. Small changes are left
          unmarked. All shares and totals follow your saved privacy setting.
        </Text>
        <Text style={s.explanation}>
          The “What changed?” insight inside a category compares matching days instead. Its amount can differ
          from this full-period comparison.
        </Text>
      </ModalSheet>
    </>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
  tab: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  tabText: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textSecondary },
  tabOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  underline: { position: 'absolute', left: 0, bottom: -1, height: 3, borderRadius: 2 },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
    padding: 6,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
  },
  flow: { flexDirection: 'row', backgroundColor: theme.colors.inkWash, borderRadius: 12, padding: 3 },
  flowButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  viewButton: {
    minHeight: 48,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  flowOn: { backgroundColor: theme.colors.surface },
  filterText: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  activeText: { fontFamily: theme.font.bodyBold, color: theme.colors.ink },
  group: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  comparison: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  note: { flex: 1, fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  explanation: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginBottom: 14,
  },
});
