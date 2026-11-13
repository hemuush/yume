import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';

export type ProfileTab = 'you' | 'settings';
const TABS: { label: string; value: ProfileTab }[] = [
  { label: 'You', value: 'you' },
  { label: 'Settings', value: 'settings' },
];

/** You | Settings as two plain tabs on one hairline: the picked one bold with an ink underline. */
export function ProfileTabs({ value, onChange }: { value: ProfileTab; onChange: (tab: ProfileTab) => void }) {
  const { accent } = useAccent();
  const ink = themeInk(accent);
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const on = value === tab.value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            style={withPressedTint(accent, styles.tab)}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
            {on && <View style={[styles.underline, { backgroundColor: ink }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    marginHorizontal: SCREEN.gutter,
    marginTop: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // One weight picked or not: the underline and the darker ink show the pick, and the word does not change width
  // (the picked one stepped about 2 dp each time).
  label: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textMuted },
  labelOn: { color: theme.colors.textPrimary },
  underline: { position: 'absolute', left: '30%', right: '30%', bottom: -1, height: 3, borderRadius: 2 },
});
