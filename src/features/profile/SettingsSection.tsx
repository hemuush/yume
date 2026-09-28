import { useCallback, useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
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
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { YumeLogo } from '@/components/YumeLogo';
import { useAccent, THEMES } from '@/theme/AccentContext';
import { themeOrigin } from '@/theme/themes';
import { ThemePreview } from './ThemePreview';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h } from '@/features/home/homeStyles';
import { styles } from './profile.styles';
import { errorMessage } from '@/lib/errorMessage';
import type { McIconName } from '@/components/iconName';
import { withPressed } from '@/lib/pressed';
import { showAlert } from '@/components/AppDialog';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One of the three at-a-glance tiles at the top of Settings. */
function GlanceTile({
  icon,
  tint,
  iconColor = theme.colors.ink,
  title,
  sub,
  onPress,
}: {
  icon: string;
  tint: string;
  iconColor?: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.96);
  return (
    <AnimatedPressable
      style={[styles.glanceTile, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
    >
      <View style={[styles.glanceIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon as McIconName} size={14} color={iconColor} />
      </View>
      <Text style={styles.glanceTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.glanceSub} numberOfLines={1}>
        {sub}
      </Text>
    </AnimatedPressable>
  );
}

/** "today" / "yesterday" / "N days ago" — deliberately coarse, no hours/minutes. */
export function daysAgoLabel(iso: string, now: Date = new Date()): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function AboutFact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.aboutFactRow}>
      <MaterialCommunityIcons name={icon as McIconName} size={15} color={theme.colors.textSecondary} />
      <Text style={styles.aboutFactText}>{text}</Text>
    </View>
  );
}

/**
 * Profile's Settings tab. Three at-a-glance tiles on top (backup, lock,
 * alerts) answer "is my data safe?"; then the groups in order of how often
 * they're changed — Money, Privacy & security, Alerts & backup, Appearance —
 * and About. Every group is a Home-style heading over one card of rows.
 *
 * `onJumpTo` scrolls the Profile screen to a content offset — the lock tile
 * uses it to bring the Privacy & security group into view.
 */
