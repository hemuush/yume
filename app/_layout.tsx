import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
// Scoped per-weight imports (not the package root) so Metro bundles only the font files used; the root
// import pulls in every weight of the family.
import { Archivo_300Light } from '@expo-google-fonts/archivo/300Light';
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono/700Bold';
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { getDb } from '@/db/client';
import { shouldRelock } from '@/lib/appLock';
import { useScreenCaptureProtection } from '@/lib/useScreenCaptureProtection';
import { CaptureProtectionScreen } from '@/components/CaptureProtectionScreen';
import { CaptureReleaseFeedback } from '@/components/CaptureReleaseFeedback';
import { AppLockSaveFeedback } from '@/components/AppLockSaveFeedback';
import { getHasOnboarded, setHasOnboarded, getAppLockEnabled, getHideSensitiveAmounts } from '@/db/settings';
import { listAccounts, listTransactions } from '@/db/ledger';
import { runAppMaintenance } from '@/lib/runAppMaintenance';
import { runWhenIdle } from '@/lib/runWhenIdle';
import {
  ensureAndroidChannel,
  rebuildNotifications,
  cancelLegacyScheduledNotifications,
  subscribeToNotificationTaps,
  NotificationRoute,
} from '@/lib/notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';
import { AccentProvider, useAccent } from '@/theme/AccentContext';
import { PrivacyProvider } from '@/theme/PrivacyContext';
import { AppLockProvider, useAppLock } from '@/lib/AppLockContext';
import { UndoToastProvider } from '@/components/UndoToast';
import { MilestoneNoteProvider, BudgetMonthWatcher } from '@/components/MilestoneNote';
import { CardGrowHost } from '@/components/CardGrowHost';
import { isGrowRoute } from '@/lib/cardGrow';
import { AppDialogHost } from '@/components/AppDialog';
import { ThemeSaveFeedback } from '@/theme/ThemeSaveFeedback';
import { LockScreen } from '@/components/LockScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { theme } from '@/constants/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { errorMessage } from '@/lib/errorMessage';

