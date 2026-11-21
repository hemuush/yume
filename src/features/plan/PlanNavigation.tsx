import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { useStacked } from '@/hooks/useStacked';
import { themedStyles } from '@/theme/themedStyles';

export type PlanTab = 'overview' | 'upcoming' | 'money' | 'debt';
export const PLAN_TABS: { label: string; value: PlanTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Money plan', value: 'money' },
  { label: 'Debt', value: 'debt' },
];

/** Plan's four parts in a stable row that stacks at larger text sizes. */
export function PlanNavigation({ value, onChange }: { value: PlanTab; onChange: (value: PlanTab) => void }) {
  const stacked = useStacked();
  const rows = stacked ? [PLAN_TABS.slice(0, 2), PLAN_TABS.slice(2)] : [PLAN_TABS];
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {rows.map((row) => (
        <View key={row[0].value} style={styles.row}>
          {row.map((tab) => {
            const selected = value === tab.value;
            return (
              <Pressable
                key={tab.value}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (selected) return;
                  haptics.tap();
                  onChange(tab.value);
                }}
                style={withPressed([styles.tab, selected && styles.activeTab])}
              >
                <Text style={[styles.label, selected && styles.selected]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    track: {
      gap: 6,
    },
    row: { flexDirection: 'row', gap: 6 },
    activeTab: { backgroundColor: theme.colors.action, borderColor: theme.colors.ink },
    tab: {
      borderRadius: theme.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
      flex: 1,
      minWidth: 0,
      minHeight: 40,
      paddingHorizontal: 3,
      paddingVertical: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 13,
      textAlign: 'center',
      color: theme.colors.home.secondaryText,
    },
    selected: { color: theme.colors.onInk },
  })
);