export function SettingsSection({ onJumpTo }: { onJumpTo?: (y: number) => void }) {
  const { themeId } = useAccent();
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
  const [privacyY, setPrivacyY] = useState<number | null>(null);
  const activeTheme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  // A single overall daily spending cap (see the "Today" strip on Home) —
  // `null` means it's off. `dailyGoalInput` is only the accordion's own
  // draft text, reset from the real value each time it opens so a typo
  // never lingers after closing without saving.
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

  const load = useCallback(async () => {
    setCurrency(await getDefaultCurrency());
    setDailyGoalState(await getDailySpendingGoal());
    try {
      setTidyCount(tidyUpCount(await getTidyUpReport()));
    } catch {
      setTidyCount(null);
    }
    setDeletedCount(await countDeletedEntries().catch(() => null));
    setNotifPrefs(await getNotificationPrefs());
    const lastBackup = await getLastLocalBackupResult();
    setLastBackupAt(lastBackup?.ok ? lastBackup.at : null);
    setLastBackupFailed(lastBackup?.ok === false);
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
      // A failed write would otherwise leave the screen showing the newly
      // picked currency while every formatMoney() call still reads the old
      // cached one — a silent mismatch with no error shown.
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

  const alertsOn = notifPrefs
    ? [
        notifPrefs.reminderEnabled,
        notifPrefs.overspendAlerts,
        notifPrefs.billAlerts,
        notifPrefs.weeklySummary,
        notifPrefs.suuCheckins,
      ].filter(Boolean).length
    : null;
  const backupOk = !!lastBackupAt && !lastBackupFailed;
  const backupSub = lastBackupFailed
    ? 'Last backup failed — tap to check'
    : lastBackupAt
      ? `Last backup ${daysAgoLabel(lastBackupAt)}`
      : 'Never backed up';

  return (
    <>
      <View style={styles.glanceRow}>
        <GlanceTile
          icon={backupOk ? 'check' : 'alert-outline'}
          tint={backupOk ? theme.colors.secondaryTint : theme.colors.idCoral}
          iconColor={backupOk ? theme.colors.income : theme.colors.ink}
          title={lastBackupFailed ? 'Backup failed' : backupOk ? 'Backed up' : 'No backup'}
          sub={
            lastBackupFailed
              ? 'Tap to check'
              : lastBackupAt
                ? capitalize(daysAgoLabel(lastBackupAt))
                : 'Set one up'
          }
          onPress={() => router.push('/backup')}
        />
        <GlanceTile
          icon={lockEnabled ? 'lock-outline' : 'lock-open-variant-outline'}
          tint={lockEnabled ? theme.colors.idSage : theme.colors.surfaceAlt}
          title={lockEnabled ? 'Lock on' : 'Lock off'}
          sub={lockEnabled ? 'Fingerprint or PIN' : 'Anyone can open'}
          onPress={() => privacyY != null && onJumpTo?.(privacyY)}
        />
        <GlanceTile
          icon="bell-outline"
          tint={theme.colors.primaryTint}
          title={alertsOn == null ? 'Alerts' : `${alertsOn} of 5`}
          sub="Alerts on"
          onPress={() => router.push('/notification-settings')}
        />
      </View>

      <HomeSection title="Money">
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
              <FormInput
                label={`Amount per day (${getCurrencySymbol(currency)})`}
                value={dailyGoalInput}
                onChangeText={setDailyGoalInput}
                keyboardType="decimal-pad"
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
      </HomeSection>

      <View onLayout={(e) => setPrivacyY(e.nativeEvent.layout.y)}>
        <HomeSection title="Privacy & security">
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
          </View>
        </HomeSection>
      </View>

      <HomeSection title="Alerts & backup">
        <View style={h.card}>
          <SettingsRow
            icon="bell-outline"
            iconBg={theme.colors.primaryTint}
            label="Notifications"
            sub={alertsOn == null ? 'Reminders, bill alerts, weekly summary' : `${alertsOn} of 5 on`}
            onPress={() => router.push('/notification-settings')}
          />
          <SettingsRow
            icon="folder-outline"
            iconBg={theme.colors.idTeal}
            label="Backup & restore"
            sub={backupSub}
            subColor={backupOk ? undefined : theme.colors.idCoralDeep}
            onPress={() => router.push('/backup')}
            divider
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
            subColor={tidyCount ? theme.colors.idCoralDeep : undefined}
            onPress={() => router.push('/tidy-up')}
            divider
          />
        </View>
      </HomeSection>

      <HomeSection title="Appearance">
        <Pressable
          onPress={() => router.push('/themes')}
          style={withPressed([h.card, styles.themeCard])}
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${activeTheme.name}, ${themeOrigin(activeTheme)}. Change theme`}
        >
          <ThemePreview pack={activeTheme} height={104} detailed />
          <View style={styles.themeRow}>
            <View style={h.mid}>
              <Text style={styles.themeName}>{activeTheme.name}</Text>
              <Text style={styles.themeFrom}>{themeOrigin(activeTheme)}</Text>
            </View>
            <View style={styles.themeChange}>
              <Text style={styles.themeChangeText}>Change</Text>
            </View>
          </View>
        </Pressable>
      </HomeSection>

      <HomeSection title="About">
        <View style={[h.card, styles.aboutCard]}>
          <View style={styles.aboutTop}>
            <YumeLogo size={44} />
            <View style={h.mid}>
              <Text style={styles.aboutName}>Yume</Text>
              <Text style={styles.aboutTagline}>Track every rupee, on your terms.</Text>
            </View>
            <Text style={styles.aboutVersion}>v{Application.nativeApplicationVersion ?? '1.0.0'}</Text>
          </View>
          <View style={styles.aboutFacts}>
            <AboutFact icon="wifi-off" text="Works fully offline — no account, no server, no signup." />
            <AboutFact icon="lock-outline" text="Your data never leaves this device unless you back it up." />
            <AboutFact
              icon="file-document-outline"
              text="Backups are plain JSON you can open and read yourself."
            />
          </View>
        </View>
      </HomeSection>
    </>
  );
}
