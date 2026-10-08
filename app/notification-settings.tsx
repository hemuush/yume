import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkyHeader } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { Section } from '@/components/Section';
import { screenStyles as h } from '@/components/screenStyles';
import { SlotTimeStepper } from '@/features/notifications/SlotTimeStepper';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { getNotificationPrefs, setNotificationPrefs, NotificationPrefs } from '@/db/settings';
import { rebuildNotifications, requestNotificationPermission } from '@/lib/notifications';
import { TimeSlotKind, clampSlotMinutes, formatSlotTime } from '@/lib/notificationTimes';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listScreenStyles } from '@/features/shared/listScreenStyles';
import { useAccent } from '@/theme/AccentContext';
import { shade } from '@/lib/color';

type SwitchKey = 'morningEnabled' | 'eveningEnabled' | 'billAlerts' | 'overspendAlerts' | 'weeklySummary';

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

  const load = useCallback(async () => {
    try {
      setPrefs(await getNotificationPrefs());
      setLoadError(null);
    } catch (e) {
      // Without this the skeleton below would sit there forever.
      setLoadError(errorMessage(e));
    }
  }, [setPrefs]);

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
        <SkyHeader title="Notifications" showBack hideUser />
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
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight }}
      >
        {/* The same grouped rows as Profile's settings: a section title, one card, hairlines between rows. */}
        <Section title="Times">
          <View style={h.card}>
            <SettingsRow
              icon="white-balance-sunny"
              iconBg={theme.colors.goldTint}
              label="Morning"
              sub="EMIs, Monday wrap, spending alerts"
              value={formatSlotTime(morningMinutes)}
              expanded={openSlot === 'morning'}
              onPress={() => toggleSlot('morning')}
              right={
                <ToggleSwitch value={prefs.morningEnabled} onChange={(v) => toggle('morningEnabled', v)} />
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
              sub="Log today, plus anything waiting"
              value={formatSlotTime(eveningMinutes)}
              expanded={openSlot === 'evening'}
              divider
              onPress={() => toggleSlot('evening')}
              right={
                <ToggleSwitch value={prefs.eveningEnabled} onChange={(v) => toggle('eveningEnabled', v)} />
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
          <View style={h.card}>
            <SettingsRow
              icon="credit-card-outline"
              iconBg={theme.colors.idGold}
              label="Bills & EMIs due"
              sub="On the day"
              dimmed={noTimes}
              right={<ToggleSwitch value={prefs.billAlerts} onChange={(v) => toggle('billAlerts', v)} />}
            />
            <SettingsRow
              icon="alert-outline"
              iconBg={theme.colors.idCoral}
              label="Spending alerts"
              sub="Budget limits, big jumps"
              divider
              dimmed={noTimes}
              right={
                <ToggleSwitch value={prefs.overspendAlerts} onChange={(v) => toggle('overspendAlerts', v)} />
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
                <ToggleSwitch value={prefs.weeklySummary} onChange={(v) => toggle('weeklySummary', v)} />
              }
            />
          </View>
        </Section>

        <Section title="In the app">
          <View style={h.card}>
            <SettingsRow
              icon="weather-night"
              iconBg={shade(secondary, 94)}
              label="Suu's check-ins"
              sub="Two lines on the bell screen"
              right={
                <ToggleSwitch
                  value={prefs.suuCheckins}
                  onChange={(v) => save({ ...prefs, suuCheckins: v })}
                />
              }
            />
          </View>
        </Section>

        <Text style={styles.footNote}>At most one notification per time. Nothing leaves your phone.</Text>
        <View style={{ height: theme.layout.screenScrollPad + insets.bottom }} />
      </ReanimatedAnimated.ScrollView>
      <SkyHeader collapse={collapse} title="Notifications" showBack hideUser />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  retry: { alignSelf: 'flex-start', marginTop: 10 },
  warn: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.warnInk,
    marginHorizontal: 20,
    marginTop: 8,
  },
  footNote: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginHorizontal: 20,
    marginTop: 16,
    lineHeight: 16,
  },
});
