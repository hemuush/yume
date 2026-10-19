import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { SegmentedControl } from '@/components/SegmentedControl';
import { GLASS } from '@/components/Glass';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';

export type PlanTab = 'overview' | 'upcoming' | 'budgets' | 'goals' | 'debt';
export const PLAN_TABS: { label: string; value: PlanTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Budgets', value: 'budgets' },
  { label: 'Goals', value: 'goals' },
  { label: 'Debt', value: 'debt' },
];

/** Keep every destination visible; enlarged labels get three pills above two. */
export function PlanNavigation({
  value,
  onChange,
  stacked,
}: {
  value: PlanTab;
  onChange: (value: PlanTab) => void;
  stacked: boolean;
}) {
  if (!stacked) return <SegmentedControl options={PLAN_TABS} value={value} onChange={onChange} onBand />;
  return (
    <View style={styles.track}>
      {[PLAN_TABS.slice(0, 3), PLAN_TABS.slice(3)].map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((tab) => (
            <Pressable
              key={tab.value}
              accessibilityRole="button"
              accessibilityState={{ selected: value === tab.value }}
              onPress={() => {
                if (value === tab.value) return;
                haptics.tap();
                onChange(tab.value);
              }}
              style={withPressed([styles.tab, value === tab.value && styles.active])}
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
  active: { backgroundColor: theme.colors.ink },
  label: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  activeLabel: { fontFamily: theme.font.roundedBold, color: theme.colors.surface },
});
