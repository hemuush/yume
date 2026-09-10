import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { AppHeader } from '@/components/AppHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRowIcon } from '@/components/SettingsRowIcon';
import { FlynnIllustration } from '@/components/FlynnIllustration';
import { getNotificationPrefs, setNotificationPrefs, NotificationPrefs } from '@/db/settings';
import { requestNotificationPermission, syncDailyReminder, syncWeeklySummary } from '@/lib/notifications';
import { resyncAllLoanReminders } from '@/db/loans';
import { theme, settingsRowStyle } from '@/constants/theme';

function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [previewAnim] = useState(() => new Animated.Value(0));

  const load = useCallback(async () => {
    setPrefs(await getNotificationPrefs());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(previewAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(previewAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [previewAnim]);

  // Returns whether the preference itself was actually persisted — callers
  // that also need to resync OS-level scheduling (e.g. loan due reminders)
  // only do so when this is true, rather than assuming success.
  const save = async (next: NotificationPrefs): Promise<boolean> => {
    const previous = prefs;
    setPrefs(next);
    try {
      await setNotificationPrefs(next);
    } catch (e: any) {
      // The toggle already flipped optimistically above — on failure it was
      // otherwise left showing "on" while nothing was actually persisted,
      // a silently misleading state rather than an honest error.
      setPrefs(previous);
      Alert.alert('Could not save', String(e?.message ?? e));
      return false;
    }
    try {
      await syncDailyReminder(next);
      await syncWeeklySummary(next);
    } catch (e: any) {
      // The preference is already persisted at this point — only the local
      // notification scheduling failed, so the toggle correctly keeps
      // reflecting what's actually saved rather than rolling back to a
      // value that no longer matches the database.
      Alert.alert('Saved, but reminders may not fire', String(e?.message ?? e));
    }
    return true;
  };

  const ensurePermission = async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      Alert.alert(
        'Notifications disabled',
        'Enable notification permission for Yume in your device settings to use reminders.'
      );
    }
    return granted;
  };

  const onToggleReminder = async (enabled: boolean) => {
    if (!prefs) return;
    if (enabled && !(await ensurePermission())) return;
    await save({ ...prefs, reminderEnabled: enabled });
  };

  const onToggleWeeklySummary = async (enabled: boolean) => {
    if (!prefs) return;
    if (enabled && !(await ensurePermission())) return;
    await save({ ...prefs, weeklySummary: enabled });
  };

  const onToggleBillAlerts = async (enabled: boolean) => {
    if (!prefs) return;
    if (enabled && !(await ensurePermission())) return;
    const persisted = await save({ ...prefs, billAlerts: enabled });
    // Only reconciles loan reminders once the preference itself is actually
    // saved — running this after a failed save would schedule/cancel
    // reminders based on a toggle state that doesn't match the database.
    if (persisted) await resyncAllLoanReminders(); // schedules if just enabled, cancels all if just disabled
  };

  const onToggleOverspend = async (enabled: boolean) => {
    if (!prefs) return;
    if (enabled && !(await ensurePermission())) return;
    await save({ ...prefs, overspendAlerts: enabled });
  };

  const adjustTime = async (deltaMinutes: number) => {
    if (!prefs) return;
    const total = (prefs.reminderHour * 60 + prefs.reminderMinute + deltaMinutes + 24 * 60) % (24 * 60);
    await save({ ...prefs, reminderHour: Math.floor(total / 60), reminderMinute: total % 60 });
  };

  if (!prefs) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <AppHeader title="Notifications" showBack />
      <ScrollView>
        <View style={styles.previewWrap}>
          <Animated.View
            style={[
              styles.previewCard,
              {
                opacity: previewAnim,
                transform: [
                  { translateY: previewAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
                ],
              },
            ]}
          >
            <FlynnIllustration size={34} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.previewTitle}>Flynn</Text>
              <Text style={styles.previewBody}>Time to log today's spending 👀</Text>
            </View>
          </Animated.View>
        </View>
        <Text style={styles.previewHint}>↑ live preview — this is what it'll actually look like</Text>

        <Text style={styles.sectionLabel}>Daily Reminder</Text>
        <View style={styles.row}>
          <SettingsRowIcon name="clock-outline" backgroundColor={theme.colors.gold} />
          <Text style={styles.rowLabel}>Remind me daily</Text>
          <ToggleSwitch value={prefs.reminderEnabled} onChange={onToggleReminder} />
        </View>

        <View style={[styles.timeCard, !prefs.reminderEnabled && styles.disabledCard]}>
          <Text style={styles.timeLabel}>REMIND ME AT</Text>
          <View style={styles.timeRow}>
            <Pressable
              style={styles.timeBtn}
              disabled={!prefs.reminderEnabled}
              onPress={() => adjustTime(-30)}
              hitSlop={8}
            >
              <Feather name="chevron-down" size={18} color={theme.colors.ink} />
            </Pressable>
            <Text style={styles.timeValue}>{formatTime(prefs.reminderHour, prefs.reminderMinute)}</Text>
            <Pressable
              style={styles.timeBtn}
              disabled={!prefs.reminderEnabled}
              onPress={() => adjustTime(30)}
              hitSlop={8}
            >
              <Feather name="chevron-up" size={18} color={theme.colors.ink} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Smart Alerts</Text>
        <View style={styles.row}>
          <SettingsRowIcon name="alert-outline" backgroundColor={theme.colors.flatPink} />
          <Text style={styles.rowLabel}>Overspending alerts</Text>
          <ToggleSwitch value={prefs.overspendAlerts} onChange={onToggleOverspend} />
        </View>
        <View style={styles.row}>
          <SettingsRowIcon name="credit-card-outline" backgroundColor={theme.colors.gold} />
          <Text style={styles.rowLabel}>Bill & EMI due alerts</Text>
          <ToggleSwitch value={prefs.billAlerts} onChange={onToggleBillAlerts} />
        </View>
        <View style={styles.row}>
          <SettingsRowIcon name="chart-bar" backgroundColor={theme.colors.flatBlue} />
          <Text style={styles.rowLabel}>Weekly summary</Text>
          <ToggleSwitch value={prefs.weeklySummary} onChange={onToggleWeeklySummary} />
        </View>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: theme.colors.flatMint }]}>
            <Text>🐦</Text>
          </View>
          <Text style={styles.rowLabel}>Flynn's check-ins</Text>
          <ToggleSwitch value={prefs.flynnCheckins} onChange={(v) => save({ ...prefs, flynnCheckins: v })} />
        </View>

        <Text style={styles.footNote}>
          All reminders above are scheduled entirely on your device — no server, nothing ever leaves your
          phone. Bill alerts fire from your loan due dates, overspending alerts check right after you log an
          expense, and the weekly summary arrives every Sunday.
        </Text>
        <View style={{ height: 40 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  previewWrap: { height: 70, paddingHorizontal: 20, paddingTop: 6 },
  previewCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewTitle: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
  previewBody: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  previewHint: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  row: settingsRowStyle,
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.textPrimary },

  timeCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    padding: 16,
  },
  disabledCard: { opacity: 0.45 },
  timeLabel: {
    fontSize: 11,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8 },
  timeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  timeValue: {
    fontFamily: theme.font.display,
    fontSize: 22,
    color: theme.colors.textPrimary,
    minWidth: 110,
    textAlign: 'center',
  },

  footNote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginHorizontal: 20,
    marginTop: 16,
    lineHeight: 16,
  },
});
