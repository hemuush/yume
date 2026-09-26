import { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, Animated } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
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
import { countFractionalLedgerAmounts, roundLedgerAmountsToWholeRupees } from '@/db/maintenance';
import { toMinor, toMajor, getCurrencySymbol } from '@/lib/money';
import { isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { SettingsRowIcon } from '@/components/SettingsRowIcon';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { FormInput } from '@/components/FormInput';
import { YumeLogo } from '@/components/YumeLogo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAccent, THEMES } from '@/theme/AccentContext';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { styles } from './profile.styles';

const AnimatedRow = Animated.createAnimatedComponent(Pressable);

/**
 * Rows are grouped into one bordered card per section, with hairline
 * dividers between them — the previous layout gave every single row its own
 * heavy outlined card, so ten currencies read as ten equally-important
 * buttons and the page had no visual hierarchy at all.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </>
  );
}

function Row({
  icon,
  iconBg,
  label,
  sub,
  subColor,
  value,
  onPress,
  right,
  last,
}: {
  icon: string;
  iconBg: string;
  label: string;
  sub?: string;
  /** Overrides the sub text colour — used for a "never backed up" nudge, otherwise left at the default muted tone. */
  subColor?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.99);
  const content = (
    <>
      <SettingsRowIcon name={icon} backgroundColor={iconBg} />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={[styles.rowSub, subColor && { color: subColor }]}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right ?? (onPress ? <Feather name="chevron-right" size={19} color={theme.colors.textMuted} /> : null)}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, !last && styles.rowDivider]}>{content}</View>;
  }
  return (
    <AnimatedRow
      style={[styles.row, !last && styles.rowDivider, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {content}
    </AnimatedRow>
  );
}

/** "today" / "yesterday" / "N days ago" — deliberately coarse, no hours/minutes. */
function daysAgoLabel(iso: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function AboutFact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.aboutFactRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={theme.colors.textSecondary} />
      <Text style={styles.aboutFactText}>{text}</Text>
    </View>
  );
}

/**
 * Every row Settings used to have, minus the three that moved to Profile's
 * "You" tab (Recurring transactions, Budgets, Savings goals — content you
 * check often, not app configuration) — see YouSection.tsx. "Money" here is
 * now just the two things that actually are one-time setup: Default
 * currency and Categories.
 */
