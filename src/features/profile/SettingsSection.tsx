import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Application from 'expo-application';
import {
  getDefaultCurrency,
  setDefaultCurrency,
  SUPPORTED_CURRENCIES,
  getDailySpendingGoal,
  setDailySpendingGoal,
  getNotificationPrefs,
  getLastLocalBackupResult,
  NotificationPrefs,
} from '@/db/settings';
import { getTidyUpReport, tidyUpCount } from '@/db/tidyUp';
import { countDeletedEntries } from '@/db/recentlyDeleted';
import { toMinor, toMajor, getCurrencySymbol, formatMoney } from '@/lib/money';
import { isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import ReanimatedAnimated from 'react-native-reanimated';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SettingsRow } from '@/components/SettingsRow';
import { MovingRow } from '@/components/MovingRow';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { YumeLogo } from '@/components/YumeLogo';
import { useAccent, THEMES } from '@/theme/AccentContext';
import { shade } from '@/lib/color';
import { ThemeThumb } from './ThemePreview';
import { theme } from '@/constants/theme';
import { Section } from '@/components/Section';
import { screenStyles as h } from '@/components/screenStyles';
import { styles } from './profile.styles';
import { errorMessage } from '@/lib/errorMessage';
import type { McIconName } from '@/components/iconName';
import { withPressed } from '@/lib/pressed';
import { showAlert } from '@/components/AppDialog';

/** "today" / "yesterday" / "N days ago" — deliberately coarse, no hours/minutes. */
export function daysAgoLabel(iso: string, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Runs one settings read, resolving null instead of rejecting so a single failure can't blank the screen. */
async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
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
] as const satisfies readonly (keyof NotificationPrefs)[];

function AboutFact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.aboutFactRow}>
      <MaterialCommunityIcons name={icon as McIconName} size={15} color={theme.colors.textSecondary} />
      <Text style={styles.aboutFactText}>{text}</Text>
    </View>
  );
}

/**
 * Settings tab, ordered by how often each group is touched: Money, Privacy & alerts, Your data, Appearance,
 * About. A coral note tops it only while backups need attention; otherwise rows' sub-lines carry every state.
 */
