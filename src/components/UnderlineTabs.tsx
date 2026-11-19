import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { withPressed } from '@/lib/pressed';
import { themedStyles } from '@/theme/themedStyles';

/**
 * A compact tab tray that can scroll when enlarged labels need more room.
 */
export function UnderlineTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.bar}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="tablist"
      >
        {options.map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (!on) onChange(option.value);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option.label}
              style={withPressed([styles.tab, on && styles.tabOn])}
            >
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bar: {
      marginHorizontal: SCREEN.gutter,
      marginTop: 2,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.home.control,
    },
    row: { flexGrow: 1, gap: 4, padding: 3, alignItems: 'stretch' },
    tab: {
      flexGrow: 1,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
    },
    tabOn: { backgroundColor: theme.colors.home.selected },
    label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
    labelOn: { color: theme.colors.textPrimary },
  })
);
