import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';

/** Quiet sheet navigation without another full-width pill card. */
export function SheetTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          style={withPressed([styles.tab, option.value === value && styles.selected])}
        >
          <Text style={[styles.label, option.value === value && styles.active]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSoft,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selected: { borderBottomColor: theme.colors.ink },
  label: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  active: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
