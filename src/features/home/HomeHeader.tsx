import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { ScallopedEdge } from '@/components/ScallopedEdge';
import { YumeLogo } from '@/components/YumeLogo';
import { SuuIllustration } from '@/components/SuuIllustration';
import { HeaderIconButton, HeaderUserButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// Four small "sparks" scattered through the gradient — a wink at "Yume"
// (dream) rather than a busy repeating pattern. Positions are fractions of
// the band's own size so they scale with it instead of needing a fixed
// height.
const SPARKS: { top: number; left: number; size: number; opacity: number }[] = [
  { top: 0.2, left: 0.58, size: 5, opacity: 0.9 },
  { top: 0.44, left: 0.78, size: 3, opacity: 0.75 },
  { top: 0.62, left: 0.5, size: 4, opacity: 0.55 },
  { top: 0.28, left: 0.36, size: 3, opacity: 0.7 },
];

/**
 * The Home screen's own header — previously a flat block of the user's
 * accent colour (read as "too dark" against the rest of the app's calm,
 * mostly-neutral register). Now a soft gradient from a light wash of that
 * same accent down into the page's own cream — like early light rather than
 * a solid panel — with Suu (the mascot, otherwise boxed into a card lower on
 * the page) waking up in the corner. "Yume" means dream; this is the one
 * place in the app that gets to feel like one. Still fully derived from the
 * user's chosen accent (same `shade()` technique as the Reports moon and
 * heatmap), so picking a different accent retints the whole thing.
 */
export function HomeHeader({
  cursor,
  onChange,
  userName,
  hasAlerts,
}: {
  cursor: PeriodCursor;
  onChange: (next: PeriodCursor) => void;
  userName: string | null;
  hasAlerts: boolean;
}) {
  const { accent } = useAccent();
  const insets = useSafeAreaInsets();
  const gradientTop = shade(accent, 88, 4);
  const gradientBottom = shade(accent, 96, 2);

  return (
    <>
      <View style={[styles.band, { paddingTop: insets.top + 10 }]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="homeBandGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={gradientTop} />
              <Stop offset="1" stopColor={gradientBottom} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#homeBandGrad)" />
        </Svg>

        {SPARKS.map((s, i) => (
          <View
            key={i}
            style={[
              styles.spark,
              {
                top: `${s.top * 100}%`,
                left: `${s.left * 100}%`,
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                opacity: s.opacity,
              },
            ]}
          />
        ))}

        <View style={styles.suuWrap} pointerEvents="none">
          <SuuIllustration size={74} />
        </View>

        <View style={styles.row}>
          <View style={styles.brandRow}>
            <YumeLogo size={22} />
            <Text style={styles.brand}>Yume</Text>
          </View>
          <View style={styles.actions}>
            <HeaderIconButton
              icon="bell"
              onPress={() => router.push('/notifications')}
              label="Notifications"
              badge={hasAlerts}
              soft
            />
            <HeaderUserButton soft />
          </View>
        </View>

        <View style={styles.greetWrap}>
          <Text style={styles.greet} numberOfLines={1}>
            Good {greetingWord()}
            {userName ? `, ${userName}` : ''}
          </Text>
          <Text style={styles.tagline} numberOfLines={1}>
            Better money. Bigger dreams.
          </Text>
        </View>

        <View style={styles.monthRow}>
          <MonthPill cursor={cursor} onChange={onChange} />
        </View>
      </View>
      <ScallopedEdge color={gradientBottom} height={14} />
    </>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 14, gap: 12, overflow: 'hidden' },
  spark: { position: 'absolute', backgroundColor: theme.colors.surface },
  // Half-hidden behind the greeting, top-right — "just woke up with you"
  // rather than a mascot posed front and centre.
  suuWrap: { position: 'absolute', top: 4, right: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { fontFamily: theme.font.roundedBold, fontSize: 21, letterSpacing: 0.2, color: theme.colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetWrap: { marginTop: 22 },
  greet: { fontFamily: theme.font.roundedMedium, fontSize: 15, color: theme.colors.ink },
  tagline: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.inkSoft, marginTop: 1 },
  monthRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
});
