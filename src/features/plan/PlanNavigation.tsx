import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { SegmentedControl } from '@/components/SegmentedControl';
import { GLASS } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { withPressedTint } from '@/lib/pressed';

import { useAccent } from '@/theme/AccentContext';
import { selectedFill } from '@/theme/interactionColors';

export type PlanTab = 'overview' | 'upcoming' | 'money' | 'debt';
export const PLAN_TABS: { label: string; value: PlanTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Money plan', value: 'money' },
  { label: 'Debt', value: 'debt' },
];

/** Keep every destination visible; enlarged labels get two rows of two pills. */
export function PlanNavigation({
  value,
  onChange,
  stacked,
}: {
  value: PlanTab;
  onChange: (value: PlanTab) => void;
  stacked: boolean;
}) {
  const { accent } = useAccent();
  if (!stacked) return <SegmentedControl options={PLAN_TABS} value={value} onChange={onChange} onBand />;
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {[PLAN_TABS.slice(0, 2), PLAN_TABS.slice(2)].map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((tab) => (
            <Pressable
              key={tab.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: value === tab.value }}
              onPress={() => {
                if (value === tab.value) return;
                haptics.tap();
                onChange(tab.value);
              }}
              style={withPressedTint(accent, [
                styles.tab,
                value === tab.value && { backgroundColor: selectedFill(accent) },
              ])}
            >
              <Text style={[styles.label, value === tab.value && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    padding: 4,
    gap: 4,
    borderRadius: 24,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  row: { flexDirection: 'row', gap: 4 },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  label: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  activeLabel: { fontFamily: theme.font.roundedBold, color: theme.colors.textPrimary },
});
