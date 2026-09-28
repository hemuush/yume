import { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { AppHeader } from '@/components/AppHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { THEMES, THEME_GROUPS, ThemeGroup, themeOrigin } from '@/theme/themes';
import { ThemePreview } from '@/features/profile/ThemePreview';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';

type Filter = 'all' | ThemeGroup;
const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  ...THEME_GROUPS.map((g) => ({ label: g, value: g })),
];

/**
 * Theme: every pack as a small preview of Home in its colours, two to a row
 * and filtered by where it comes from (the Theme packs sign-off). Tapping a
 * card switches the whole app to it straight away. Reached from Profile ›
 * Settings › Appearance.
 */
export default function ThemesScreen() {
  const insets = useSafeAreaInsets();
  const { themeId, setTheme } = useAccent();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = THEMES.filter((p) => filter === 'all' || p.group === filter);

  return (
    <View style={styles.container}>
      <AppHeader title="Theme" showBack />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: theme.layout.screenScrollPad + insets.bottom },
        ]}
      >
        <Text style={styles.caption}>Buttons, the active tab, highlights, widgets and Suu's dot.</Text>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        <View style={styles.grid}>
          {shown.map((pack) => {
            const active = pack.id === themeId;
            return (
              <Pressable
                key={pack.id}
                onPress={() => {
                  if (!active) haptics.tap();
                  setTheme(pack.id);
                }}
                style={withPressed([styles.card, active && styles.cardActive])}
                accessibilityRole="button"
                accessibilityLabel={`${pack.name}, ${pack.sub}. ${themeOrigin(pack)}`}
                accessibilityState={{ selected: active }}
              >
                <ThemePreview pack={pack} height={64} />
                <View style={styles.meta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {pack.name}
                    </Text>
                    {active && (
                      <View style={styles.tick}>
                        <Feather name="check" size={10} color={theme.colors.surface} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.from} numberOfLines={1}>
                    {pack.from ?? 'The default'}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {pack.sub}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: theme.layout.screenTopGap, gap: 14 },
  caption: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: {
    width: '48.5%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  cardActive: { borderWidth: 2, borderColor: theme.colors.ink },
  meta: { paddingHorizontal: 11, paddingTop: 8, paddingBottom: 11, gap: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  name: { flex: 1, fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.textPrimary },
  tick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  from: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
  sub: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textMuted },
});
