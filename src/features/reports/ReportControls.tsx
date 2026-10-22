import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { ActionSheet } from '@/components/ActionSheet';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';

import { SegmentedControl } from '@/components/SegmentedControl';

export type ReportTab = 'days' | 'cats' | 'trends';
const TAB_LABELS = [
  ['days', 'Overview'],
  ['cats', 'Breakdown'],
  ['trends', 'Trends'],
] as const;

/** Three lenses in the same pill switch as Plan's tabs, so the two screens read as one family. */
export function ReportTabs({ value, onChange }: { value: ReportTab; onChange: (value: ReportTab) => void }) {
  return (
    <View style={s.tabs}>
      <SegmentedControl
        options={TAB_LABELS.map(([key, label]) => ({ label, value: key }))}
        value={value}
        onChange={onChange}
        onBand
      />
    </View>
  );
}

/** Spending or income, in the same pill switch as the tabs above it. */
export function FlowSwitch({
  flow,
  onFlow,
}: {
  flow: 'expense' | 'income';
  onFlow: (value: 'expense' | 'income') => void;
}) {
  return (
    <View style={s.flow}>
      <SegmentedControl
        options={[
          { label: 'Spending', value: 'expense' as const },
          { label: 'Income', value: 'income' as const },
        ]}
        value={flow}
        onChange={onFlow}
        onBand
      />
    </View>
  );
}

/** "By category" as one small dropdown on the summary card; it also offers expense labels while spending. */
export function GroupPicker({
  flow,
  group,
  onGroup,
  onLabels,
}: {
  flow: 'expense' | 'income';
  group: 'category' | 'account';
  onGroup: (value: 'category' | 'account') => void;
  onLabels?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Group breakdown: By ${group}. Change`}
        style={withPressed(s.group)}
      >
        <Text style={s.groupText}>{group === 'category' ? 'By category' : 'By account'}</Text>
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
    </>
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
  // The same margins as Plan's tabs.
  tabs: { marginHorizontal: 16, marginTop: theme.layout.screenTopGap, marginBottom: 6 },
  flow: { marginBottom: 12 },
  group: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.tray,
  },
  groupText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
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
