import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { SkyHeader } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { THEMES } from '@/theme/themes';
import { ThemePreview } from '@/features/profile/ThemePreview';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { Glass, GLASS } from '@/components/Glass';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { SwitchRow } from '@/components/SwitchRow';
import { showAlert } from '@/components/AppDialog';
import { appIconSupported } from '@/lib/appIcon';
import { getThemeIconFollows, setThemeIconFollows } from '@/db/settings';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { PrimaryButton } from '@/components/PrimaryButton';

/**
 * The pack you're on as a live phone at the top, then every pack as a small Home preview in its colours, two
 * per row. Tapping a card switches the whole app at once, wallpaper included. Reached from Profile › Settings ›
 * Appearance.
 */
export default function ThemesScreen() {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { themeId, setTheme, accent, secondary, themeSaveError } = useAccent();
  const current = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const iconSupported = appIconSupported();
  const [iconFollows, setIconFollows] = useState<boolean | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [iconRetry, setIconRetry] = useState(0);
  const [iconSaving, setIconSaving] = useState(false);
  useEffect(() => {
    if (!iconSupported) return;
    let alive = true;
    setIconError(null);
    getThemeIconFollows().then(
      (value) => {
        if (alive) setIconFollows(value);
      },
      () => {
        if (alive) setIconError("Couldn't load the app icon setting.");
      }
    );
    return () => {
      alive = false;
    };
  }, [iconSupported, iconRetry]);
  const saveIcon = useSaveOnce(async (next: boolean) => {
    setIconSaving(true);
    try {
      await setThemeIconFollows(next);
      setIconFollows(next);
    } catch {
      showAlert('Could not save', 'The app icon setting was not saved. Try again.');
    } finally {
      setIconSaving(false);
    }
  });
  const saveIconFollows = (next: boolean) => {
    if (iconFollows == null || iconSaving) return;
    if (!next) return void saveIcon(next);
    showAlert(
      'Match the app icon to the theme?',
      'The icon changes when you leave the app. Some launchers restart Yume while they refresh it, and a few drop a Yume icon you pinned, so you may need to pin it again.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Match icon', onPress: () => void saveIcon(next) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}

        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + theme.layout.screenTopGap,
            paddingBottom: theme.layout.screenScrollPad + insets.bottom,
          },
        ]}
      >
        {themeSaveError && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ color: theme.colors.expenseText, padding: theme.space.md }}
          >
            {themeSaveError.message}
          </Text>
        )}
        <Glass radius={28} tone="strong" style={styles.live}>
          <View style={styles.phone}>
            <ThemePreview pack={current} height={200} detailed />
          </View>
          <View style={styles.liveText}>
            <Text style={styles.liveKicker}>Now on</Text>
            <Text style={styles.liveName}>{current.name}</Text>
            <Text style={styles.caption}>
              Tints the wallpaper, buttons, the active tab, highlights, widgets and Suu's dot.
            </Text>
            <View style={styles.pair}>
              <View style={styles.pairItem}>
                <View style={[styles.pairDot, { backgroundColor: current.primary }]} />
                <Text style={styles.pairText}>Main</Text>
              </View>
              <View style={styles.pairItem}>
                <View style={[styles.pairDot, { backgroundColor: current.secondary }]} />
                <Text style={styles.pairText}>Second</Text>
              </View>
            </View>
          </View>
        </Glass>
        {iconSupported && (
          <SwitchRow
            title="Match the app icon"
            hint="The launcher icon takes the theme's colours."
            value={iconFollows ?? false}
            disabled={iconFollows == null || iconSaving}
            onChange={saveIconFollows}
          />
        )}
        {iconError && (
          <View>
            <Text accessibilityRole="alert">{iconError}</Text>
            <PrimaryButton
              title="Retry app icon setting"
              variant="secondary"
              compact
              onPress={() => setIconRetry((value) => value + 1)}
            />
          </View>
        )}
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
                <View style={styles.swatch}>
                  <ThemePreview pack={pack} height={74} />
                </View>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={2}>
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
      </ReanimatedAnimated.ScrollView>
      <SkyHeader collapse={collapse} title="Theme" showBack hideUser wallpaper />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, gap: 12 },
  caption: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  live: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  phone: {
    width: 120,
    height: 200,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  liveText: { flex: 1, minWidth: 0, gap: 6 },
  liveKicker: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  liveName: { fontFamily: theme.font.roundedBold, fontSize: 20, color: theme.colors.textPrimary },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  pairItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pairDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: theme.colors.white },
  pairText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: {
    width: '48.5%',
    padding: 7,
    backgroundColor: GLASS.fill,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS.edge,
    boxShadow: GLASS.shadow,
  },
  swatch: { borderRadius: 14, overflow: 'hidden' },
  cardActive: { borderWidth: 2, borderColor: theme.colors.ink },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 9,
    paddingBottom: 4,
  },
  name: { flex: 1, fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textPrimary },
  tick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
