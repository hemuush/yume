import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { withPressedTint } from '@/lib/pressed';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkyHeader } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { SolidFade } from '@/components/SolidFade';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { Section } from '@/components/Section';
import { SCREEN } from '@/components/screenStyles';
import { AlertRow, type AlertKey } from '@/features/notifications/AlertRow';
import { SlotCard } from '@/features/notifications/SlotCard';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import type { NotificationPrefs } from '@/db/settings';
import { useNotificationPreferences } from '@/features/notifications/useNotificationPreferences';
import { useLocalDayRefresh } from '@/hooks/useLocalDayRefresh';
import { useStableCallback } from '@/hooks/useStableCallback';
import { keepIfEqual } from '@/lib/stableData';
import {
  rebuildFailed,
  rebuildNotifications,
  requestNotificationPermission,
  requestExactAlarmPermission,
  getNotificationDeliveryStatus,
  sendTestNotification,
  NotificationDeliveryStatus,
} from '@/lib/notifications';
import { TimeSlotKind, clampSlotMinutes } from '@/lib/notificationTimes';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsRow } from '@/components/SettingsRow';
import { useAccent } from '@/theme/AccentContext';
import { ListCard } from '@/components/SummaryCard';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { DayArc } from '@/features/notifications/DayArc';
import { themedStyles } from '@/theme/themedStyles';

type SwitchKey =
  | 'morningEnabled'
  | 'eveningEnabled'
  | 'billAlerts'
  | 'overspendAlerts'
  | 'weeklySummary'
  | 'recurringAlerts'
  | 'refundAlerts';

