import { Stack, router, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  AppState,
  AppStateStatus,
  InteractionManager,
} from 'react-native';
import { Text } from '@/components/Text';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
// Scoped per-weight imports (not the package root) so Metro bundles only the font files used; the root
// import pulls in every weight of the family.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono/700Bold';
import { Fredoka_400Regular } from '@expo-google-fonts/fredoka/400Regular';
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { getDb } from '@/db/client';
import { shouldRelock } from '@/lib/appLock';
import { getHasOnboarded, setHasOnboarded, getAppLockEnabled } from '@/db/settings';
import { listAccounts, listTransactions } from '@/db/ledger';
import { runLocalBackupIfDue } from '@/lib/localBackup';
import { runDueRecurringRules } from '@/db/recurring';
import {
  ensureAndroidChannel,
  rebuildNotifications,
  cancelLegacyScheduledNotifications,
  subscribeToNotificationTaps,
  NotificationRoute,
} from '@/lib/notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';
import { AccentProvider } from '@/theme/AccentContext';
import { PrivacyProvider } from '@/theme/PrivacyContext';
import { AppLockProvider, useAppLock } from '@/lib/AppLockContext';
import { UndoToastProvider } from '@/components/UndoToast';
import { AppDialogHost } from '@/components/AppDialog';
import { LockScreen } from '@/components/LockScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';

/**
 * Anchors deep links into pushed screens (Next Due widget, Quick Add) on cold start to the tabs, so Home
 * sits underneath and Back lands there instead of exiting the app. In-app navigation is unchanged.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLocked, setInitialLocked] = useState(false);
  const [fontsLoaded, fontsError] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
  });

  useEffect(() => {
    getDb()
      .then(async () => {
        setDbReady(true);
        // Fire-and-forget; never blocks startup or errors. Waits for the first screen to settle: reading
        // the whole ledger for the snapshot holds the DB queue, and Home's own queries should go first.
        InteractionManager.runAfterInteractions(() => void runLocalBackupIfDue());
        // Catches up missed recurring transactions since last open. Rules isolate their own failures; this
        // catch only guards the outer query (e.g. getDb()) from an unhandled rejection.
        void runDueRecurringRules().catch((err) => console.error('runDueRecurringRules failed:', err));
        // Unlike runDueRecurringRules/runLocalBackupIfDue, ensureAndroidChannel has no internal try/catch
        // and can reject (bad channel, revoked permission), so this call needs its own catch on cold start.
        void ensureAndroidChannel().catch((err) => console.error('ensureAndroidChannel failed:', err));
        // One-time: drop notifications still scheduled under the pre-rename
        // `flynse-*` identifiers.
        void cancelLegacyScheduledNotifications();
        // Notifications are rebuilt from settings/data each cold start: stays current (scheduled ~2 weeks
        // ahead), carries over old schedules, self-heals after reinstall.
        void rebuildNotifications();

        setInitialLocked(await getAppLockEnabled());

        const alreadyOnboarded = await getHasOnboarded();
        if (alreadyOnboarded) {
          setNeedsOnboarding(false);
          return;
        }
        // The flag can be unset on an existing install (added this version); real data is more reliable, so
        // a tester with accounts/transactions never sees onboarding just because the flag is unwritten.
        const [accs, tx] = await Promise.all([listAccounts(), listTransactions({ limit: 1 })]);
        const hasExistingData = accs.length > 0 || tx.length > 0;
        if (hasExistingData) await setHasOnboarded(true);
        setNeedsOnboarding(!hasExistingData);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database failed to start</Text>
        <Text style={styles.errorDetail}>{error}</Text>
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
        <AppLockProvider>
          <AccentProvider>
            <PrivacyProvider>
              <AppGate needsOnboarding={needsOnboarding} initialLocked={initialLocked} />
              {/* Yume's own confirm/notice dialog, shown by showAlert() anywhere in the app. */}
              <AppDialogHost />
            </PrivacyProvider>
          </AccentProvider>
        </AppLockProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

function AppGate({ needsOnboarding, initialLocked }: { needsOnboarding: boolean; initialLocked: boolean }) {
  const { lockEnabled } = useAppLock();
  const [isLocked, setIsLocked] = useState(initialLocked);
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding);

  // A tapped notification's screen (NOTIFICATION_ROUTES) waits until it can show: unlocked, past
  // onboarding, navigator mounted (not while the lock screen replaces the tree); earlier is lost or hidden.
  const navState = useRootNavigationState();
  const navReady = !!navState?.key;
  const [pendingRoute, setPendingRoute] = useState<NotificationRoute | null>(null);
  useEffect(() => subscribeToNotificationTaps(setPendingRoute), []);
  useEffect(() => {
    if (!pendingRoute || isLocked || showOnboarding || !navReady) return;
    // Next tick, not this render: right after unlocking the navigator is remounting. If opening still
    // fails, the app simply stays where it opened.
    const timer = setTimeout(() => {
      setPendingRoute(null);
      try {
        router.push(pendingRoute);
      } catch (e) {
        console.warn("Could not open the notification's screen:", e);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingRoute, isLocked, showOnboarding, navReady]);

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
  // refreshes home-screen widgets (30-min refresh is too slow); foreground runs the daily backup.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') refreshAllWidgets();
      if (next === 'active') void runLocalBackupIfDue();
    });
    return () => sub.remove();
  }, []);

  if (showOnboarding) {
    return (
      <>
        <StatusBar style="dark" />
        <Onboarding onDone={() => setShowOnboarding(false)} />
      </>
    );
  }

  if (isLocked) {
    // Replaces the whole tree rather than overlaying it — the real screens
    // stay unmounted while locked, not just visually covered.
    return (
      <>
        <StatusBar style="dark" />
        <LockScreen onUnlocked={() => setIsLocked(false)} />
      </>
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar style="dark" />
      <UndoToastProvider>
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
          <Stack.Screen name="budgets" />
          <Stack.Screen name="savings-goals" />
          <Stack.Screen name="loans" />
          <Stack.Screen name="recently-deleted" />
          <Stack.Screen name="themes" />
          {/* A Wrap fades in over the screen it was opened from, like a story, rather than sliding. */}
          <Stack.Screen name="wrap" options={{ animation: 'fade' }} />
        </Stack>
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
    fontSize: 16,
    color: theme.colors.expenseText,
    marginBottom: 8,
  },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
