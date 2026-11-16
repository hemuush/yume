import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { withPressed } from '@/lib/pressed';
import { themedStyles } from '@/theme/themedStyles';

/**
 * Plain text tabs on one hairline: the picked one in ink with an ink underline, the others in the muted tone. This is
 * how Plan, Reports and Profile switch between their parts. The row scrolls sideways if large text does not leave room
 * for every label, so no tab is ever cut or squeezed.
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
              onPress={() => onChange(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option.label}
              style={withPressed(styles.tab)}
            >
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                {option.label}
              </Text>
              {on && <View style={styles.underline} />}
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderSoft,
    },
    row: { gap: 22, alignItems: 'stretch' },
    tab: { minHeight: 44, justifyContent: 'center' },
    // One weight picked or not: the underline and the darker ink show the pick, and the word does not change width.
    label: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textMuted },
    labelOn: { color: theme.colors.textPrimary },
    underline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: -1,
      height: 2,
      backgroundColor: theme.colors.ink,
    },
  })
);
