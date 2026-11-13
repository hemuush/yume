import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { tooTight } from '@/lib/tooTight';

import { useAccent } from '@/theme/AccentContext';
import { interactionColors, selectedFill } from '@/theme/interactionColors';

/**
 * Match the main page filters, with a clear selected state and light tap feedback. When the longest word would not
 * fit a choice's share of the row (five types on a phone at large text), the tabs wrap two to a row.
 */
export function SheetTabs<T extends string>({
  options,
  value,
  onChange,
  variant = 'pill',
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'underline' | 'pill';
}) {
  const { accent } = useAccent();
  const colors = interactionColors(accent);
  const { width, fontScale } = useWindowDimensions();
  const wrap = tooTight(options, width, fontScale);
  return (
    <View
      style={[styles.row, variant === 'pill' && styles.pillRow, wrap && styles.rowWrap]}
      accessibilityRole="tablist"
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => {
            if (option.value === value) return;
            haptics.tap();
            onChange(option.value);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value }}
          style={withPressed([
            styles.tab,
            wrap && styles.tabWrap,
            variant === 'pill' && styles.pillTab,
            option.value === value &&
              (variant === 'pill'
                ? { backgroundColor: selectedFill(accent) }
                : [styles.selected, { borderBottomColor: colors.ink }]),
          ])}
        >
          <Text
            style={[
              styles.label,
              option.value === value && styles.active,
              variant === 'pill' && option.value === value && styles.pillActive,
            ]}
          >
            {option.label}
          </Text>
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
  rowWrap: { flexWrap: 'wrap' },
  // A share of the row that fits two to a line (a zero basis would let all of them squeeze onto one).
  tabWrap: { flex: undefined, flexGrow: 1, flexBasis: '45%' },
  pillRow: {
    borderBottomWidth: 0,
    padding: 3,
    gap: 4,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  pillTab: { borderBottomWidth: 0, borderRadius: 21 },
  pillActive: { color: theme.colors.textPrimary },
  label: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  active: { fontFamily: theme.font.bodyMedium, color: theme.colors.textPrimary },
});