export function SettingsSection() {
  const { themeId, accent } = useAccent();
  const { lockEnabled, setLockEnabled } = useAppLock();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const [currency, setCurrency] = useState('INR');
  // Currency is a long pick-one list, so its row expands in place to show it
  // rather than always taking up the screen.
  const [currencyOpen, setCurrencyOpen] = useState(false);
  // How many things Tidy up has to look at — null until checked.
  const [tidyCount, setTidyCount] = useState<number | null>(null);
  // How many entries are waiting in Recently deleted — null until counted.
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  // One overall daily spending cap (Home's "Today" strip); `null` is off. `dailyGoalInput` is the
  // accordion's draft text, reset from the real value on open so a typo never lingers after closing unsaved.
  const [dailyGoal, setDailyGoalState] = useState<number | null>(null);
  const [dailyGoalOpen, setDailyGoalOpen] = useState(false);
  const [dailyGoalInput, setDailyGoalInput] = useState('');
  const [dailyGoalError, setDailyGoalError] = useState<string | null>(null);
  const [dailyGoalSaving, setDailyGoalSaving] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  // A failed last attempt used to fall through to "Never backed up" — wrong
  // either way (there may well be older backups), and it hid the failure.
  const [lastBackupFailed, setLastBackupFailed] = useState(false);
  // The backup note waits for the first read, so it doesn't flash on every visit.
  const [backupLoaded, setBackupLoaded] = useState(false);

  // The reads are independent, so run them together, each with its own fallback: one failing read leaves
  // that row on its default instead of blanking the whole screen.
  const load = useCallback(async () => {
    const [cur, goal, tidy, deleted, prefs, lastBackup] = await Promise.all([
      orNull(() => getDefaultCurrency()),
      orNull(() => getDailySpendingGoal()),
      orNull(async () => tidyUpCount(await getTidyUpReport())),
      orNull(() => countDeletedEntries()),
      orNull(() => getNotificationPrefs()),
      orNull(() => getLastLocalBackupResult()),
    ]);
    if (cur) setCurrency(cur);
    setDailyGoalState(goal);
    setTidyCount(tidy);
    setDeletedCount(deleted);
    setNotifPrefs(prefs);
    setLastBackupAt(lastBackup?.ok ? lastBackup.at : null);
    setLastBackupFailed(lastBackup?.ok === false);
    setBackupLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSelectCurrency = async (code: string) => {
    const previous = currency;
    setCurrency(code);
    // A pick-one list has nothing left to do once you've made the one choice.
    setCurrencyOpen(false);
    try {
      await setDefaultCurrency(code);
    } catch (e) {
      // A failed write would leave the screen showing the new currency while formatMoney() still reads the
      // old cached one: a silent mismatch.
      setCurrency(previous);
      showAlert("Couldn't change currency", errorMessage(e));
    }
  };

  const toggleDailyGoal = () => {
    if (!dailyGoalOpen) setDailyGoalInput(dailyGoal != null ? String(toMajor(dailyGoal)) : '');
    setDailyGoalError(null);
    setDailyGoalOpen((v) => !v);
  };

  const saveDailyGoal = async () => {
    setDailyGoalError(null);
    const minor = toMinor(parseFloat(dailyGoalInput || '0'));
    if (!Number.isFinite(minor) || minor <= 0) {
      setDailyGoalError('Enter a valid daily amount');
      return;
    }
    setDailyGoalSaving(true);
    try {
      await setDailySpendingGoal(minor);
      setDailyGoalState(minor);
      setDailyGoalOpen(false);
    } catch (e) {
      setDailyGoalError(errorMessage(e));
    } finally {
      setDailyGoalSaving(false);
    }
  };

  const clearDailyGoal = async () => {
    setDailyGoalSaving(true);
    try {
      await setDailySpendingGoal(null);
      setDailyGoalState(null);
      setDailyGoalOpen(false);
    } catch (e) {
      setDailyGoalError(errorMessage(e));
    } finally {
      setDailyGoalSaving(false);
    }
  };

  const onToggleLock = async (enabled: boolean) => {
    if (enabled) {
      const secured = await isDeviceSecured();
      if (!secured) {
        showAlert(
          'No screen lock found',
          "Set up a fingerprint, face unlock, or PIN/pattern in your phone's own settings first — Yume locks using whatever your phone is already secured with."
        );
        return;
      }
    }
    setLockEnabled(enabled);
  };

  const alertsOn = notifPrefs ? ALERT_KEYS.filter((k) => notifPrefs[k]).length : null;
  const backupOk = !!lastBackupAt && !lastBackupFailed;
  const backupSub = lastBackupFailed
    ? 'Last backup failed — tap to check'
    : lastBackupAt
      ? `Last backup ${daysAgoLabel(lastBackupAt)}`
      : 'Never backed up';

  return (
    <>
      {backupLoaded && !backupOk && (
        <Pressable
          style={withPressed(styles.nudge)}
          onPress={() => router.push('/backup')}
          accessibilityRole="button"
          accessibilityLabel={`${lastBackupFailed ? 'Backup failed' : 'No backup yet'}. ${
            lastBackupFailed ? 'Tap to check' : 'Set one up'
          }`}
        >
          <View style={styles.nudgeIcon}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={theme.colors.ink} />
          </View>
          <View style={h.mid}>
            <Text style={h.title}>{lastBackupFailed ? 'Backup failed' : 'No backup yet'}</Text>
            <Text style={styles.nudgeSub}>
              {lastBackupFailed
                ? "The last attempt didn't finish."
                : 'Save a copy of your data to a folder on this phone.'}
            </Text>
          </View>
          <View style={styles.nudgePill}>
            <Text style={styles.nudgePillText}>{lastBackupFailed ? 'Check' : 'Set up'}</Text>
          </View>
        </Pressable>
      )}

      <Section title="Money">
        <View style={h.card}>
          <SettingsRow
            icon="currency-inr"
            iconBg={theme.colors.goldTint}
            label="Default currency"
            sub="New accounts and displayed amounts"
            value={currency}
            onPress={() => setCurrencyOpen((v) => !v)}
            expanded={currencyOpen}
          />
          {currencyOpen && (
            <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT} style={styles.accordionBody}>
              <Text style={styles.pickerHint}>
                Existing accounts keep whatever currency they were created with. Combined totals only add up
                accounts in this currency.
              </Text>
              {SUPPORTED_CURRENCIES.map((c, i) => (
                <Pressable
                  key={c.code}
                  style={withPressed([styles.pickerRow, i > 0 && h.divider])}
                  onPress={() => onSelectCurrency(c.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label}, ${c.code}`}
                  accessibilityState={{ selected: currency === c.code }}
                >
                  <View style={styles.codeBubble}>
                    <Text style={styles.codeText}>{c.code}</Text>
                  </View>
                  <Text style={[h.title, { flex: 1 }]}>{c.label}</Text>
                  {currency === c.code && <Feather name="check" size={18} color={theme.colors.ink} />}
                </Pressable>
              ))}
            </ReanimatedAnimated.View>
          )}
          <MovingRow>
            <SettingsRow
              icon="gauge"
              iconBg={theme.colors.idTeal}
              label="Daily spending goal"
              sub="Shown on Home each day"
              value={dailyGoal != null ? `${formatMoney(dailyGoal, currency)}/day` : 'Not set'}
              onPress={toggleDailyGoal}
              expanded={dailyGoalOpen}
              divider
            />
          </MovingRow>
          {dailyGoalOpen && (
            <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT} style={styles.accordionBody}>
              <AmountField
                label={`Amount per day (${getCurrencySymbol(currency)})`}
                value={dailyGoalInput}
                onChangeText={setDailyGoalInput}
                placeholder="e.g. 800"
              />
              {dailyGoalError && <Text style={styles.errorText}>{dailyGoalError}</Text>}
              <View style={styles.dailyGoalBtnRow}>
                {dailyGoal != null && (
                  <PrimaryButton
                    title="Clear"
                    variant="secondary"
                    onPress={clearDailyGoal}
                    disabled={dailyGoalSaving}
                    style={styles.dailyGoalBtn}
                  />
                )}
                <PrimaryButton
                  title={dailyGoalSaving ? 'Saving…' : 'Save'}
                  onPress={saveDailyGoal}
                  disabled={dailyGoalSaving}
                  style={styles.dailyGoalBtn}
                />
              </View>
            </ReanimatedAnimated.View>
          )}
          <MovingRow>
            <SettingsRow
              icon="tag-outline"
              iconBg={theme.colors.idCoral}
              label="Categories"
              sub="Add, rename, or archive"
              onPress={() => router.push('/categories')}
              divider
            />
          </MovingRow>
        </View>
      </Section>

      <Section title="Privacy & alerts">
        <View style={h.card}>
          <SettingsRow
            icon="fingerprint"
            iconBg={theme.colors.idSage}
            label="Require unlock"
            sub="Fingerprint, face, or your phone's PIN"
            right={<ToggleSwitch value={lockEnabled} onChange={onToggleLock} />}
          />
          <SettingsRow
            icon="eye-off-outline"
            iconBg={theme.colors.idGold}
            label="Hide savings & investment amounts"
            sub="Also on the eye icon at the top"
            right={<ToggleSwitch value={hideAmounts} onChange={toggleHideAmounts} />}
            divider
          />
          <SettingsRow
            icon="bell-outline"
            iconBg={shade(accent, 95)}
            label="Notifications"
            sub={
              alertsOn == null
                ? 'Morning and evening notifications'
                : `${alertsOn} of ${ALERT_KEYS.length} on`
            }
            onPress={() => router.push('/notification-settings')}
            divider
          />
        </View>
      </Section>

      <Section title="Your data">
        <View style={h.card}>
          <SettingsRow
            icon="folder-outline"
            iconBg={theme.colors.idTeal}
            label="Backup & restore"
            sub={backupSub}
            subColor={backupOk ? undefined : theme.colors.expenseText}
            onPress={() => router.push('/backup')}
          />
          <SettingsRow
            icon="delete-restore"
            iconBg={theme.colors.idCoral}
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
            icon="broom"
            iconBg={theme.colors.accentTint}
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
        </View>
      </Section>

      <Section title="Appearance">
        <Pressable
          onPress={() => router.push('/themes')}
          style={withPressed([h.card, h.row])}
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${activeTheme.name}. Change theme`}
        >
          <ThemeThumb pack={activeTheme} />
          <View style={h.mid}>
            <Text style={h.title}>Theme</Text>
            <Text style={h.sub}>{activeTheme.name}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </Section>

      <View style={styles.footer}>
        <YumeLogo size={30} />
        <Text style={styles.footerName}>Yume · v{Application.nativeApplicationVersion ?? '1.0.0'}</Text>
        <Text style={styles.footerSub}>Works fully offline.</Text>
        <Pressable
          onPress={() => setAboutOpen((v) => !v)}
          hitSlop={8}
          style={withPressed(styles.footerLink)}
          accessibilityRole="button"
          accessibilityState={{ expanded: aboutOpen }}
          accessibilityLabel="About Yume"
        >
          <Text style={styles.footerLinkText}>{aboutOpen ? 'Hide' : 'About Yume'}</Text>
          <Feather
            name={aboutOpen ? 'chevron-up' : 'chevron-right'}
            size={14}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>
      {aboutOpen && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
          <View style={[h.card, styles.aboutCard]}>
            <Text style={styles.aboutTagline}>Track every rupee, on your terms.</Text>
            <View style={styles.aboutFacts}>
              <AboutFact icon="wifi-off" text="Works fully offline — no account, no server, no signup." />
              <AboutFact
                icon="lock-outline"
                text="Your data never leaves this device unless you back it up."
              />
              <AboutFact
                icon="file-document-outline"
                text="Backups are plain JSON you can open and read yourself."
              />
            </View>
          </View>
        </ReanimatedAnimated.View>
      )}
    </>
  );
}