const noTimesEarly = (p: NotificationPrefs) => !p.morningEnabled && !p.eveningEnabled;
const MENTION_KEYS = [
  'billAlerts',
  'overspendAlerts',
  'recurringAlerts',
  'refundAlerts',
  'weeklySummary',
] as const;

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [delivery, setDelivery] = useState<NotificationDeliveryStatus | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  // Starts from the last rebuild, so one that failed at app start still shows here.
  const [scheduleFailed, setScheduleFailed] = useState(rebuildFailed);
  const [troubleOpen, setTroubleOpen] = useState(false);
  // The "allow exact timing" question is asked once a visit, not at every switch.
  const exactAsked = useRef(false);
  const deliveryRunning = useRef(false);
  const deliveryRequest = useRef(0);
  const focused = useRef(false);
  const toggleRequests = useRef<Partial<Record<SwitchKey, symbol>>>({});
  const refreshDelivery = useCallback(async () => {
    const request = ++deliveryRequest.current;
    try {
      const status = await getNotificationDeliveryStatus();
      if (!focused.current || request !== deliveryRequest.current) return;
      // The same status again (the usual answer) must not draw the page.
      setDelivery((prev) => keepIfEqual(prev, status));
      setDeliveryError(null);
    } catch (e) {
      if (focused.current && request === deliveryRequest.current) setDeliveryError(errorMessage(e));
    }
  }, []);
  const onScheduled = useCallback(
    async (success: boolean) => {
      setScheduleFailed(!success);
      await refreshDelivery();
    },
    [refreshDelivery]
  );
  const { prefs, loadError, load, save } = useNotificationPreferences(onScheduled);
  const checkDelivery = async (test: boolean) => {
    if (deliveryRunning.current) return;
    deliveryRunning.current = true;
    setDeliveryBusy(true);
    try {
      if (test) {
        await sendTestNotification();
        if (focused.current)
          showAlert(
            'Test sent',
            'Check your notification tray. If it is missing, check the Yume reminders category, Do Not Disturb and battery restrictions on your phone.'
          );
      } else {
        const rebuilt = await rebuildNotifications();
        if (focused.current) await onScheduled(rebuilt);
        if (!rebuilt)
          throw new Error(
            'Could not rebuild reminders. Check phone permission and the Yume reminders category, then try again.'
          );
      }
      if (test) await refreshDelivery();
    } catch (e) {
      if (focused.current) showAlert('Notification check', errorMessage(e));
    } finally {
      deliveryRunning.current = false;
      if (focused.current) setDeliveryBusy(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      setDeliveryBusy(deliveryRunning.current);
      setScheduleFailed(rebuildFailed());
      void load();
      void refreshDelivery();
      return () => {
        focused.current = false;
        deliveryRequest.current++;
        toggleRequests.current = {};
      };
    }, [load, refreshDelivery])
  );
  // Returning from Android Settings does not refocus the Expo route.
  useLocalDayRefresh(() => {
    void refreshDelivery();
  }, true);

  const ensurePermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission().catch(() => false);
    if (!granted && focused.current) {
      showAlert(
        'Notifications disabled',
        'Enable notification permission for Yume in your device settings to use reminders.'
      );
    }
    return granted;
  };

  /** The phone's battery optimisation list, else Yume's own settings page. */
  const openBatterySettings = async () => {
    try {
      await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    } catch {
      await Linking.openSettings().catch((e) => showAlert('Phone settings', errorMessage(e)));
    }
  };

  const toggle = async (key: SwitchKey, enabled: boolean) => {
    if (!prefs) return;
    const request = Symbol(key);
    toggleRequests.current[key] = request;
    if (enabled && !(await ensurePermission())) return;
    if (!focused.current || toggleRequests.current[key] !== request) return;
    await save({ [key]: enabled });
    if (enabled) void offerExactTiming();
  };

  /** Turning a reminder on is the moment to ask: on Android 12+ the phone holds reminders back unless Yume may set exact alarms. */
  const offerExactTiming = async () => {
    const status = await getNotificationDeliveryStatus().catch(() => null);
    if (!status?.permitted || !status.exactBlocked || !focused.current || exactAsked.current) return;
    exactAsked.current = true;
    showAlert(
      'Get reminders on time',
      'Allow “Alarms & reminders” for Yume so they arrive at the minute you set, not later.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Allow',
          onPress: () => {
            void requestExactAlarmPermission()
              .then(() => refreshDelivery())
              .catch((e) => showAlert('Phone settings', errorMessage(e)));
          },
        },
      ]
    );
  };

  const setSlotMinutes = async (kind: TimeSlotKind, minutes: number) => {
    if (!prefs) return;
    const clamped = clampSlotMinutes(kind, minutes);
    await save(
      kind === 'morning'
        ? { morningHour: Math.floor(clamped / 60), morningMinute: clamped % 60 }
        : { eveningHour: Math.floor(clamped / 60), eveningMinute: clamped % 60 }
    );
  };

  // One function for each slot card and for every switch row, whatever the page last drew, so a card or row is drawn again
  // only when its own value changes.
  const toggleMorning = useStableCallback((on: boolean) => toggle('morningEnabled', on));
  const toggleEvening = useStableCallback((on: boolean) => toggle('eveningEnabled', on));
  const changeMorning = useStableCallback((minutes: number) => setSlotMinutes('morning', minutes));
  const changeEvening = useStableCallback((minutes: number) => setSlotMinutes('evening', minutes));
  const onAlert = useStableCallback((key: AlertKey, enabled: boolean) => {
    // Suu's check-ins are in the app only: no phone permission to ask for.
    if (key === 'suuCheckins') void save({ suuCheckins: enabled });
    else void toggle(key, enabled);
  });

  const settingsError = loadError ? (
    <ScreenLoadError title="Notifications" message={loadError} onRetry={() => void load()} embedded />
  ) : null;

  if (!prefs) {
    return (
      <View style={styles.container}>
        <HomeWallpaper />
        <SkyHeader title="Notifications" showBack hideUser wallpaper />
        {settingsError ?? (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={4} />
          </View>
        )}
      </View>
    );
  }

  const morningMinutes = prefs.morningHour * 60 + prefs.morningMinute;
  const eveningMinutes = prefs.eveningHour * 60 + prefs.eveningMinute;
  // Morning alone has nothing to send on a day nothing is due, so zero scheduled is then the right answer.
  const idleMorning =
    !!delivery && delivery.scheduledCount === 0 && prefs.morningEnabled && !prefs.eveningEnabled;
  const deliveryOk =
    !deliveryError &&
    !scheduleFailed &&
    !!delivery &&
    delivery.permitted &&
    !delivery.channelBlocked &&
    !noTimesEarly(prefs) &&
    (delivery.scheduledCount > 0 || idleMorning);
  const deliveryTitle = deliveryError
    ? 'Could not check notifications'
    : !delivery
      ? 'Checking…'
      : !delivery.permitted
        ? 'Phone permission is off'
        : delivery.channelBlocked
          ? 'Yume reminders category is off'
          : noTimesEarly(prefs)
            ? 'Reminder times are off'
            : scheduleFailed
              ? 'Reminders need rebuilding'
              : delivery.scheduledCount === 0
                ? idleMorning
                  ? 'Nothing due right now'
                  : 'Nothing scheduled'
                : 'Ready to notify';
  const deliverySub = deliveryError
    ? 'Try checking again'
    : !delivery
      ? 'Tap for details'
      : delivery.permitted && !delivery.channelBlocked
        ? `${delivery.scheduledCount} ${delivery.scheduledCount === 1 ? 'reminder' : 'reminders'} scheduled`
        : 'Tap to see how to fix it';
  const noTimes = !prefs.morningEnabled && !prefs.eveningEnabled;
  const onCount = MENTION_KEYS.filter((k) => prefs[k] === true).length;

  return (
    <View style={styles.container}>
      <HomeWallpaper />
      <SolidFade style={{ flex: 1 }}>
        <ReanimatedAnimated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: headerHeight }}
        >
          {settingsError}
          <ListCard style={styles.statusCard}>
            <Pressable
              onPress={() => setTroubleOpen((v) => !v)}
              style={withPressedTint(accent, styles.troubleRow)}
              accessibilityRole="button"
              accessibilityState={{ expanded: troubleOpen }}
              accessibilityLabel="Delivery check"
            >
              <View
                style={[
                  styles.live,
                  { backgroundColor: deliveryOk ? theme.colors.income : theme.colors.expense },
                ]}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.troubleLabel}>{deliveryTitle}</Text>
                <Text style={styles.deliveryHint}>{deliverySub}</Text>
              </View>
              <Feather
                name={troubleOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.textSecondary}
              />
            </Pressable>
            {troubleOpen && (
              <View>
                <Text style={[styles.deliveryHint, styles.deliveryNote]}>
                  {deliveryError ??
                    'Morning only sends when something is due: an EMI, a bill, a refund or an alert. Evening skips the log reminder if you’ve logged that day. Reminders are planned 14 days ahead and renewed when you open Yume; Android may delay delivery.'}
                </Text>
                {delivery?.permitted &&
                  !delivery.channelBlocked &&
                  typeof delivery.morningCount === 'number' &&
                  typeof delivery.eveningCount === 'number' && (
                    <Text style={[styles.deliveryHint, styles.deliveryNote]}>
                      Morning: {prefs.morningEnabled ? `${delivery.morningCount} scheduled` : 'Off'} ·
                      Evening: {prefs.eveningEnabled ? `${delivery.eveningCount} scheduled` : 'Off'}
                    </Text>
                  )}
                {deliveryError && (
                  <SettingsRow
                    compact
                    icon="refresh"
                    tone="sky"
                    label="Check again"
                    divider
                    onPress={() => void refreshDelivery()}
                  />
                )}
                <SettingsRow
                  compact
                  icon="bell-ring-outline"
                  tone="sky"
                  label="Test notification"
                  sub="Sends one now"
                  divider
                  dimmed={deliveryBusy}
                  onPress={() => void checkDelivery(true)}
                />
                <SettingsRow
                  compact
                  icon="calendar-refresh-outline"
                  tone="sky"
                  label="Rebuild reminders"
                  sub="Plans the next 14 days again"
                  divider
                  dimmed={deliveryBusy}
                  onPress={() => void checkDelivery(false)}
                />
                <SettingsRow
                  compact
                  icon="battery-heart-variant"
                  tone="sky"
                  label="Battery settings"
                  sub="Xiaomi, Oppo, Vivo, Samsung: set Yume to unrestricted"
                  divider
                  onPress={() => void openBatterySettings()}
                />
              </View>
            )}
          </ListCard>
          <DayArc
            morning={{ on: prefs.morningEnabled, minutes: morningMinutes }}
            evening={{ on: prefs.eveningEnabled, minutes: eveningMinutes }}
          />
          {delivery?.permitted && !delivery.channelBlocked && delivery.exactBlocked && (
            <View style={styles.permissionBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>Reminders may arrive late</Text>
                <Text style={styles.permissionSub}>
                  Allow “Alarms & reminders” so they arrive at the time you set.
                </Text>
              </View>
              <PrimaryButton
                title="Allow"
                compact
                onPress={() => {
                  void requestExactAlarmPermission()
                    .then(() => refreshDelivery())
                    .catch((e) => showAlert('Phone settings', errorMessage(e)));
                }}
              />
            </View>
          )}
          {delivery && (!delivery.permitted || delivery.channelBlocked) && (
            <View style={styles.permissionBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>
                  {delivery.permitted ? 'Yume reminders category is off' : 'Notifications are off for Yume'}
                </Text>
                <Text style={styles.permissionSub}>Turn on reminders in your phone settings.</Text>
              </View>
              <PrimaryButton
                title="Phone settings"
                compact
                onPress={() => {
                  void Linking.openSettings().catch((e) => showAlert('Phone settings', errorMessage(e)));
                }}
              />
            </View>
          )}
          <View style={styles.slots}>
            <SlotCard
              kind="morning"
              sub="Only when something is due"
              on={prefs.morningEnabled}
              minutes={morningMinutes}
              onToggle={toggleMorning}
              onChange={changeMorning}
            />
            <SlotCard
              kind="evening"
              sub="Log nudge if none today"
              on={prefs.eveningEnabled}
              minutes={eveningMinutes}
              onToggle={toggleEvening}
              onChange={changeEvening}
            />
          </View>
          {noTimes ? (
            <Text style={styles.warn}>Topics arrive at your morning and evening times. Turn one on.</Text>
          ) : (
            <Text style={styles.footNote}>At most one notification per time. Nothing leaves your phone.</Text>
          )}

          <Section
            compact
            title="Reminder topics"
            right={
              <Text style={styles.count}>
                {onCount} of {MENTION_KEYS.length} on
              </Text>
            }
          >
            <ListCard>
              <AlertRow rowKey="billAlerts" value={prefs.billAlerts} dimmed={noTimes} onToggle={onAlert} />
              <AlertRow
                rowKey="overspendAlerts"
                value={prefs.overspendAlerts}
                dimmed={noTimes}
                divider
                onToggle={onAlert}
              />
              <AlertRow
                rowKey="recurringAlerts"
                value={prefs.recurringAlerts === true}
                dimmed={noTimes}
                divider
                onToggle={onAlert}
              />
              <AlertRow
                rowKey="refundAlerts"
                value={prefs.refundAlerts === true}
                dimmed={noTimes}
                divider
                onToggle={onAlert}
              />
              <AlertRow
                rowKey="weeklySummary"
                value={prefs.weeklySummary}
                dimmed={noTimes}
                divider
                onToggle={onAlert}
              />
            </ListCard>
          </Section>

          <Section compact title="In the app">
            <ListCard>
              <AlertRow rowKey="suuCheckins" value={prefs.suuCheckins} onToggle={onAlert} />
            </ListCard>
          </Section>

          <View style={{ height: theme.layout.screenScrollPad + insets.bottom }} />
        </ReanimatedAnimated.ScrollView>
      </SolidFade>
      <SkyHeader collapse={collapse} title="Notifications" showBack hideUser wallpaper />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    permissionBanner: {
      marginHorizontal: SCREEN.gutter,
      marginTop: 12,
      padding: 14,
      borderRadius: theme.radius.xl2,
      backgroundColor: theme.colors.expenseTint,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    permissionTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
    permissionSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.expenseText },
    slots: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginHorizontal: SCREEN.gutter,
      marginTop: 12,
    },
    count: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textMuted },
    statusCard: { marginHorizontal: SCREEN.gutter, marginTop: 12 },
    deliveryNote: { paddingHorizontal: 14, paddingBottom: 8 },
    live: { width: 10, height: 10, borderRadius: 5, marginRight: 2 },
    troubleRow: {
      minHeight: 56,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    troubleLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
    deliveryCard: { paddingHorizontal: 14, paddingBottom: 14 },
    deliveryHint: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      marginTop: 6,
    },
    deliveryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    warn: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.warnInk,
      marginHorizontal: SCREEN.gutter,
      marginTop: 8,
    },
    footNote: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
      marginHorizontal: SCREEN.gutter,
      marginTop: 8,
      lineHeight: 18,
    },
  })
);
