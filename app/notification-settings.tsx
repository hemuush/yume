import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { withPressed } from '@/lib/pressed';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkyHeader } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { Section } from '@/components/Section';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import { SlotTimeStepper } from '@/features/notifications/SlotTimeStepper';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { getNotificationPrefs, setNotificationPrefs, NotificationPrefs } from '@/db/settings';
import {
  rebuildNotifications,
  requestNotificationPermission,
  getNotificationDeliveryStatus,
  sendTestNotification,
  NotificationDeliveryStatus,
} from '@/lib/notifications';
import { TimeSlotKind, clampSlotMinutes, formatSlotTime } from '@/lib/notificationTimes';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listScreenStyles } from '@/features/shared/listScreenStyles';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { cardSurface } from '@/components/CardSurface';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { DayArc } from '@/features/notifications/DayArc';

type SwitchKey =
  | 'morningEnabled'
  | 'eveningEnabled'
  | 'billAlerts'
  | 'overspendAlerts'
  | 'weeklySummary'
  | 'recurringAlerts'
  | 'refundAlerts';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [prefs, setPrefsState] = useState<NotificationPrefs | null>(null);
  // The latest prefs, read by every change: two quick toggles each build on the other, not on a stale render.
  const latest = useRef<NotificationPrefs | null>(null);
  const setPrefs = useCallback((next: NotificationPrefs | null) => {
    latest.current = next;
    setPrefsState(next);
  }, []);
  const [openSlot, setOpenSlot] = useState<TimeSlotKind | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<NotificationDeliveryStatus | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [troubleOpen, setTroubleOpen] = useState(false);
  const deliveryRunning = useRef(false);
  const refreshDelivery = useCallback(async () => {
    try {
      setDelivery(await getNotificationDeliveryStatus());
      setDeliveryError(null);
    } catch (e) {
      setDeliveryError(errorMessage(e));
    }
  }, []);
  const checkDelivery = async (test: boolean) => {
    if (deliveryRunning.current) return;
    deliveryRunning.current = true;
    setDeliveryBusy(true);
    try {
      if (test) {
        await sendTestNotification();
        showAlert(
          'Test sent',
          'Check your notification tray. If it is missing, check the Yume reminders category, Do Not Disturb and battery restrictions on your phone.'
        );
      } else if (!(await rebuildNotifications()))
        throw new Error('Could not rebuild reminders. Please try again.');
      await refreshDelivery();
    } catch (e) {
      showAlert('Notification check', errorMessage(e));
    } finally {
      deliveryRunning.current = false;
      setDeliveryBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setPrefs(await getNotificationPrefs());
      setLoadError(null);
      await refreshDelivery();
    } catch (e) {
      // Without this the skeleton below would sit there forever.
      setLoadError(errorMessage(e));
    }
  }, [setPrefs, refreshDelivery]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async (next: NotificationPrefs) => {
    const previous = latest.current;
    setPrefs(next);
    try {
      await setNotificationPrefs(next);
    } catch (e) {
      // The switch already flipped optimistically; without this, a failure left it showing "on" with
      // nothing persisted — misleading instead of an honest error.
      setPrefs(previous);
      showAlert("Couldn't save", errorMessage(e));
      return;
    }
    // The preference is already persisted at this point — only the local
    // scheduling can fail, so the switch keeps reflecting what's saved.
    if (!(await rebuildNotifications())) {
      showAlert('Saved, but reminders may not fire', 'Yume could not schedule them. Try again in a moment.');
    }
    await refreshDelivery();
  };

  const ensurePermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission().catch(() => false);
    if (!granted) {
      showAlert(
        'Notifications disabled',
        'Enable notification permission for Yume in your device settings to use reminders.'
      );
    }
    return granted;
  };

  const toggle = async (key: SwitchKey, enabled: boolean) => {
    if (!latest.current) return;
    if (enabled && !(await ensurePermission())) return;
    if (!latest.current) return;
    await save({ ...latest.current, [key]: enabled });
  };

  const setSlotMinutes = async (kind: TimeSlotKind, minutes: number) => {
    const current = latest.current;
    if (!current) return;
    const clamped = clampSlotMinutes(kind, minutes);
    await save(
      kind === 'morning'
        ? { ...current, morningHour: Math.floor(clamped / 60), morningMinute: clamped % 60 }
        : { ...current, eveningHour: Math.floor(clamped / 60), eveningMinute: clamped % 60 }
    );
  };

  if (!prefs) {
    return (
      <View style={styles.container}>
        <HomeWallpaper accent={accent} secondary={secondary} />
        <SkyHeader title="Notifications" showBack hideUser wallpaper />
        {loadError ? (
          <View style={listScreenStyles.errorBanner}>
            <Text style={listScreenStyles.errorTitle}>Couldn't load your notification settings</Text>
            <Text style={listScreenStyles.errorDetail}>{loadError}</Text>
            <PrimaryButton
              title="Try again"
              variant="secondary"
              compact
              onPress={() => void load()}
              style={styles.retry}
            />
          </View>
        ) : (
          <View style={{ marginTop: theme.layout.screenTopGap }}>
            <CardRowsSkeleton rows={4} />
          </View>
        )}
      </View>
    );
  }

  const morningMinutes = prefs.morningHour * 60 + prefs.morningMinute;
  const eveningMinutes = prefs.eveningHour * 60 + prefs.eveningMinute;
  const noTimes = !prefs.morningEnabled && !prefs.eveningEnabled;
  const toggleSlot = (kind: TimeSlotKind) => setOpenSlot((open) => (open === kind ? null : kind));

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight }}
      >
        <DayArc
          morning={{ on: prefs.morningEnabled, minutes: morningMinutes }}
          evening={{ on: prefs.eveningEnabled, minutes: eveningMinutes }}
        />
        {delivery && !delivery.permitted && (
          <View style={styles.permissionBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.permissionTitle}>Notifications are off for Yume</Text>
              <Text style={styles.permissionSub}>Nothing below will reach you.</Text>
            </View>
            <PrimaryButton title="Turn on" compact onPress={() => void Linking.openSettings()} />
          </View>
        )}
        {/* The same grouped rows as Profile's settings: a section title, one glass card, hairlines between rows. */}
        <Section title="Times">
          <View style={[h.card, cardSurface.neutral]}>
            <SettingsRow
              icon="white-balance-sunny"
              iconBg={theme.colors.goldTint}
              label="Morning"
              sub="Check-in plus due EMIs and alerts"
              value={formatSlotTime(morningMinutes)}
              expanded={openSlot === 'morning'}
              onPress={() => toggleSlot('morning')}
              right={
                <ToggleSwitch
                  accessibilityLabel="Morning"
                  value={prefs.morningEnabled}
                  onChange={(v) => toggle('morningEnabled', v)}
                />
              }
            />
            {openSlot === 'morning' && (
              <SlotTimeStepper
                kind="morning"
                minutes={morningMinutes}
                onChange={(m) => setSlotMinutes('morning', m)}
              />
            )}
            <SettingsRow
              icon="weather-night"
              iconBg={shade(accent, 95)}
              label="Evening"
              sub="Log nudge if nothing logged"
              value={formatSlotTime(eveningMinutes)}
              expanded={openSlot === 'evening'}
              divider
              onPress={() => toggleSlot('evening')}
              right={
                <ToggleSwitch
                  accessibilityLabel="Evening"
                  value={prefs.eveningEnabled}
                  onChange={(v) => toggle('eveningEnabled', v)}
                />
              }
            />
            {openSlot === 'evening' && (
              <SlotTimeStepper
                kind="evening"
                minutes={eveningMinutes}
                onChange={(m) => setSlotMinutes('evening', m)}
              />
            )}
          </View>
          {noTimes && <Text style={styles.warn}>Switch on a time to get notifications.</Text>}
        </Section>

        <Section title="Yume can mention">
          <View style={[h.card, cardSurface.neutral]}>
            <SettingsRow
              icon="credit-card-outline"
              iconBg={theme.colors.idGold}
              label="Loan EMIs due"
              sub="Due day, then daily for a week"
              dimmed={noTimes}
              right={
                <ToggleSwitch
                  accessibilityLabel="Loan EMIs due"
                  value={prefs.billAlerts}
                  onChange={(v) => toggle('billAlerts', v)}
                />
              }
            />
            <SettingsRow
              icon="alert-outline"
              iconBg={theme.colors.idCoral}
              label="Spending alerts"
              sub="Budget limits, big jumps"
              divider
              dimmed={noTimes}
              right={
                <ToggleSwitch
                  accessibilityLabel="Spending alerts"
                  value={prefs.overspendAlerts}
                  onChange={(v) => toggle('overspendAlerts', v)}
                />
              }
            />
            <SettingsRow
              icon="repeat"
              iconBg={theme.colors.accentTint}
              label="Recurring expense heads-up"
              sub="Day before a recurring expense"
              divider
              dimmed={noTimes}
              right={
                <ToggleSwitch
                  accessibilityLabel="Recurring expense heads-up"
                  value={prefs.recurringAlerts === true}
                  onChange={(v) => toggle('recurringAlerts', v)}
                />
              }
            />
            <SettingsRow
              icon="cash-refund"
              iconBg={theme.colors.goldTint}
              label="Refund follow-ups"
              sub="Expected date, then 3 days later"
              divider
              dimmed={noTimes}
              right={
                <ToggleSwitch
                  accessibilityLabel="Refund follow-ups"
                  value={prefs.refundAlerts === true}
                  onChange={(v) => toggle('refundAlerts', v)}
                />
              }
            />
            <SettingsRow
              icon="chart-bar"
              iconBg={theme.colors.accentTint}
              label="Weekly wrap"
              sub="Mondays"
              divider
              dimmed={noTimes}
              right={
                <ToggleSwitch
                  accessibilityLabel="Weekly wrap"
                  value={prefs.weeklySummary}
                  onChange={(v) => toggle('weeklySummary', v)}
                />
              }
            />
          </View>
        </Section>

        <Section title="Troubleshooting">
          <View style={[h.card, cardSurface.neutral]}>
            <Pressable
              onPress={() => setTroubleOpen((v) => !v)}
              style={withPressed(styles.troubleRow)}
              accessibilityRole="button"
              accessibilityState={{ expanded: troubleOpen }}
              accessibilityLabel="Delivery check"
            >
              <Text style={styles.troubleLabel}>Delivery check</Text>
              <Feather
                name={troubleOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>
          {troubleOpen && (
            <View style={[h.card, cardSurface.neutral, styles.deliveryCard, { marginTop: 8 }]}>
              <Text style={styles.deliveryStatus}>
                {deliveryError
                  ? 'Could not check notifications'
                  : !delivery
                    ? 'Checking…'
                    : !delivery.permitted
                      ? 'Phone permission is off'
                      : delivery.channelBlocked
                        ? 'Yume reminders category is off'
                        : `${delivery.scheduledCount} reminders scheduled`}
              </Text>
              <Text style={styles.deliveryHint}>
                {deliveryError ??
                  'Morning includes a daily check-in. Evening skips the log reminder if you’ve logged that day. Reminders are planned 14 days ahead and renewed when you open Yume; Android may delay delivery.'}
              </Text>
              {delivery?.permitted &&
                !delivery.channelBlocked &&
                typeof delivery.morningCount === 'number' &&
                typeof delivery.eveningCount === 'number' && (
                  <Text style={styles.deliveryHint}>
                    Morning: {prefs.morningEnabled ? `${delivery.morningCount} scheduled` : 'Off'} · Evening:{' '}
                    {prefs.eveningEnabled ? `${delivery.eveningCount} scheduled` : 'Off'}
                  </Text>
                )}
              <View style={styles.deliveryActions}>
                <PrimaryButton
                  compact
                  variant="secondary"
                  title="Test notification"
                  disabled={deliveryBusy}
                  onPress={() => void checkDelivery(true)}
                />
                <PrimaryButton
                  compact
                  variant="secondary"
                  title="Rebuild reminders"
                  disabled={deliveryBusy}
                  onPress={() => void checkDelivery(false)}
                />
              </View>
            </View>
          )}
        </Section>

        <Section title="In the app">
          <View style={[h.card, cardSurface.neutral]}>
            <SettingsRow
              icon="sprout"
              iconBg={shade(secondary, 94)}
              label="Suu's check-ins"
              sub="Two lines on the bell screen"
              right={
                <ToggleSwitch
                  accessibilityLabel="Suu's check-ins"
                  value={prefs.suuCheckins}
                  onChange={(v) => latest.current && save({ ...latest.current, suuCheckins: v })}
                />
              }
            />
          </View>
        </Section>

        <Text style={styles.footNote}>At most one notification per time. Nothing leaves your phone.</Text>
        <View style={{ height: theme.layout.screenScrollPad + insets.bottom }} />
      </ReanimatedAnimated.ScrollView>
      <SkyHeader collapse={collapse} title="Notifications" showBack hideUser wallpaper />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  permissionBanner: {
    marginHorizontal: SCREEN.gutter,
    marginTop: 12,
    padding: 14,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.expenseTint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  permissionSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.expenseText },
  troubleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  troubleLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  deliveryCard: { padding: 14 },
  deliveryStatus: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  deliveryHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  deliveryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  retry: { alignSelf: 'flex-start', marginTop: 10 },
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
    marginTop: 16,
    lineHeight: 18,
  },
});
