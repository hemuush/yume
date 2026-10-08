import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, BackHandler } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setHasOnboarded, setUserName } from '@/db/settings';
import { createAccount } from '@/db/ledger';
import { toMinor } from '@/lib/money';
import { BackupSnapshot, summarizeSnapshot, getCurrentSummary, isTooLargeForBackup } from '@/lib/backup';
import { restoreKeepingSafetyCopy, SafetyCopyError } from '@/lib/safetyCopy';
import { resyncAfterRestore } from '@/lib/restoreSync';
import { withoutRelock } from '@/lib/appLock';
import { RestorePreviewSheet, RestorePreview } from '@/features/backup/RestorePreviewSheet';
import { AccountType } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SuuIllustration } from '@/components/SuuIllustration';
import { AmountField, AmountPadDock } from '@/components/AmountField';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { LinearGradient } from 'expo-linear-gradient';
import { shade } from '@/lib/color';
import { EYEBROW } from '@/constants/textStyles';
import { YumeLogo } from '@/components/YumeLogo';
import { KickerDot } from '@/components/StripCard';
import { HeaderHills } from '@/features/home/HeaderHills';
import { withPressed } from '@/lib/pressed';
import { showAlert } from '@/components/AppDialog';
import { errorMessage } from '@/lib/errorMessage';

interface Slide {
  title: string;
  subtitle: string;
  pose: 'default' | 'peek' | 'sleepy';
  isNameStep?: boolean;
  isAccountsStep?: boolean;
}

/**
 * The starter accounts the last step offers: without one, a new user's first tap on + can't save (Add has
 * nothing to pick). Names are ordinary and editable later in Profile.
 */
interface StarterAccount {
  key: string;
  type: AccountType;
  name: string;
  icon: string;
  color: string;
}
const STARTER_ACCOUNTS: StarterAccount[] = [
  { key: 'bank', type: 'bank', name: 'Bank account', icon: 'bank', color: theme.colors.primary },
  { key: 'cash', type: 'cash', name: 'Cash', icon: 'cash', color: theme.colors.gold },
  { key: 'upi', type: 'wallet', name: 'UPI wallet', icon: 'wallet', color: theme.colors.accent },
];

const SLIDES: Slide[] = [
  {
    title: 'Better money, bigger dreams',
    subtitle:
      'Yume keeps every rupee in one calm place — daily spending, savings, and the friends you owe. Fully offline.',
    pose: 'default',
  },
  {
    title: 'Loans, without the headache',
    subtitle:
      'EMI, interest, prepayments — Yume does the maths so you always know how close you are to done.',
    pose: 'peek',
  },
  {
    title: 'Yours, and only yours',
    subtitle:
      'Nothing leaves your phone. Back up to a folder you choose, or export a file whenever you want — never required.',
    pose: 'sleepy',
  },
  {
    title: 'What should we call you?',
    subtitle: 'Optional — you can change or add this anytime in Settings.',
    pose: 'default',
    isNameStep: true,
  },
  {
    title: 'Where does your money live?',
    subtitle: 'Pick what you use. You can rename these or add more anytime in Profile.',
    pose: 'peek',
    isAccountsStep: true,
  },
];

