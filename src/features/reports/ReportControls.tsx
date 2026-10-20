import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ActionSheet } from '@/components/ActionSheet';
import { ModalSheet } from '@/components/ModalSheet';
import { GLASS } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';

export type ReportTab = 'days' | 'cats' | 'trends';
export function ReportTabs({ value, onChange }: { value: ReportTab; onChange: (value: ReportTab) => void }) {
  return (
    <View style={s.tabs} accessibilityRole="tablist">
      {(
        [
          ['days', 'Days'],
          ['cats', 'Breakdown'],
          ['trends', 'Trends'],
        ] as const
      ).map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
          style={withPressed([s.tab, value === key && s.tabActive])}
        >
          <Text style={[s.tabText, value === key && s.tabOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BreakdownControls({
  flow,
  group,
  onFlow,
  onGroup,
  onLabels,
}: {
  flow: 'expense' | 'income';
  group: 'category' | 'account';
  onFlow: (value: 'expense' | 'income') => void;
  onGroup: (value: 'category' | 'account') => void;
  onLabels?: () => void;
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
    marginBottom: 14,
    padding: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fill,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  tabActive: { backgroundColor: theme.colors.ink },
  tabText: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  tabOn: { fontFamily: theme.font.roundedBold, color: theme.colors.surface },
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
