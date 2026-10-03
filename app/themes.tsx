import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { AppHeader } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { THEMES } from '@/theme/themes';
import { ThemePreview } from '@/features/profile/ThemePreview';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';

/**
 * Every theme pack as a small Home preview in its colours, two per row, labelled by name only. Tapping a
 * card switches the whole app at once. Reached from Profile › Settings › Appearance.
 */
export default function ThemesScreen() {
  const insets = useSafeAreaInsets();
  const { themeId, setTheme } = useAccent();

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
        <View style={styles.grid}>
          {THEMES.map((pack) => {
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
                accessibilityLabel={`${pack.name} theme`}
                accessibilityState={{ selected: active }}
              >
                <ThemePreview pack={pack} height={64} />
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  name: { flex: 1, fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.textPrimary },
  tick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