/**
 * Rendered directly by the root layout, not pushed as a route: expo-router picks the first screen from the
 * launch URL ("/"), so `initialRouteName="onboarding"` on the Stack was ignored.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { accent, secondary } = useAccent();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({ bank: true, cash: true, upi: false });
  const [openings, setOpenings] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  // Starter accounts already created — a retry after a partial failure must
  // never create the same account twice.
  const createdKeys = useRef(new Set<string>());
  const [pendingRestore, setPendingRestore] = useState<{
    snapshot: BackupSnapshot;
    preview: RestorePreview;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const isLast = index === SLIDES.length - 1;
  // The same sky as every screen's header, in the theme's colour.
  const gradientTop = shade(accent, 90, 4);
  const gradientBottom = shade(accent, 96, 2);
  const slide = SLIDES[index];

  /** Creates the picked starter accounts. False if any failed (the user stays on this step to retry or skip). */
  const createPickedAccounts = async (): Promise<boolean> => {
    for (const starter of STARTER_ACCOUNTS) {
      if (!picked[starter.key] || createdKeys.current.has(starter.key)) continue;
      const typedMinor = toMinor(parseFloat(openings[starter.key] || '0'));
      try {
        await createAccount({
          name: starter.name,
          type: starter.type,
          openingBalanceMinor: Number.isFinite(typedMinor) ? typedMinor : 0,
        });
        createdKeys.current.add(starter.key);
      } catch {
        return false;
      }
    }
    return true;
  };

  const getStarted = async () => {
    setAccountsError(null);
    setCreating(true);
    const ok = await createPickedAccounts();
    setCreating(false);
    if (!ok) {
      setAccountsError("Couldn't add every account. Try again, or skip and add them later in Profile.");
      return;
    }
    await finish();
  };

  const finish = async () => {
    try {
      if (name.trim()) await setUserName(name);
      await setHasOnboarded(true);
    } catch {
      // A failed write must never trap a first-run user here: worst case (setHasOnboarded failing) onboarding
      // reappears next launch, which is recoverable; being stuck with no error UI or retry is not.
    } finally {
      onDone();
    }
  };

  /**
   * "I have a Yume backup": a new-phone user picks their backup file and lands in the app with everything
   * back. Same preview as the Backup screen; Cancel leaves them on this slide.
   */
  const pickBackup = async () => {
    try {
      const result = await withoutRelock(() => DocumentPicker.getDocumentAsync({ type: '*/*' }));
      if (result.canceled || !result.assets?.[0]) return;
      if (isTooLargeForBackup(result.assets[0].size)) {
        throw new Error('That file is too large to be a Yume backup — pick a full backup Yume exported.');
      }
      const content = await new File(result.assets[0].uri).text();
      let snapshot: BackupSnapshot;
      try {
        snapshot = JSON.parse(content);
      } catch {
        throw new Error("That file isn't valid JSON — pick a full backup Yume exported.");
      }
      const backup = summarizeSnapshot(snapshot);
      if (!backup) throw new Error("That file isn't a Yume backup — pick a full backup Yume exported.");
      const exportedAt = Number.isNaN(Date.parse(snapshot.exportedAt))
        ? new Date().toISOString()
        : snapshot.exportedAt;
      const current = await getCurrentSummary();
      setPendingRestore({ snapshot, preview: { exportedAt, backup, current, lostCount: 0 } });
    } catch (e) {
      showAlert("Couldn't open that backup", errorMessage(e));
    }
  };

  const restorePending = async () => {
    if (!pendingRestore) return;
    const { snapshot, preview } = pendingRestore;
    setRestoring(true);
    try {
      try {
        await restoreKeepingSafetyCopy(snapshot);
      } catch (e) {
        // A first-run phone has nothing worth a safety copy, so if saving that empty copy fails, restoring
        // loses nothing. With data already here, stop; the Backup screen can do it knowingly.
        if (!(e instanceof SafetyCopyError) || preview.current.entries > 0) throw e;
        await restoreKeepingSafetyCopy(snapshot, { withoutCopy: true });
      }
    } catch (e) {
      setRestoring(false);
      setPendingRestore(null);
      showAlert("Couldn't restore that backup", errorMessage(e));
      return;
    }
    try {
      await resyncAfterRestore();
    } catch {
      // The data is already restored; a failed resync (notifications, widgets) only means those catch up on
      // the next launch. Never let it strand the user on this screen.
    } finally {
      setRestoring(false);
      setPendingRestore(null);
    }
    await finish();
  };

  // Android back steps to the previous slide (onboarding sits outside the navigator, so nothing else would
  // catch it and the app would close).
  useEffect(() => {
    if (index === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIndex((i) => Math.max(0, i - 1));
      return true;
    });
    return () => sub.remove();
  }, [index]);

  const next = () => {
    if (creating) return;
    if (isLast) {
      void getStarted();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View style={styles.root}>
      <AmountPadDock>
        {(scrollProps) => (
          <KeyboardAvoidingView
            style={[styles.container, { paddingBottom: insets.bottom }]}
            behavior="padding"
          >
            {/* The sky: the Yume mark and Skip on top, Suu in the middle, Home's hills along the bottom. */}
            <View style={[styles.sky, { paddingTop: insets.top + 12 }]}>
              <LinearGradient colors={[gradientTop, gradientBottom]} style={StyleSheet.absoluteFill} />
              <View style={styles.skyBar}>
                <View style={styles.brand}>
                  <YumeLogo size={18} />
                  <Text style={styles.brandText}>Yume</Text>
                </View>
                <Pressable
                  style={withPressed(styles.skip)}
                  onPress={finish}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Skip"
                >
                  <Text style={styles.skipText}>Skip</Text>
                </Pressable>
              </View>
              <View style={[styles.illustWrap, slide.isAccountsStep && styles.illustWrapSmall]}>
                <SuuIllustration size={slide.isAccountsStep ? 84 : 140} pose={slide.pose} />
              </View>
              <HeaderHills sky="transparent" primary={accent} secondary={secondary} />
            </View>

            <View style={styles.kickerRow}>
              <KickerDot color={index === 0 ? theme.colors.link : theme.colors.secondaryDeep} />
              <Text style={styles.kicker}>
                {index === 0 ? 'Welcome' : `Step ${index + 1} of ${SLIDES.length}`}
              </Text>
            </View>
            <Text style={[styles.title, slide.isAccountsStep && styles.titleCompact]}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>

            {slide.isNameStep && (
              <TextInput
                style={[
                  styles.nameInput,
                  nameFocused && [styles.nameInputFocused, { borderColor: secondary }],
                ]}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textMuted}
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                maxLength={40}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={next}
              />
            )}

            {slide.isAccountsStep && (
              <ScrollView
                {...scrollProps}
                style={styles.accountsScroll}
                contentContainerStyle={styles.accountsList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {STARTER_ACCOUNTS.map((starter) => {
                  const on = !!picked[starter.key];
                  return (
                    <View key={starter.key} style={styles.accountCard}>
                      {on && <View style={[styles.accountStrip, { backgroundColor: starter.color }]} />}
                      <Pressable
                        onPress={() => setPicked((prev) => ({ ...prev, [starter.key]: !prev[starter.key] }))}
                        style={withPressed(styles.accountHead)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={starter.name}
                      >
                        <CategoryIcon name={starter.icon} color={starter.color} size={17} square={36} />
                        <Text style={styles.accountName}>{starter.name}</Text>
                        <View style={[styles.check, on && styles.checkOn]}>
                          {on && <Feather name="check" size={13} color={theme.colors.surface} />}
                        </View>
                      </Pressable>
                      {on && (
                        <AmountField
                          style={styles.openingInput}
                          placeholder="Current balance (optional)"
                          placeholderTextColor={theme.colors.textMuted}
                          value={openings[starter.key] ?? ''}
                          onChangeText={(v) => setOpenings((prev) => ({ ...prev, [starter.key]: v }))}
                          maxLength={12}
                          accessibilityLabel={`${starter.name} current balance`}
                        />
                      )}
                    </View>
                  );
                })}
                {accountsError && <Text style={styles.accountsError}>{accountsError}</Text>}
              </ScrollView>
            )}

            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === index && { width: 20, backgroundColor: theme.colors.ink, opacity: 1 },
                  ]}
                />
              ))}
            </View>

            <Pressable
              style={withPressed([styles.cta, index === 0 && styles.ctaWithLink, creating && styles.ctaBusy])}
              onPress={next}
              disabled={creating}
              accessibilityRole="button"
              testID="onboarding-cta"
            >
              <Text style={styles.ctaText}>{creating ? 'Setting up…' : isLast ? 'Get started' : 'Next'}</Text>
            </Pressable>

            {index === 0 && (
              <Pressable
                style={withPressed(styles.restoreLink)}
                onPress={pickBackup}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="I have a Yume backup"
              >
                <Feather name="download" size={14} color={theme.colors.link} />
                <Text style={styles.restoreLinkText}>I have a Yume backup</Text>
              </Pressable>
            )}

            <RestorePreviewSheet
              preview={pendingRestore?.preview ?? null}
              busy={restoring}
              onCancel={() => setPendingRestore(null)}
              onRestore={restorePending}
            />
          </KeyboardAvoidingView>
        )}
      </AmountPadDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 28 },
  // Full width: undoes the page's side padding.
  sky: { marginHorizontal: -28, overflow: 'hidden' },
  skyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textSecondary },
  skip: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  illustWrap: {
    alignSelf: 'center',
    marginTop: 28,
    marginBottom: 6,
    width: 200,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustWrapSmall: { marginTop: 8, marginBottom: 0, width: 120, height: 96 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  titleCompact: { marginTop: 6 },
  accountsScroll: { flexGrow: 0, flexShrink: 1, marginTop: 18, alignSelf: 'stretch' },
  accountsList: { gap: 10, paddingBottom: 4 },
  // A white card; picked, it gets a strip in the account's colour along its top.
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 10,
    paddingTop: 12,
    overflow: 'hidden',
  },
  accountStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountName: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  openingInput: {
    marginTop: 10,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: theme.font.monoBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  accountsError: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.expenseText,
    textAlign: 'center',
    marginTop: 4,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 19,
  },
  nameInput: {
    marginTop: 20,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: theme.font.bodyMedium,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  nameInputFocused: { backgroundColor: theme.colors.surface },
  dots: { flexDirection: 'row', gap: 6, marginTop: 24 },
  // A plain muted fill, not an outlined dot: a hairline border was barely visible on the cream page.
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
    opacity: 0.35,
  },
  cta: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaWithLink: { marginBottom: 6 },
  ctaBusy: { opacity: 0.6 },
  restoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  restoreLinkText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
  ctaText: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.surface },
});
