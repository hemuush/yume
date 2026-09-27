import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, Animated, Easing } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { AppHeader } from '@/components/AppHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h } from '@/features/home/homeStyles';
import { SuuIllustration } from '@/components/SuuIllustration';
import { CardRowsSkeleton } from '@/components/ListSkeleton';
import { getNotificationPrefs, setNotificationPrefs, NotificationPrefs } from '@/db/settings';
import { requestNotificationPermission, syncDailyReminder, syncWeeklySummary } from '@/lib/notifications';
import { resyncAllLoanReminders } from '@/db/loans';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { DURATIONS } from '@/lib/motionTimings';
import { withPressed } from '@/lib/pressed';

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

  // The sample notification drops in once and stays: it used to slide in and
  // out forever, and nothing but loading should loop (the Quiet motion sign-off).
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) {
      previewAnim.setValue(1);
      return;
    }
    const anim = Animated.timing(previewAnim, {
      toValue: 1,
      duration: DURATIONS.slideIn,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [previewAnim, reduce]);

  // Returns whether the preference itself was actually persisted — callers
  // that also need to resync OS-level scheduling (e.g. loan due reminders)
  // only do so when this is true, rather than assuming success.
  const save = async (next: NotificationPrefs): Promise<boolean> => {
    const previous = prefs;
    setPrefs(next);
    try {
      await setNotificationPrefs(next);
    } catch (e) {
      // The toggle already flipped optimistically above — on failure it was
      // otherwise left showing "on" while nothing was actually persisted,
      // a silently misleading state rather than an honest error.
      setPrefs(previous);
      Alert.alert("Couldn't save", errorMessage(e));
      return false;
    }
    try {
      await syncDailyReminder(next);
      await syncWeeklySummary(next);
    } catch (e) {
      // The preference is already persisted at this point — only the local
      // notification scheduling failed, so the toggle correctly keeps
      // reflecting what's actually saved rather than rolling back to a
      // value that no longer matches the database.
      Alert.alert('Saved, but reminders may not fire', errorMessage(e));
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
            <SuuIllustration size={34} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.previewTitle}>Suu</Text>
              <Text style={styles.previewBody}>Time to log today's spending 👀</Text>
            </View>
          </Animated.View>
        </View>
        <Text style={styles.previewHint}>↑ This is how your reminder will look</Text>

        {/* The same grouped rows as Profile's settings: a section title, one card, hairlines between rows. */}
        <HomeSection title="Daily reminder">
          <View style={h.card}>
            <SettingsRow
              icon="clock-outline"
              iconBg={theme.colors.goldTint}
              label="Remind me daily"
              right={<ToggleSwitch value={prefs.reminderEnabled} onChange={onToggleReminder} />}
            />
            <SettingsRow
              icon="bell-ring-outline"
              iconBg={theme.colors.primaryTint}
              label="Remind me at"
              divider
              dimmed={!prefs.reminderEnabled}
              right={
                <View style={styles.timeRow}>
                  <Pressable
                    style={withPressed(styles.timeBtn)}
                    disabled={!prefs.reminderEnabled}
                    onPress={() => adjustTime(-30)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Reminder 30 minutes earlier"
                    accessibilityState={{ disabled: !prefs.reminderEnabled }}
                  >
                    <Feather name="chevron-down" size={16} color={theme.colors.ink} />
                  </Pressable>
                  <Text style={styles.timeValue}>{formatTime(prefs.reminderHour, prefs.reminderMinute)}</Text>
                  <Pressable
                    style={withPressed(styles.timeBtn)}
                    disabled={!prefs.reminderEnabled}
                    onPress={() => adjustTime(30)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Reminder 30 minutes later"
                    accessibilityState={{ disabled: !prefs.reminderEnabled }}
                  >
                    <Feather name="chevron-up" size={16} color={theme.colors.ink} />
                  </Pressable>
                </View>
              }
            />
          </View>
        </HomeSection>

        <HomeSection title="Smart alerts">
          <View style={h.card}>
            <SettingsRow
              icon="alert-outline"
              iconBg={theme.colors.idCoral}
              label="Overspending alerts"
              right={<ToggleSwitch value={prefs.overspendAlerts} onChange={onToggleOverspend} />}
            />
            <SettingsRow
              icon="credit-card-outline"
              iconBg={theme.colors.idGold}
              label="Bill & EMI due alerts"
              divider
              right={<ToggleSwitch value={prefs.billAlerts} onChange={onToggleBillAlerts} />}
            />
            <SettingsRow
              icon="chart-bar"
              iconBg={theme.colors.accentTint}
              label="Weekly summary"
              divider
              right={<ToggleSwitch value={prefs.weeklySummary} onChange={onToggleWeeklySummary} />}
            />
            <SettingsRow
              icon="weather-night"
              iconBg={theme.colors.secondaryTint}
              label="Suu's check-ins"
              divider
              right={
                <ToggleSwitch
                  value={prefs.suuCheckins}
                  onChange={(v) => save({ ...prefs, suuCheckins: v })}
                />
              }
            />
          </View>
        </HomeSection>

        <Text style={styles.footNote}>
          All reminders above are scheduled entirely on your device — no server, nothing ever leaves your
          phone. Bill alerts fire from your loan due dates. Overspending alerts check right after you log an
          expense — including one heads-up when a budget reaches 80% and one if it goes over. The weekly
          summary arrives every Monday, with last week's Wrap.
        </Text>
        <View style={{ height: theme.layout.screenScrollPad + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  previewWrap: { height: 70, paddingHorizontal: 20, paddingTop: theme.layout.screenTopGap },
  previewCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewTitle: { fontFamily: theme.font.roundedBold, fontSize: 12.5, color: theme.colors.textPrimary },
  previewBody: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  previewHint: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  // Sized like the other rows' values; wide enough that 9:30 PM and 10:00 PM don't shift the arrows.
  timeValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    minWidth: 72,
    textAlign: 'center',
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