/**
 * Anchors deep links into pushed screens (Next Due widget, Quick Add) on cold start to the tabs, so Home
 * sits underneath and Back lands there instead of exiting the app. In-app navigation is unchanged.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

const growOptions = ({ route }: { route: { params?: object } }) => ({
  animation: isGrowRoute(route.params) ? ('fade' as const) : ('slide_from_right' as const),
});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLocked, setInitialLocked] = useState(false);
  // Bumped by "Try again" so the startup effect runs again after a failed database start.
  const [startAttempt, setStartAttempt] = useState(0);
  const [fontsLoaded, fontsError] = useFonts({
    Archivo_300Light,
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
  });

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then(async () => {
        if (cancelled) return;
        setDbReady(true);
        // Start after the first screen settles. Catch-up finishes before the snapshot is taken.
        runWhenIdle(() => {
          void runAppMaintenance().catch((err) => console.error('App maintenance failed:', err));
        });
        // Channel setup can reject after a permission change; contain that failure on cold start.
        void ensureAndroidChannel().catch((err) => console.error('ensureAndroidChannel failed:', err));
        // Drops notifications still scheduled under the pre-rename `flynse-*` ids, then rebuilds them all from
        // settings and data (about two weeks ahead, so a reinstall heals). Runs once the first screen has
        // settled: it reads plenty and its bridge calls shouldn't hold up Home's first paint.
        runWhenIdle(() => {
          void cancelLegacyScheduledNotifications().catch((err) =>
            console.error('cancelLegacyScheduledNotifications failed:', err)
          );
          void rebuildNotifications().catch((err) => console.error('rebuildNotifications failed:', err));
        });

        // Prime masking before mounting any financial screen, including an unlocked cold launch.
        const [locked] = await Promise.all([getAppLockEnabled(), getHideSensitiveAmounts()]);
        if (cancelled) return;
        setInitialLocked(locked);

        const alreadyOnboarded = await getHasOnboarded();
        if (cancelled) return;
        if (alreadyOnboarded) {
          setNeedsOnboarding(false);
          return;
        }
        // The flag can be unset on an existing install (added this version); real data is more reliable, so
        // a tester with accounts/transactions never sees onboarding just because the flag is unwritten.
        const [accs, tx] = await Promise.all([listAccounts(), listTransactions({ limit: 1 })]);
        const hasExistingData = accs.length > 0 || tx.length > 0;
        if (hasExistingData) await setHasOnboarded(true);
        if (cancelled) return;
        setNeedsOnboarding(!hasExistingData);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [startAttempt]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database failed to start</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <PrimaryButton
          title="Try again"
          onPress={() => {
            // getDb() clears its cached failure, so a second call really does retry the setup.
            setError(null);
            setStartAttempt((n) => n + 1);
          }}
          style={styles.retry}
        />
      </View>
    );
  }

  // On font-load failure, proceed with Metro's fallback font (visibly different, never blank/stuck) rather
  // than trapping every screen behind an infinite spinner.
  if (!dbReady || (!fontsLoaded && !fontsError) || needsOnboarding === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <AppLockProvider initialLockEnabled={initialLocked}>
          <AccentProvider>
            <PrivacyProvider>
              <AppGate needsOnboarding={needsOnboarding} initialLocked={initialLocked} />
            </PrivacyProvider>
          </AccentProvider>
        </AppLockProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

function AppGate({ needsOnboarding, initialLocked }: { needsOnboarding: boolean; initialLocked: boolean }) {
  const { waitForThemePersistence } = useAccent();
  const { lockEnabled } = useAppLock();
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);
  const capture = useScreenCaptureProtection(lockEnabled);

  // A tapped notification's screen (NOTIFICATION_ROUTES) waits until it can show: unlocked, past
  // onboarding, navigator mounted (not while the lock screen replaces the tree); earlier is lost or hidden.
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const [pendingRoute, setPendingRoute] = useState<NotificationRoute | null>(null);
  useEffect(() => subscribeToNotificationTaps(setPendingRoute), []);
  useEffect(() => {
    if (!pendingRoute || isLocked || showOnboarding || !navReady || capture.isBlocked) return;
    // Next tick, not this render: right after unlocking the navigator is remounting. If opening still
    // fails, the app simply stays where it opened.
    const timer = setTimeout(() => {
      setPendingRoute(null);
      try {
        // navigate, not push: already on that screen (or a tab) it goes there instead of stacking a copy.
        router.navigate(pendingRoute);
      } catch (e) {
        console.warn("Couldn't open the notification's screen:", e);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingRoute, isLocked, showOnboarding, navReady, capture.isBlocked]);

  // Re-arms the lock when the app returns after being away (shouldRelock: real backgrounding, ≥1 minute).
  // Reads `lockEnabled` from shared context so the Settings toggle applies next cycle.
  useEffect(() => {
    if (!lockEnabled) return;
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') backgroundedAt ??= Date.now();
      if (next === 'active') {
        if (shouldRelock(backgroundedAt, Date.now())) setIsLocked(true);
        backgroundedAt = null;
      }
    });
    return () => sub.remove();
  }, [lockEnabled]);

  // Kept apart from the lock effect (runs only with app-lock on). Real 'background' (not 'inactive')
  // refreshes home-screen widgets (30-min refresh is too slow); foreground runs the daily backup and posts
  // repeating entries that fell due while away (Android can keep Yume alive for days without a cold start).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') void waitForThemePersistence().then(refreshAllWidgets);
      if (next === 'active') {
        runWhenIdle(() => {
          void runAppMaintenance().catch((err) => console.error('App maintenance failed:', err));
        });
      }
    });
    return () => sub.remove();
  }, [waitForThemePersistence]);

  // Once the app is on screen, turning the lock on from Settings only re-checks protection in the background:
  // swapping the tree for the capture screen would unmount the navigator and drop the user back on Home.
  const contentShown = useRef(false);
  useEffect(() => {
    if (isLocked || showOnboarding) contentShown.current = false;
    else if (!capture.isBlocked) contentShown.current = true;
  }, [isLocked, showOnboarding, capture.isBlocked]);
  const holdContent = capture.isBlocked && !(contentShown.current && capture.status === 'checking');

  // Public authentication stays mounted while protection recovers; financial/onboarding content does not.
  if (holdContent && !(isLocked && !showOnboarding)) {
    return (
      <ErrorBoundary>
        <StatusBar style="dark" />
        <CaptureProtectionScreen
          status={capture.status === 'failed' ? 'failed' : 'checking'}
          onRetry={capture.retry}
        />
      </ErrorBoundary>
    );
  }

  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <StatusBar style="dark" />
        <Onboarding onDone={() => setShowOnboarding(false)} />
        <AppDialogHost />
      </ErrorBoundary>
    );
  }

  if (isLocked) {
    // Replaces the whole tree rather than overlaying it — the real screens
    // stay unmounted while locked, not just visually covered.
    return (
      <ErrorBoundary>
        <StatusBar style="dark" />
        <LockScreen onUnlocked={() => setIsLocked(false)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      {/* Yume's own confirm/notice dialog, shown by showAlert() anywhere in the app. Never over the lock
          screen: a dialog is its own window, so it would sit on top of it with working buttons. */}
      <AppDialogHost />
      <AppLockSaveFeedback />
      <CaptureReleaseFeedback protection={capture} />
      <UndoToastProvider>
        <ThemeSaveFeedback />
        <MilestoneNoteProvider>
          {/* freezeOnBlur is left OFF: with it on (the navigator default), a
            blurred screen's React tree is suspended and can miss context
            updates that happen while it's off-screen — e.g. toggling "hide
            amounts" from the Profile header left the Settings switch showing
            the old state until a full remount. The screens here are light, so
            keeping them live costs little. */}
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 260,
              // Swipe from anywhere to go back, not just the left edge: a pushed screen should feel as
              // dismissible as it looks.
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              freezeOnBlur: false,
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="backup" />
            <Stack.Screen name="notification-settings" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="add-transaction" />
            <Stack.Screen name="split" />
            <Stack.Screen name="recurring" />
            <Stack.Screen name="people" />
            <Stack.Screen name="tidy-up" />
            <Stack.Screen name="whatif" />
            <Stack.Screen name="garden" />
            {/* A page opened from a card that grows into it (see CardGrowHost) fades in under the growing card. */}
            <Stack.Screen name="budgets" options={growOptions} />
            <Stack.Screen name="savings-goals" options={growOptions} />
            <Stack.Screen name="category/[id]" options={growOptions} />
            <Stack.Screen name="loans" />
            <Stack.Screen name="recently-deleted" />
            <Stack.Screen name="themes" />
            {/* A Wrap fades in over the screen it was opened from, like a story, rather than sliding. */}
            <Stack.Screen name="wrap" options={{ animation: 'fade' }} />
          </Stack>
          <BudgetMonthWatcher />
          <CardGrowHost />
        </MilestoneNoteProvider>
      </UndoToastProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  errorText: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 15,
    color: theme.colors.expenseText,
    marginBottom: 8,
  },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retry: { marginTop: 20, alignSelf: 'center', minWidth: 160 },
});