export function SettingsSection() {
  const { themeId, setTheme } = useAccent();
  const { lockEnabled, setLockEnabled } = useAppLock();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const [currency, setCurrency] = useState('INR');
  // Both are plain pick-one lists (a theme pack, a currency code) — each
  // gets a collapsed row that expands in place to the exact same list this
  // screen already rendered, instead of always showing Theme's cards
  // inline or pushing Currency into its own full-screen sheet.
  const [themeOpen, setThemeOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [fractionalCount, setFractionalCount] = useState(0);
  const [rounding, setRounding] = useState(false);
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

  // Read-only summaries for two rows that used to describe what they *do*
  // ("Reminders, bill alerts...") rather than their actual current state —
  // Theme and Currency already show their live pick; these two bring
  // Notifications and Backup in line with that.
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  // A failed last attempt used to fall through to "Never backed up" — wrong
  // either way (there may well be older backups), and it hid the failure.
  const [lastBackupFailed, setLastBackupFailed] = useState(false);

  const load = useCallback(async () => {
    setCurrency(await getDefaultCurrency());
    setDailyGoalState(await getDailySpendingGoal());
    try {
      setFractionalCount((await countFractionalLedgerAmounts()).total);
    } catch {
      setFractionalCount(0);
    }
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
    // Closes the accordion on pick, same as the modal it replaces did — a
    // pick-one list, unlike Theme, has nothing left to check once you've
    // made the one choice it offers.
    setCurrencyOpen(false);
    try {
      await setDefaultCurrency(code);
    } catch (e: any) {
      // Previously unguarded — a failed write here left the screen showing
      // the newly picked currency while the cached value every formatMoney()
      // call actually reads from stayed on the old one, a silent mismatch
      // with no error shown.
      setCurrency(previous);
      Alert.alert('Could not change currency', String(e?.message ?? e));
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
    } catch (e: any) {
      setDailyGoalError(String(e?.message ?? e));
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

  const onRoundAmounts = () => {
    if (rounding) return;
    if (fractionalCount === 0) {
      Alert.alert('Nothing to round', 'Every stored amount is already a whole rupee.');
      return;
    }
    Alert.alert(
      'Round amounts to whole rupees?',
      `${fractionalCount} stored amount${fractionalCount === 1 ? '' : 's'} still ` +
        `carr${fractionalCount === 1 ? 'ies' : 'y'} paise. Rounding them makes on-screen ` +
        'totals line up with their parts. Loan schedules are left untouched. Some account ' +
        'balances may shift by a rupee or two. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Round them',
          style: 'destructive',
          onPress: async () => {
            setRounding(true);
            try {
              const changed = await roundLedgerAmountsToWholeRupees();
              setFractionalCount(0);
              Alert.alert(
                'Done',
                `Rounded ${changed.total} amount${changed.total === 1 ? '' : 's'} to whole rupees.`
              );
            } catch (e: any) {
              Alert.alert('Could not round amounts', String(e?.message ?? e));
            } finally {
              setRounding(false);
            }
          },
        },
      ]
    );
  };

  const onToggleLock = async (enabled: boolean) => {
    if (enabled) {
      const secured = await isDeviceSecured();
      if (!secured) {
        Alert.alert(
          'No screen lock found',
          "Set up a fingerprint, face unlock, or PIN/pattern in your phone's own settings first — Yume locks using whatever your phone is already secured with."
        );
        return;
      }
    }
    setLockEnabled(enabled);
  };

  return (
    <>
      <Group title="Appearance">
        <Row
          icon="palette-outline"
          iconBg={theme.colors.idSage}
          label="Theme"
          sub="Buttons, active tab, highlights, and Suu's dot"
          onPress={() => setThemeOpen((v) => !v)}
          last
          right={
            <>
              <View style={styles.rowPreviewSwatch}>
                <View style={[styles.rowPreviewSwatchHalf, { backgroundColor: activeTheme.primary }]} />
                <View style={[styles.rowPreviewSwatchHalf, { backgroundColor: activeTheme.secondary }]} />
              </View>
              <Text style={styles.rowValue}>{activeTheme.name}</Text>
              <Feather
                name={themeOpen ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={theme.colors.textMuted}
              />
            </>
          }
        />
        {themeOpen && (
          <View style={styles.accordionBody}>
            <View style={styles.themeList}>
              {THEMES.map((pack) => {
                const active = themeId === pack.id;
                return (
                  <Pressable
                    key={pack.id}
                    style={[styles.themeCard, active && styles.themeCardActive]}
                    onPress={() => setTheme(pack.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Theme ${pack.name}`}
                  >
                    <View style={styles.themeSwatch}>
                      <View style={[styles.themeSwatchHalf, { backgroundColor: pack.primary }]} />
                      <View style={[styles.themeSwatchHalf, { backgroundColor: pack.secondary }]} />
                    </View>
                    <View style={styles.themeInfo}>
                      <Text style={styles.themeName}>{pack.name}</Text>
                      <Text style={styles.themeSub}>{pack.sub}</Text>
                    </View>
                    {active && (
                      <View style={styles.themeCheck}>
                        <Feather name="check" size={13} color={theme.colors.surface} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </Group>

      <Group title="Money">
        <Row
          icon="currency-inr"
          iconBg={theme.colors.goldTint}
          label="Default currency"
          sub="New accounts and displayed amounts"
          onPress={() => setCurrencyOpen((v) => !v)}
          last
          right={
            <>
              <Text style={styles.rowValue}>{currency}</Text>
              <Feather
                name={currencyOpen ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={theme.colors.textMuted}
              />
            </>
          }
        />
        {currencyOpen && (
          <View style={styles.accordionBody}>
            <Text style={styles.pickerHint}>
              Existing accounts keep whatever currency they were created with. Combined totals only add up
              accounts in this currency.
            </Text>
            {SUPPORTED_CURRENCIES.map((c, i) => (
              <Pressable
                key={c.code}
                style={[styles.pickerRow, i < SUPPORTED_CURRENCIES.length - 1 && styles.rowDivider]}
                onPress={() => onSelectCurrency(c.code)}
              >
                <View style={styles.codeBubble}>
                  <Text style={styles.codeText}>{c.code}</Text>
                </View>
                <Text style={[styles.rowLabel, { flex: 1 }]}>{c.label}</Text>
                {currency === c.code && <Feather name="check" size={18} color={theme.colors.ink} />}
              </Pressable>
            ))}
          </View>
        )}
        {/* Currency isn't the last row in this group (more rows follow) —
            its own bottom divider is suppressed above (`last`) so it never
            doubles up with accordionBody's top border when open, so this
            stands in for it either way, open or collapsed. */}
        <View style={styles.rowDivider} />
        <Row
          icon="gauge"
          iconBg={theme.colors.idTeal}
          label="Daily spending goal"
          sub="Shown on Home each day"
          onPress={toggleDailyGoal}
          last
          right={
            <>
              <Text style={styles.rowValue}>
                {dailyGoal != null ? `${getCurrencySymbol(currency)}${toMajor(dailyGoal)}/day` : 'Not set'}
              </Text>
              <Feather
                name={dailyGoalOpen ? 'chevron-up' : 'chevron-down'}
                size={19}
                color={theme.colors.textMuted}
              />
            </>
          }
        />
        {dailyGoalOpen && (
          <View style={styles.accordionBody}>
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
                <Pressable
                  style={[styles.dailyGoalBtn, styles.dailyGoalBtnGhost]}
                  onPress={clearDailyGoal}
                  disabled={dailyGoalSaving}
                >
                  <Text style={styles.dailyGoalBtnGhostText}>Clear</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.dailyGoalBtn, styles.dailyGoalBtnPrimary]}
                onPress={saveDailyGoal}
                disabled={dailyGoalSaving}
              >
                <Text style={styles.dailyGoalBtnPrimaryText}>{dailyGoalSaving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        )}
        <View style={styles.rowDivider} />
        <Row
          icon="tag-outline"
          iconBg={theme.colors.idCoral}
          label="Categories"
          sub="Add, rename, or archive"
          onPress={() => router.push('/categories')}
          last
        />
      </Group>

      <Group title="Alerts & data">
        <Row
          icon="bell-outline"
          iconBg={theme.colors.accentTint}
          label="Notifications"
          sub={
            notifPrefs
              ? `${
                  [
                    notifPrefs.reminderEnabled,
                    notifPrefs.overspendAlerts,
                    notifPrefs.billAlerts,
                    notifPrefs.weeklySummary,
                    notifPrefs.suuCheckins,
                  ].filter(Boolean).length
                } of 5 on`
              : 'Reminders, bill alerts, weekly summary'
          }
          onPress={() => router.push('/notification-settings')}
        />
        <Row
          icon="folder-outline"
          iconBg={theme.colors.idTeal}
          label="Backup & Restore"
          sub={
            lastBackupFailed
              ? 'Last backup failed — tap to check'
              : lastBackupAt
                ? `Last backup ${daysAgoLabel(lastBackupAt)}`
                : 'Never backed up'
          }
          subColor={lastBackupAt && !lastBackupFailed ? undefined : theme.colors.idCoralDeep}
          onPress={() => router.push('/backup')}
        />
        <Row
          icon="calculator-variant-outline"
          iconBg={theme.colors.primaryTint}
          label="Round off amounts"
          sub={
            rounding
              ? 'Rounding…'
              : fractionalCount === 0
                ? 'All amounts are whole rupees'
                : `${fractionalCount} old amount${fractionalCount === 1 ? '' : 's'} still carry paise — tap to fix`
          }
          onPress={onRoundAmounts}
          last
        />
      </Group>

      <Group title="Security">
        <Row
          icon="fingerprint"
          iconBg={theme.colors.idSage}
          label="Require unlock"
          sub="Fingerprint, face, or your phone's PIN"
          right={<ToggleSwitch value={lockEnabled} onChange={onToggleLock} />}
        />
        <Row
          icon="eye-off-outline"
          iconBg={theme.colors.idGold}
          label="Hide savings & investment amounts"
          sub="Masks Savings Deposit/Investments amounts — also toggleable from the eye icon above"
          right={<ToggleSwitch value={hideAmounts} onChange={toggleHideAmounts} />}
          last
        />
      </Group>

      <Text style={styles.groupTitle}>About</Text>
      <View style={styles.aboutCard}>
        <YumeLogo size={50} />
        <Text style={styles.aboutName}>Yume</Text>
        <Text style={styles.aboutTagline}>Track every rupee, on your terms.</Text>
        <View style={styles.aboutFacts}>
          <AboutFact icon="wifi-off" text="Works fully offline — no account, no server, no signup." />
          <AboutFact icon="lock-outline" text="Your data never leaves this device unless you back it up." />
          <AboutFact
            icon="file-document-outline"
            text="Backups are plain JSON you can open and read yourself."
          />
        </View>
        <Text style={styles.aboutVersion}>Version {Application.nativeApplicationVersion ?? '1.0.0'}</Text>
      </View>
    </>
  );
}
