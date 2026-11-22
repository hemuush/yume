import { Animated, Pressable, StyleSheet, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { CONTENT_ENTER } from '@/lib/animation';
import { haptics } from '@/lib/haptics';
import { usePressScale } from '@/hooks/usePressScale';
import { PALETTES, type Palette } from '@/theme/palette';
import type { AppearancePreference } from '@/theme/scheme';
import { themedStyles } from '@/theme/themedStyles';

const MODES: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** The picture height; the tile is this plus its label. */
const PREVIEW_H = 60;

/**
 * Colour mode as three small pictures of the app: what Light, Dark and "follow the phone" (half and half) look like,
 * drawn in each mode's own colours (never the live ones), so the choice is seen before it is made. The chosen one
 * has a ring and a tick that fade in; the tile shrinks a little under the finger.
 */
export function AppearancePicker({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (next: AppearancePreference) => void;
}) {
  return (
    <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel="Colour mode">
      {MODES.map((mode) => (
        <ModeTile
          key={mode.value}
          label={mode.label}
          mode={mode.value}
          selected={value === mode.value}
          onPress={() => {
            if (value === mode.value) return;
            haptics.tap();
            onChange(mode.value);
          }}
        />
      ))}
    </View>
  );
}

function ModeTile({
  label,
  mode,
  selected,
  onPress,
}: {
  label: string;
  mode: AppearancePreference;
  selected: boolean;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <Pressable
      style={s.slot}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.View style={animatedStyle}>
        <View style={s.frame}>
          <Preview mode={mode} />
          {selected && (
            <Reanimated.View pointerEvents="none" entering={CONTENT_ENTER} style={s.ring}>
              <View style={s.tick}>
                <Feather name="check" size={12} color={theme.colors.onInk} />
              </View>
            </Reanimated.View>
          )}
        </View>
        <Text style={[s.label, selected && s.labelOn]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** One mini screen: page, a hero card, two list lines and the coral add dot. "System" is Light and Dark side by side. */
function Preview({ mode }: { mode: AppearancePreference }) {
  if (mode !== 'system') return <MiniScreen palette={PALETTES[mode]} />;
  return (
    <View style={s.split}>
      <MiniScreen palette={PALETTES.dark} />
      <View style={s.lightHalf}>
        <View style={s.lightFull}>
          <MiniScreen palette={PALETTES.light} />
        </View>
      </View>
    </View>
  );
}

function MiniScreen({ palette }: { palette: Palette }) {
  return (
    <View style={[s.mini, { backgroundColor: palette.background }]}>
      <View style={[s.miniHero, { backgroundColor: palette.primary }]} />
      <View style={[s.miniCard, { backgroundColor: palette.surface, borderColor: palette.home.edge }]}>
        <View style={[s.miniLine, { backgroundColor: palette.textMuted, width: '70%' }]} />
        <View style={[s.miniLine, { backgroundColor: palette.textMuted, width: '45%' }]} />
      </View>
      <View style={[s.miniDot, { backgroundColor: palette.coral }]} />
    </View>
  );
}

const s = themedStyles(() =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
    slot: { flex: 1, minHeight: 44 },
    frame: {
      height: PREVIEW_H,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    ring: {
      ...StyleSheet.absoluteFill,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.colors.action,
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      padding: 5,
    },
    tick: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.action,
    },
    label: {
      marginTop: 6,
      textAlign: 'center',
      fontFamily: theme.font.bodyMedium,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    labelOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
    split: { flex: 1 },
    lightHalf: { ...StyleSheet.absoluteFill, right: '50%', overflow: 'hidden' },
    // Twice the tile wide, so the light picture is the left half of a whole one, not a squeezed copy.
    lightFull: { width: '200%', height: '100%' },
    mini: { flex: 1, padding: 8, gap: 6 },
    miniHero: { height: 18, borderRadius: 6 },
    miniCard: {
      flex: 1,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 6,
      gap: 4,
      justifyContent: 'center',
    },
    miniLine: { height: 4, borderRadius: 2, opacity: 0.55 },
    miniDot: { position: 'absolute', right: 8, bottom: 8, width: 10, height: 10, borderRadius: 5 },
  })
);
