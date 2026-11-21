import { useCallback, useState } from 'react';
import { Appear } from '@/components/Appear';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect, router } from 'expo-router';
import {
  getHideWidgetValues,
  getDefaultCurrency,
  setDefaultCurrency,
  getDailySpendingGoal,
  getNotificationPrefs,
  getLastLocalBackupResult,
  NotificationPrefs,
} from '@/db/settings';
import { getTidyUpReport, tidyUpCount } from '@/db/tidyUp';
import { countDeletedEntries } from '@/db/recentlyDeleted';
import { authenticate, isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { MovingRow } from '@/components/MovingRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppearance } from '@/theme/AppearanceContext';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { ListCard } from '@/components/SummaryCard';
import { styles } from './profile.styles';
import { errorMessage } from '@/lib/errorMessage';
import { AboutYume } from './AboutYume';
import { AppearancePicker } from './AppearancePicker';
import { CurrencySetting } from './CurrencySetting';
import { DailyGoalSetting } from './DailyGoalSetting';
import { WidgetPrivacyRow } from './WidgetPrivacyRow';
import { useStableCallback } from '@/hooks/useStableCallback';
import { showAlert } from '@/components/AppDialog';
import { useStacked } from '@/hooks/useStacked';

/** "today" / "yesterday" / "N days ago" — deliberately coarse, no hours/minutes. */
export function daysAgoLabel(iso: string, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Undefined means a failed read; null remains a legitimate saved setting (for example, no daily goal). */
async function orUnavailable<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** Every on/off notification setting, in one place so the "N of M on" summary can't drift from the real list. */
const ALERT_KEYS = [
  'morningEnabled',
  'eveningEnabled',
  'overspendAlerts',
  'billAlerts',
  'weeklySummary',
  'suuCheckins',
  'recurringAlerts',
  'refundAlerts',
] as const satisfies readonly (keyof NotificationPrefs)[];

/**
 * Settings starts with the colour mode, then a safety overview and grouped preferences.
 */
export function SettingsSection() {
  const stackValues = useStacked();
  const { preference: colourMode, setPreference: setColourMode } = useAppearance();
  const { lockEnabled, setLockEnabled } = useAppLock();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const [hideWidgets, setHideWidgets] = useState<boolean | null>(null);
  const [currency, setCurrency] = useState('INR');
  // How many things Tidy up has to look at — null until checked.
  const [tidyCount, setTidyCount] = useState<number | null>(null);
  // How many entries are waiting in Recently deleted — null until counted.
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  // One overall daily spending cap (Home's "Today" strip); `null` is off. Its accordion keeps its own draft.
  const [dailyGoal, setDailyGoalState] = useState<number | null>(null);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  // A failed last attempt used to fall through to "Never backed up" — wrong
  // either way (there may well be older backups), and it hid the failure.
  const [lastBackupFailed, setLastBackupFailed] = useState(false);
  // The backup note waits for the first read, so it doesn't flash on every visit.
  const [backupLoaded, setBackupLoaded] = useState(false);
  const [currencyLoaded, setCurrencyLoaded] = useState(false);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [readFailed, setReadFailed] = useState(false);

  // The reads are independent, so run them together, each with its own fallback: one failing read leaves
  // that row on its last known value instead of blanking the whole screen.
  const load = useCallback(async () => {
    const [cur, goal, tidy, deleted, prefs, lastBackup, widgets] = await Promise.all([
      orUnavailable(() => getDefaultCurrency()),
      orUnavailable(() => getDailySpendingGoal()),
      orUnavailable(async () => tidyUpCount(await getTidyUpReport())),
      orUnavailable(() => countDeletedEntries()),
      orUnavailable(() => getNotificationPrefs()),
      orUnavailable(() => getLastLocalBackupResult()),
      orUnavailable(() => getHideWidgetValues()),
    ]);
    setReadFailed(
      [cur, goal, tidy, deleted, prefs, lastBackup, widgets].some((value) => value === undefined)
    );
    if (widgets !== undefined) setHideWidgets(widgets);
    if (cur !== undefined) {
      setCurrency(cur);
      setCurrencyLoaded(true);
    }
    if (goal !== undefined) {
      setDailyGoalState(goal);
      setGoalLoaded(true);
    }
    if (tidy !== undefined) setTidyCount(tidy);
    if (deleted !== undefined) setDeletedCount(deleted);
    if (prefs !== undefined) setNotifPrefs(prefs);
    if (lastBackup !== undefined) {
      setLastBackupAt(lastBackup?.ok ? lastBackup.at : null);
      setLastBackupFailed(lastBackup?.ok === false);
      setBackupLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onSelectCurrency = useStableCallback(async (code: string) => {
    const previous = currency;
    setCurrency(code);
    try {
      await setDefaultCurrency(code);
    } catch (e) {
      // A failed write would leave the screen showing the new currency while formatMoney() still reads the
      // old cached one: a silent mismatch.
      setCurrency(previous);
      showAlert('Couldn’t change currency', errorMessage(e));
    }
  });

  const onToggleLock = async (enabled: boolean) => {
    try {
      if (enabled) {
        const secured = await isDeviceSecured();
        if (!secured) {
          showAlert(
            'No screen lock found',
            'Set up a fingerprint, face unlock, or PIN/pattern in your phone’s own settings first — Yume locks using whatever your phone is already secured with.'
          );
          return;
        }
      } else {
        // Turning the lock off takes the phone's own unlock, so whoever holds an open phone can't just switch it off.
        try {
          if (!(await authenticate())) return;
        } catch {
          return;
        }
      }
      setLockEnabled(enabled);
    } catch (e) {
      showAlert('Couldn’t check the device lock', errorMessage(e));
    }
  };

  const alertsOn = notifPrefs ? ALERT_KEYS.filter((k) => notifPrefs[k]).length : null;
  const backupOk = !!lastBackupAt && !lastBackupFailed;
  const backupSub = !backupLoaded
    ? readFailed
      ? 'Backup status unavailable'
      : 'Checking backup status…'
    : lastBackupFailed
      ? 'Last backup failed — tap to check'
      : lastBackupAt
        ? `Last backup ${daysAgoLabel(lastBackupAt)}`
        : 'Never backed up';

  return (
    <>
      {readFailed && (
        <Appear style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Some settings couldn’t be read</Text>
          <Text style={styles.errorDetail}>
            Previously loaded values are kept. Retry to check the latest settings.
          </Text>
          <PrimaryButton title="Retry" variant="secondary" compact onPress={() => void load()} />
        </Appear>
      )}
      <Section compact title="Appearance">
        <ListCard style={styles.settingsCard}>
          <View style={styles.modeRow}>
            <Text style={styles.appearanceTitle}>Colour mode</Text>
          </View>
          <AppearancePicker
            value={colourMode}
            onChange={(next) => {
              void setColourMode(next);
            }}
          />
        </ListCard>
      </Section>
      <Section compact title="Money">
        <ListCard style={styles.settingsCard}>
          <CurrencySetting
            currency={currency}
            loaded={currencyLoaded}
            stacked={stackValues}
            onSelect={onSelectCurrency}
          />
          <DailyGoalSetting
            goal={dailyGoal}
            currency={currency}
            loaded={goalLoaded && currencyLoaded}
            stacked={stackValues}
            onChanged={setDailyGoalState}
          />
          <MovingRow>
            <SettingsRow
              compact
              icon="tag-outline"
              tone="sky"
              label="Categories"
              sub="Add, rename, or archive"
              onPress={() => router.push('/categories')}
              divider
            />
          </MovingRow>
        </ListCard>
      </Section>

      <Section compact title="Privacy & notifications">
        <ListCard style={styles.settingsCard}>
          <SettingsRow
            compact
            icon="fingerprint"
            tone="lavender"
            label="Require unlock"
            sub="Fingerprint, face, or your phone’s PIN"
            right={
              <ToggleSwitch accessibilityLabel="Require unlock" value={lockEnabled} onChange={onToggleLock} />
            }
          />
          <SettingsRow
            compact
            icon="eye-off-outline"
            tone="lavender"
            label="Hide savings & investment amounts"
            sub="Mask balances and totals that include them"
            right={
              <ToggleSwitch
                accessibilityLabel="Hide savings and investment amounts"
                value={hideAmounts}
                onChange={toggleHideAmounts}
              />
            }
            divider
          />
          <WidgetPrivacyRow value={hideWidgets} onChanged={setHideWidgets} />
          <SettingsRow
            compact
            icon="bell-outline"
            tone="lavender"
            label="Notifications"
            sub={
              alertsOn == null
                ? 'Morning and evening notifications'
                : `${alertsOn} of ${ALERT_KEYS.length} on`
            }
            onPress={() => router.push('/notification-settings')}
            divider
          />
        </ListCard>
      </Section>

      <Section compact title="Your data">
        <ListCard style={styles.settingsCard}>
          <SettingsRow
            compact
            icon="folder-outline"
            tone="mint"
            label="Backup & restore"
            sub={backupSub}
            subColor={!backupLoaded || backupOk ? undefined : theme.colors.expenseText}
            onPress={() => router.push('/backup')}
          />
          <SettingsRow
            compact
            icon="file-export-outline"
            tone="mint"
            label="Export"
            sub="PDF reports and Excel spreadsheets"
            onPress={() => router.push('/export')}
            divider
          />
          <SettingsRow
            compact
            icon="delete-restore"
            tone="mint"
            label="Recently deleted"
            sub={
              deletedCount == null || deletedCount === 0
                ? 'Deleted entries wait here for 30 days'
                : `${deletedCount} ${deletedCount === 1 ? 'entry' : 'entries'} · kept for 30 days`
            }
            onPress={() => router.push('/recently-deleted')}
            divider
          />
          <SettingsRow
            compact
            icon="broom"
            tone="mint"
            label="Tidy up"
            sub={
              tidyCount == null
                ? 'Repeats, old balances, paise'
                : tidyCount === 0
                  ? 'All tidy'
                  : `${tidyCount} thing${tidyCount === 1 ? '' : 's'} to check`
            }
            subColor={tidyCount ? theme.colors.expenseText : undefined}
            onPress={() => router.push('/tidy-up')}
            divider
          />
        </ListCard>
      </Section>

      <AboutYume />
    </>
  );
}
