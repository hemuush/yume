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
              // The pill is 36dp tall; the slop lifts the touch target to 48dp without changing how it looks.
              hitSlop={{ top: 6, bottom: 6 }}
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
    // The same separate pills as Plan's tabs: the picked one solid ink, the rest white with a hairline.
    bar: { marginHorizontal: SCREEN.gutter, marginTop: 2 },
    row: { flexGrow: 1, gap: 6, alignItems: 'stretch' },
    tab: {
      flexGrow: 1,
      minHeight: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
      paddingHorizontal: 14,
    },
    tabOn: { backgroundColor: theme.colors.action, borderColor: theme.colors.ink },
    label: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.home.secondaryText },
    labelOn: { color: theme.colors.onInk },
  })
);
