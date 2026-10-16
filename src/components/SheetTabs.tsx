import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';

/** Quiet sheet navigation without another full-width pill card. */
export function SheetTabs<T extends string>({
  options,
  value,
  onChange,
  variant = 'underline',
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'underline' | 'pill';
}) {
  return (
    <View style={[styles.row, variant === 'pill' && styles.pillRow]} accessibilityRole="tablist">
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          style={withPressed([
            styles.tab,
            variant === 'pill' && styles.pillTab,
            option.value === value && (variant === 'pill' ? styles.pillSelected : styles.selected),
          ])}
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
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selected: {
    borderBottomColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  pillRow: {
    borderBottomWidth: 0,
    padding: 3,
    gap: 4,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pillTab: { borderBottomWidth: 0, borderRadius: 21 },
  pillSelected: { backgroundColor: theme.colors.surface },
  label: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  active: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
