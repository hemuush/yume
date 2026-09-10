import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Animated } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import * as Application from 'expo-application';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDefaultCurrency, setDefaultCurrency, SUPPORTED_CURRENCIES, ACCENT_SWATCHES } from '@/db/settings';
import { countFractionalLedgerAmounts, roundLedgerAmountsToWholeRupees } from '@/db/maintenance';
import { isDeviceSecured } from '@/lib/appLock';
import { useAppLock } from '@/lib/AppLockContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { AppHeader } from '@/components/AppHeader';
import { ModalSheet } from '@/components/ModalSheet';
import { SettingsRowIcon } from '@/components/SettingsRowIcon';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SuuIllustration } from '@/components/SuuIllustration';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAccent } from '@/theme/AccentContext';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

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
  value,
  onPress,
  right,
  last,
}: {
  icon: string;
  iconBg: string;
  label: string;
  sub?: string;
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
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
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

function AboutFact({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.aboutFactRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={theme.colors.textSecondary} />
      <Text style={styles.aboutFactText}>{text}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { accent, setAccent } = useAccent();
  const { lockEnabled, setLockEnabled } = useAppLock();
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  const insets = useSafeAreaInsets();
  const [currency, setCurrency] = useState('INR');
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [fractionalCount, setFractionalCount] = useState(0);
  const [rounding, setRounding] = useState(false);

  const load = useCallback(async () => {
    setCurrency(await getDefaultCurrency());
    try {
      setFractionalCount((await countFractionalLedgerAmounts()).total);
    } catch {
      setFractionalCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSelectCurrency = async (code: string) => {
    const previous = currency;
    setCurrency(code);
    setCurrencyPickerOpen(false);
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
    <View style={styles.container}>
      <AppHeader title="Settings" showBack />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <Group title="Appearance">
          <View style={[styles.row, styles.rowDivider, styles.swatchRow]}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Accent colour</Text>
              <Text style={styles.rowSub}>Buttons, active tab, and highlights</Text>
            </View>
          </View>
          <View style={styles.swatchGrid}>
            {ACCENT_SWATCHES.map((hex) => (
              <Pressable
                key={hex}
                style={[styles.swatch, { backgroundColor: hex }, accent === hex && styles.swatchActive]}
                onPress={() => setAccent(hex)}
                accessibilityRole="button"
                accessibilityLabel={`Accent ${hex}`}
              >
                {accent === hex && (
                  <Feather
                    name="check"
                    size={15}
                    color={hex === '#12130F' ? theme.colors.primary : theme.colors.ink}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </Group>

        <Group title="Money">
          <Row
            icon="currency-inr"
            iconBg={theme.colors.gold}
            label="Default currency"
            sub="New accounts and displayed amounts"
            value={currency}
            onPress={() => setCurrencyPickerOpen(true)}
          />
          <Row
            icon="tag-outline"
            iconBg={theme.colors.flatPink}
            label="Categories"
            sub="Add, rename, or archive"
            onPress={() => router.push('/categories')}
          />
          <Row
            icon="autorenew"
            iconBg={theme.colors.flatBlue}
            label="Recurring transactions"
            sub="Rent, subscriptions, salary — logged automatically"
            onPress={() => router.push('/recurring')}
            last
          />
        </Group>

        <Group title="Alerts & data">
          <Row
            icon="bell-outline"
            iconBg={theme.colors.secondary}
            label="Notifications"
            sub="Reminders, bill alerts, weekly summary"
            onPress={() => router.push('/notification-settings')}
          />
          <Row
            icon="folder-outline"
            iconBg={theme.colors.flatBlue}
            label="Backup & Restore"
            sub="Local folder, file export & restore"
            onPress={() => router.push('/backup')}
          />
          <Row
            icon="database-import-outline"
            iconBg={theme.colors.accentTint}
            label="Move data from Flynse"
            sub="Bring everything across from the old app in one step"
            onPress={() => router.push('/backup?import=1')}
          />
          <Row
            icon="calculator-variant-outline"
            iconBg={theme.colors.accentTint}
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
            iconBg={theme.colors.flatMint}
            label="Require unlock"
            sub="Fingerprint, face, or your phone's PIN"
            right={<ToggleSwitch value={lockEnabled} onChange={onToggleLock} />}
          />
          <Row
            icon="eye-off-outline"
            iconBg={theme.colors.gold}
            label="Hide savings & investment amounts"
            sub="Masks Savings Deposit/Investments amounts — also toggleable from the eye icon on your Profile"
            right={<ToggleSwitch value={hideAmounts} onChange={toggleHideAmounts} />}
            last
          />
        </Group>

        <Text style={styles.groupTitle}>About</Text>
        <View style={styles.aboutCard}>
          <SuuIllustration size={56} />
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
      </ScrollView>

      <ModalSheet
        visible={currencyPickerOpen}
        onClose={() => setCurrencyPickerOpen(false)}
        title="Default currency"
      >
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
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  groupTitle: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
  },
  group: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.textMuted },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: theme.font.bodyMedium, fontSize: 14.5, color: theme.colors.textPrimary },
  rowSub: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  rowValue: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },

  swatchRow: { paddingBottom: 10 },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, paddingTop: 12 },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: { borderWidth: theme.border.thick },

  pickerHint: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },

  aboutCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
  },
  aboutName: { fontFamily: theme.font.display, fontSize: 20, color: theme.colors.textPrimary, marginTop: 10 },
  aboutTagline: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, marginTop: 3 },
  aboutFacts: { alignSelf: 'stretch', gap: 10, marginTop: 18 },
  aboutFactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aboutFactText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  aboutVersion: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 18,
    letterSpacing: 0.4,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  codeBubble: {
    width: 44,
    height: 30,
    borderRadius: 9,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.ink },
});
