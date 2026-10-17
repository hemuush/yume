import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import { markWrapSeen } from '@/db/settings';
import { errorMessage } from '@/lib/errorMessage';
import { loadMonthWrap, loadWeekWrap, Wrap, wrapRange } from '@/features/wrap/wrapData';
import { WrapPlayer } from '@/features/wrap/WrapPlayer';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';

/**
 * `/wrap?period=month|week` (last month / last full week) from Home's Wrap button or the Monday
 * notification; "See the full report" opens Reports on it. Marked seen as it starts.
 */
export default function WrapScreen() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  const kind = period === 'week' ? 'week' : 'month';
  const { accent, secondary } = useAccent();
  // undefined while loading; null when there's nothing to play.
  const [wrap, setWrap] = useState<Wrap | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setWrap(undefined);
    setError(null);
    (kind === 'week' ? loadWeekWrap() : loadMonthWrap())
      .then((w) => {
        if (alive) setWrap(w);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [kind, retry]);

  useEffect(() => {
    if (wrap) markWrapSeen(wrap.key).catch(() => {});
  }, [wrap]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // `navigate`, not `push` or `replace`: Reports is a tab, so this goes back
  // to the tabs and switches to it, instead of stacking a second copy of them.
  const openReport = () => {
    if (!wrap) return;
    const range = wrapRange(wrap);
    router.navigate(`/reports?from=${range.start}&to=${range.end}`);
  };
  const openDay = (date: string) => router.navigate(`/reports?from=${date}&to=${date}`);

  if (wrap)
    return (
      <WrapPlayer
        key={`${wrap.period}:${wrap.key}`}
        wrap={wrap}
        onClose={close}
        onOpenReport={openReport}
        onOpenDay={openDay}
      />
    );

  return (
    <View style={styles.center}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      {error || wrap === null ? (
        <>
          <Text style={styles.title}>{error ? "Couldn't make your Wrap" : 'Nothing to wrap yet'}</Text>
          <Text style={styles.detail}>{error ?? 'Nothing went out in that period.'}</Text>
          {error && (
            <PrimaryButton
              title="Try again"
              onPress={() => setRetry((value) => value + 1)}
              style={styles.button}
            />
          )}
          <PrimaryButton title="Close" variant="secondary" onPress={close} style={styles.button} />
        </>
      ) : (
        <ActivityIndicator color={theme.colors.ink} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  detail: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  button: { marginTop: 20, alignSelf: 'stretch' },
});
