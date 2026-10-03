import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { HomeSection } from '@/components/HomeSection';
import { homeStyles as h } from '@/components/homeStyles';
import { SlotTimeStepper } from '@/features/notifications/SlotTimeStepper';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { getNotificationPrefs, setNotificationPrefs, NotificationPrefs } from '@/db/settings';
import { rebuildNotifications, requestNotificationPermission } from '@/lib/notifications';
import { TimeSlotKind, clampSlotMinutes, formatSlotTime } from '@/lib/notificationTimes';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { showAlert } from '@/components/AppDialog';

type SwitchKey = 'morningEnabled' | 'eveningEnabled' | 'billAlerts' | 'overspendAlerts' | 'weeklySummary';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [openSlot, setOpenSlot] = useState<TimeSlotKind | null>(null);

  const load = useCallback(async () => {
    setPrefs(await getNotificationPrefs());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async (next: NotificationPrefs) => {
    const previous = prefs;
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
    const granted = await requestNotificationPermission();
    if (!granted) {
      showAlert(
        'Notifications disabled',
        'Enable notification permission for Yume in your device settings to use reminders.'
      );
    }
    return granted;
  };

  const toggle = async (key: SwitchKey, enabled: boolean) => {
    if (!prefs) return;
    if (enabled && !(await ensurePermission())) return;
    await save({ ...prefs, [key]: enabled });
  };

  const setSlotMinutes = async (kind: TimeSlotKind, minutes: number) => {
    if (!prefs) return;
    const clamped = clampSlotMinutes(kind, minutes);
    await save(
      kind === 'morning'
        ? { ...prefs, morningHour: Math.floor(clamped / 60), morningMinute: clamped % 60 }
        : { ...prefs, eveningHour: Math.floor(clamped / 60), eveningMinute: clamped % 60 }
    );
  };

  if (!prefs) {
    return (
      <View style={styles.container}>
        <AppHeader title="Notifications" showBack />
        <View style={{ marginTop: theme.layout.screenTopGap }}>
          <CardRowsSkeleton rows={4} />
        </View>
      </View>
    );
  }

  const morningMinutes = prefs.morningHour * 60 + prefs.morningMinute;
  const eveningMinutes = prefs.eveningHour * 60 + prefs.eveningMinute;
  const noTimes = !prefs.morningEnabled && !prefs.eveningEnabled;
  const toggleSlot = (kind: TimeSlotKind) => setOpenSlot((open) => (open === kind ? null : kind));

  return (
    <View style={styles.container}>
      <AppHeader title="Notifications" showBack />
      <ScrollView>
        {/* The same grouped rows as Profile's settings: a section title, one card, hairlines between rows. */}
        <HomeSection title="Times">
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
              iconBg={theme.colors.primaryTint}
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
        </HomeSection>

        <HomeSection title="Yume can mention">
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
        </HomeSection>

        <HomeSection title="In the app">
          <View style={h.card}>
            <SettingsRow
              icon="weather-night"
              iconBg={theme.colors.secondaryTint}
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
        </HomeSection>

        <Text style={styles.footNote}>At most one notification per time. Nothing leaves your phone.</Text>
        <View style={{ height: theme.layout.screenScrollPad + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
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
