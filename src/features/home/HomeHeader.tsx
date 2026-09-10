import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { ScallopedEdge } from '@/components/ScallopedEdge';
import { YumeLogo } from '@/components/YumeLogo';
import { HeaderUserButton, HeaderIconButton } from '@/components/AppHeader';
import { PeriodCursor } from '@/lib/period';
import { MonthPill } from './MonthPill';

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

/**
 * The Home screen's own header — a slim sage-lime band (kept for identity,
 * along with the scalloped hand-off below it) carrying the brand, a warm
 * greeting, the softened bell/profile/settings buttons, and the compact
 * month pill from the reference design.
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
  const { accent, onAccent } = useAccent();
  const insets = useSafeAreaInsets();

  return (
    <>
      <View style={[styles.band, { backgroundColor: accent, paddingTop: insets.top + 10 }]}>
        <View style={styles.row}>
          <View style={styles.brandRow}>
            <YumeLogo size={22} />
            <Text style={[styles.brand, { color: onAccent }]}>Yume</Text>
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
            <HeaderIconButton
              icon="settings"
              onPress={() => router.push('/settings')}
              label="Settings"
              soft
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.greetWrap}>
            <Text style={[styles.greet, { color: onAccent }]} numberOfLines={1}>
              Good {greetingWord()}
              {userName ? `, ${userName}` : ''}
            </Text>
            <Text style={[styles.tagline, { color: onAccent }]} numberOfLines={1}>
              Better money. Bigger dreams.
            </Text>
          </View>
          <MonthPill cursor={cursor} onChange={onChange} />
        </View>
      </View>
      <ScallopedEdge color={accent} height={14} />
    </>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brand: { fontFamily: theme.font.roundedBold, fontSize: 21, letterSpacing: 0.2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetWrap: { flex: 1, minWidth: 0 },
  greet: { fontFamily: theme.font.roundedMedium, fontSize: 15 },
  tagline: { fontFamily: theme.font.body, fontSize: 11.5, opacity: 0.7, marginTop: 1 },
});
