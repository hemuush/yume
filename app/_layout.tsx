import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
// Scoped per-weight imports (not the package root) so Metro only bundles the
// exact font files used — importing from the package root pulls in every
// weight of the family regardless of which named exports are destructured.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono/700Bold';
import { Fredoka_400Regular } from '@expo-google-fonts/fredoka/400Regular';
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { getDb, consumeLoanDueDateRepairs } from '@/db/client';
import { resyncAllLoanReminders } from '@/db/loans';
import { isReturningFromOwnActivity } from '@/lib/appLock';
import { getNotificationPrefs, getHasOnboarded, setHasOnboarded, getAppLockEnabled } from '@/db/settings';
import { listAccounts, listTransactions } from '@/db/ledger';
import { runLocalBackupIfDue } from '@/lib/localBackup';
import { runDueRecurringRules } from '@/db/recurring';
import {
  ensureAndroidChannel,
  syncDailyReminder,
  syncWeeklySummary,
  cancelLegacyScheduledNotifications,
} from '@/lib/notifications';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';
import { AccentProvider } from '@/theme/AccentContext';
import { PrivacyProvider } from '@/theme/PrivacyContext';
import { AppLockProvider, useAppLock } from '@/lib/AppLockContext';
import { UndoToastProvider } from '@/components/UndoToast';
import { LockScreen } from '@/components/LockScreen';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { theme } from '@/constants/theme';

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
        // fire-and-forget; never blocks startup or shows an error
        void runLocalBackupIfDue();
        // Catches up any missed recurring transactions since last open. Each
        // rule now isolates its own failures internally; this catch only
        // guards the outer query (e.g. getDb()) from an unhandled rejection.
        void runDueRecurringRules().catch((err) => console.error('runDueRecurringRules failed:', err));
        // Setup just moved some pending loan installments off dates the old
        // month-end math got wrong (see repairLoanDueDates in db/client.ts) —
        // any due reminder already scheduled was for the old date.
        if (consumeLoanDueDateRepairs() > 0) {
          void resyncAllLoanReminders().catch((err) => console.error('resyncAllLoanReminders failed:', err));
        }
        // Unlike runDueRecurringRules/runLocalBackupIfDue above,
        // ensureAndroidChannel/syncDailyReminder/syncWeeklySummary have no
        // internal try/catch — each can genuinely reject (a bad trigger, a
        // permission the OS revoked), so this fire-and-forget chain needs
        // its own catch or a real rejection on cold start goes unhandled.
        void ensureAndroidChannel().catch((err) => console.error('ensureAndroidChannel failed:', err));
        // One-time: drop notifications still scheduled under the pre-rename
        // `flynse-*` identifiers.
        void cancelLegacyScheduledNotifications();
        // Re-schedules the daily reminder and weekly summary (if enabled) on
        // every cold start — scheduled notifications already survive a
        // normal restart, but this keeps them self-healing after a
        // reinstall or an OS-level clear.
        void getNotificationPrefs()
          .then((prefs) => {
            void syncDailyReminder(prefs).catch((err) => console.error('syncDailyReminder failed:', err));
            void syncWeeklySummary(prefs).catch((err) => console.error('syncWeeklySummary failed:', err));
          })
          .catch((err) => console.error('getNotificationPrefs failed:', err));

        setInitialLocked(await getAppLockEnabled());

        const alreadyOnboarded = await getHasOnboarded();
        if (alreadyOnboarded) {
          setNeedsOnboarding(false);
          return;
        }
        // The flag can be unset even on an existing install (added this
        // version) — real data is a more reliable signal than the flag
        // alone, so a tester who already has accounts/transactions never
        // sees onboarding just because the flag was never written before.
        const [accs, tx] = await Promise.all([listAccounts(), listTransactions({ limit: 1 })]);
        const hasExistingData = accs.length > 0 || tx.length > 0;
        if (hasExistingData) await setHasOnboarded(true);
        setNeedsOnboarding(!hasExistingData);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Database failed to start</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  // A failed font load previously left fontsLoaded permanently false with
  // no fallback — the app never left this spinner. Proceeding on error uses
  // whatever font Metro falls back to (visibly different, never blank/stuck)
  // rather than trapping every screen behind an infinite spinner.
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
  const appState = useRef(AppState.currentState);

  // Re-arms the lock whenever the app returns from the background. Reading
  // `lockEnabled` from shared context (rather than a value only set once at
  // cold start) means toggling the Settings switch takes effect on the very
  // next background/foreground cycle, not just after a full app restart.
  useEffect(() => {
    if (!lockEnabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active' &&
        !isReturningFromOwnActivity()
      ) {
        setIsLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [lockEnabled]);

  // Home-screen widgets refresh on their own every 30 minutes, but that's
  // too slow right after an edit — this catches every real change at once,
  // the moment the user actually backgrounds the app to go look at their
  // home screen, instead of a separate refresh call wired into every
  // individual transaction/loan/recurring-rule mutation across the app.
  // Deliberately its own effect (not folded into the lock one above, which
  // only runs at all when app-lock is enabled) so the widgets stay fresh
  // regardless of that setting.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      // 'inactive' alone isn't a real exit — it fires on plenty of
      // transient interruptions too (a permission dialog, an incoming call,
      // the notification shade, a share sheet), each of which would
      // otherwise trigger a full widget-data refresh (DB reads for every
      // placed widget) for no reason. Only 'background' means the user
      // actually left to go look at their home screen.
      if (next === 'background') refreshAllWidgets();
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
            // Swipe from anywhere on the screen to go back, not just the left
            // edge — a pushed screen (Profile, a detail view) should feel as
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
          <Stack.Screen name="recurring" />
          <Stack.Screen name="budgets" />
          <Stack.Screen name="savings-goals" />
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
  errorText: { fontSize: 16, fontWeight: '600', color: theme.colors.expense, marginBottom: 8 },
  errorDetail: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
});
